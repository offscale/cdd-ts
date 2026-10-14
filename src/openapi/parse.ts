/**
 * Contains `SwaggerParser`, the central component responsible for loading, parsing,
 * and providing a unified interface to OpenAPI (3.x) and Swagger (2.x) specifications.
 *
 * @module openapi/parse
 */

import { OAS_3_1_DIALECT } from "../core/constants.js";
import type {
	GeneratorConfig,
	LinkObject,
	OpenApiValue,
	PathInfo,
	PathItem,
	SecurityScheme,
	ServerObject,
	SpecOperation,
	SwaggerDefinition,
	SwaggerSpec,
} from "../core/types/index.js";
import {
	extractPaths,
	isUriReference,
	normalizeSecurityKey,
	pascalCase,
} from "../functions/utils.js";
import { ReferenceResolver } from "./parse_reference_resolver.js";
import { SpecLoader } from "./parse_spec_loader.js";
import { SpecValidationError, validateSpec } from "./parse_validator.js";

/**
 * Represents a resolved polymorphic discriminator variant (`oneOf` / `anyOf` mapping entry).
 */
export interface PolymorphicOption {
	/** Discriminator value or schema name. */
	name: string;
	/** Resolved schema definition for this variant. */
	schema: SwaggerDefinition;
}

/**
 * Named schema entry collected from an OpenAPI or Swagger specification.
 */
export interface NamedSchemaEntry {
	/** Schema identifier name. */
	name: string;
	/** Schema definition or boolean schema. */
	definition: SwaggerDefinition | boolean;
}

/**
 * Specification family and version descriptor returned by `SwaggerParser.getSpecVersion()`.
 */
export interface SpecVersionInfo {
	/** Specification family (`"swagger"` or `"openapi"`). */
	type: "swagger" | "openapi";
	/** Specification version string (e.g. `"2.0"`, `"3.1.0"`). */
	version: string;
}

/**
 * A wrapper class for a raw OpenAPI/Swagger specification object.
 */
export class SwaggerParser {
	/** Raw validated OpenAPI/Swagger specification object. */
	public readonly spec: SwaggerSpec;
	/** Generator configuration options. */
	public readonly config: GeneratorConfig;
	/** Canonical document URI of the root specification. */
	public readonly documentUri: string;

	/** Collected and deduplicated schema definitions across the specification and referenced documents. */
	public readonly schemas: NamedSchemaEntry[];
	/** Resolved server objects for the specification. */
	public readonly servers: ServerObject[];
	/** Extracted and normalized HTTP path operations. */
	public readonly operations: PathInfo[];
	/** Extracted and normalized webhook operations. */
	public readonly webhooks: PathInfo[];
	/** Resolved security scheme definitions. */
	public readonly security: Record<string, SecurityScheme>;
	/** Resolved reusable link definitions from `components.links`. */
	public readonly links: Record<string, LinkObject>;

	private readonly specCache: Map<string, SwaggerSpec>;
	private readonly resolver: ReferenceResolver;

	/**
	 * Creates a new `SwaggerParser` instance from an in-memory `SwaggerSpec`.
	 *
	 * @param spec - Raw OpenAPI or Swagger specification object.
	 * @param config - Generator configuration options.
	 * @param specCache - Optional pre-populated cache of referenced specification documents.
	 * @param documentUri - Base document URI for resolving relative references.
	 * @throws {SpecValidationError} When `spec` fails OpenAPI/Swagger validation.
	 * @throws {Error} When `config.validateInput` returns `false`.
	 */
	public constructor(
		spec: SwaggerSpec,
		config: GeneratorConfig,
		specCache?: Map<string, SwaggerSpec>,
		documentUri: string = "file://entry-spec.json",
	) {
		validateSpec(spec);

		if (config.validateInput && !config.validateInput(spec)) {
			throw new Error("Custom input validation failed.");
		}

		this.spec = spec;

		this.config = config;

		this.documentUri = documentUri;

		this.specCache =
			specCache || new Map<string, SwaggerSpec>([[this.documentUri, spec]]);

		if (!specCache) {
			let baseUri = documentUri;
			if (spec.$self) {
				if (typeof URL !== "undefined") {
					try {
						baseUri = new URL(spec.$self, documentUri).href;
					} catch {
						baseUri = spec.$self;
					}
				} else {
					baseUri = spec.$self; // WASM Fallback: minimal resolution
				}
			}

			if (baseUri !== documentUri) {
				this.specCache.set(baseUri, spec);
			}

			ReferenceResolver.indexSchemaIds(
				spec,
				baseUri,
				this.specCache,
				this.documentUri,
			);
		}

		this.resolver = new ReferenceResolver(this.specCache, this.documentUri);

		this.schemas = this.collectSchemas();

		this.servers = this.resolveServers(this.spec.servers);

		const resolveRef = (ref: string) => this.resolveReference(ref);

		const resolveObj = (obj: OpenApiValue) => this.resolve(obj);

		const extractOptions: {
			isOpenApi3: boolean;
			defaultConsumes?: string[];
			defaultProduces?: string[];
		} = {
			isOpenApi3: !!this.spec.openapi,
		};

		if (this.spec.swagger) {
			if (this.spec.consumes)
				extractOptions.defaultConsumes = this.spec.consumes;

			if (this.spec.produces)
				extractOptions.defaultProduces = this.spec.produces;
		}

		const operations = extractPaths(
			this.spec.paths,
			resolveRef,
			this.spec.components,
			extractOptions,
			resolveObj,
		);

		const webhooks = extractPaths(
			this.spec.webhooks,
			resolveRef,
			this.spec.components,
			extractOptions,
			resolveObj,
		);

		const resolveOpServers = (items: PathInfo[]): PathInfo[] =>
			items.map((item) => {
				if (item.servers === undefined) return item;

				const normalizedServers =
					item.servers.length === 0 ? [{ url: "/" }] : item.servers;

				return {
					...item,
					servers: this.resolveServerUrls(normalizedServers, this.documentUri),
				};
			});

		this.operations = resolveOpServers(operations);

		this.webhooks = resolveOpServers(webhooks);

		this.assertUniqueResolvedOperationIds();

		this.security = this.getSecuritySchemes();

		this.links = this.getLinks();
	}

	/**
	 * Asynchronously loads an OpenAPI/Swagger specification from a file path or URL and constructs a `SwaggerParser`.
	 *
	 * @param inputPath - File path or URL to the specification.
	 * @param config - Generator configuration options.
	 * @returns Promise resolving to the initialized `SwaggerParser`.
	 */
	static async create(
		inputPath: string,
		config: GeneratorConfig,
	): Promise<SwaggerParser> {
		const { entrySpec, cache, documentUri } = await SpecLoader.load(inputPath);

		return new SwaggerParser(entrySpec, config, cache, documentUri);
	}

	/**
	 * Synchronously loads an OpenAPI/Swagger specification from a local file path and constructs a `SwaggerParser`.
	 *
	 * @param inputPath - Local file path to the specification.
	 * @param config - Generator configuration options.
	 * @returns The initialized `SwaggerParser`.
	 */
	static createSync(inputPath: string, config: GeneratorConfig): SwaggerParser {
		const { entrySpec, cache, documentUri } = SpecLoader.loadSync(inputPath);

		return new SwaggerParser(entrySpec, config, cache, documentUri);
	}

	private resolveServers(servers?: ServerObject[]): ServerObject[] {
		if (this.spec.swagger) {
			return this.resolveSwagger2Servers(servers);
		}

		if (!servers || servers.length === 0) {
			return [{ url: "/" }];
		}

		return this.resolveServerUrls(servers, this.documentUri);
	}

	private resolveServerUrls(
		servers: ServerObject[] | undefined,
		baseUri: string,
	): ServerObject[] {
		if (!servers || servers.length === 0) return servers ?? [];

		return servers.map((server) => {
			if (!server.url) return server;

			const rawUrl = server.url.trim();

			if (rawUrl.startsWith("{")) {
				return server;
			}

			try {
				const serverBaseUri =
					ReferenceResolver.getDocumentUri(server as object) ?? baseUri;

				let resolvedUrl = rawUrl;
				if (typeof URL !== "undefined") {
					resolvedUrl = new URL(rawUrl, serverBaseUri).href;
				}

				const decodedUrl = resolvedUrl
					.replace(/%7B/g, "{")
					.replace(/%7D/g, "}");

				return { ...server, url: decodedUrl };
			} catch {
				return server;
			}
		});
	}

	private resolveSwagger2Servers(servers?: ServerObject[]): ServerObject[] {
		if (servers && servers.length > 0) {
			return servers;
		}

		const swaggerSpec = this.spec as SwaggerSpec;

		const documentUrl = this.getHttpDocumentUrl();

		const host = swaggerSpec.host || documentUrl?.host || undefined;

		const basePathRaw = swaggerSpec.basePath ?? "/";

		const basePath =
			basePathRaw === ""
				? "/"
				: basePathRaw.startsWith("/")
					? basePathRaw
					: `/${basePathRaw}`;

		const schemes =
			swaggerSpec.schemes && swaggerSpec.schemes.length > 0
				? swaggerSpec.schemes
				: documentUrl
					? [documentUrl.protocol.replace(":", "")]
					: ["http"];

		if (!host) {
			if (basePath && basePath !== "/") {
				return [{ url: basePath }];
			}

			return [];
		}

		const uniqueSchemes = Array.from(new Set(schemes));

		return uniqueSchemes.map((scheme) => ({
			url: `${scheme}://${host}${basePath}`,
		}));
	}

	private getHttpDocumentUrl(): URL | undefined {
		if (typeof URL === "undefined") return undefined;
		try {
			const url = new URL(this.documentUri);

			if (url.protocol === "http:" || url.protocol === "https:") {
				return url;
			}
		} catch {
			// ignore
		}

		return undefined;
	}

	/**
	 * Returns the underlying raw `SwaggerSpec` object.
	 *
	 * @returns The raw `SwaggerSpec`.
	 */
	public getSpec(): SwaggerSpec {
		return this.spec;
	}

	/**
	 * Returns the effective JSON Schema dialect URI for the specification (OAS 3.1+).
	 *
	 * @returns The `jsonSchemaDialect` URI, or `undefined` for Swagger 2.0 / OAS 3.0.
	 */
	public getJsonSchemaDialect(): string | undefined {
		if (this.spec.jsonSchemaDialect) {
			return this.spec.jsonSchemaDialect;
		}

		const openapiVersion = this.spec.openapi;

		if (!openapiVersion) return undefined;

		const match = openapiVersion.match(/^3\.(\d+)/);

		if (!match) return undefined;

		const minor = Number(match[1]);

		if (!Number.isNaN(minor) && minor >= 1) {
			return OAS_3_1_DIALECT;
		}

		return undefined;
	}

	/**
	 * Returns the map of schema definitions from `definitions` (Swagger 2.0) or `components.schemas` (OAS 3.x).
	 *
	 * @returns Record mapping schema names to `SwaggerDefinition` or boolean schemas.
	 */
	public getDefinitions(): Record<string, SwaggerDefinition | boolean> {
		return this.spec.definitions || this.spec.components?.schemas || {};
	}

	/**
	 * Looks up a single schema definition by name.
	 *
	 * @param name - Schema name to look up.
	 * @returns The `SwaggerDefinition`, boolean schema, or `undefined`.
	 */
	public getDefinition(name: string): SwaggerDefinition | boolean | undefined {
		return this.getDefinitions()[name];
	}

	private collectSchemas(): {
		name: string;
		definition: SwaggerDefinition | boolean;
	}[] {
		const definitions = new Map<string, SwaggerDefinition | boolean>();

		const definitionValues = new Set<SwaggerDefinition | boolean>();

		const seenDocs = new Set<object>();

		let syntheticCount = 0;

		const addDefinitions = (
			defs: Record<string, SwaggerDefinition | boolean> | undefined,
			origin: string,
		): void => {
			if (!defs) return;

			Object.entries(defs).forEach(([name, definition]) => {
				const normalizedName = pascalCase(name);

				if (!definitions.has(normalizedName)) {
					definitions.set(normalizedName, definition);

					definitionValues.add(definition);

					return;
				}

				const existing = definitions.get(normalizedName);

				if (existing !== definition) {
					console.warn(
						`[Parser] Duplicate schema name "${normalizedName}" encountered in ${origin}. Keeping first occurrence.`,
					);
				}
			});
		};

		addDefinitions(this.getDefinitions(), this.documentUri);

		for (const [uri, doc] of this.specCache.entries()) {
			if (!doc || typeof doc !== "object") continue;

			if (seenDocs.has(doc)) continue;

			seenDocs.add(doc);

			const asSpec = doc as SwaggerSpec;

			const docDefinitions = asSpec.definitions || asSpec.components?.schemas;

			if (docDefinitions) {
				addDefinitions(docDefinitions, uri);

				continue;
			}

			if (this.isSchemaDocument(doc)) {
				if (definitionValues.has(doc as SwaggerDefinition)) {
					continue;
				}

				const schemaName = this.deriveSchemaName(
					uri,
					doc as SwaggerDefinition,
					++syntheticCount,
				);

				if (!definitions.has(schemaName)) {
					definitions.set(schemaName, doc as SwaggerDefinition);

					definitionValues.add(doc as SwaggerDefinition);
				} else {
					const existing = definitions.get(schemaName);

					if (existing !== doc) {
						console.warn(
							`[Parser] Duplicate standalone schema name "${schemaName}" encountered in ${uri}. Keeping first occurrence.`,
						);
					}
				}
			}
		}

		return Array.from(definitions.entries()).map(([name, definition]) => ({
			name,
			definition,
		}));
	}

	private isSchemaDocument(
		candidate: OpenApiValue,
	): candidate is SwaggerDefinition {
		if (!candidate || typeof candidate !== "object") return false;

		const doc = candidate as Record<string, OpenApiValue>;

		if (
			"openapi" in doc ||
			"swagger" in doc ||
			"info" in doc ||
			"paths" in doc
		) {
			return false;
		}

		const schemaKeys = [
			"$id",
			"$schema",
			"type",
			"properties",
			"items",
			"allOf",
			"anyOf",
			"oneOf",
			"enum",
			"const",
			"additionalProperties",
			"patternProperties",
			"prefixItems",
			"contentMediaType",
			"contentSchema",
		];

		return schemaKeys.some((key) => key in doc);
	}

	private deriveSchemaName(
		uri: string,
		schema: SwaggerDefinition,
		fallbackIndex: number,
	): string {
		const source = typeof schema.$id === "string" ? schema.$id : uri;

		const withoutFragment = source.split("#")[0].split("?")[0];

		const lastSegment = withoutFragment.split("/").filter(Boolean).pop();

		const base = lastSegment
			? lastSegment.replace(/\.[^/.]+$/, "")
			: `Schema${fallbackIndex}`;

		const name = pascalCase(base);

		return name || `Schema${fallbackIndex}`;
	}

	/**
	 * Collects all security scheme definitions from `components.securitySchemes`, `securityDefinitions`, and URI security references.
	 *
	 * @returns Record mapping security scheme names to `SecurityScheme` objects.
	 */
	public getSecuritySchemes(): Record<string, SecurityScheme> {
		const schemes = {
			...(this.spec.components?.securitySchemes || {}),
			...(this.spec.securityDefinitions || {}),
		} as Record<string, SecurityScheme>;

		const knownNames = new Set(Object.keys(schemes));

		const addSchemeFromRef = (key: string) => {
			if (!key || knownNames.has(key)) return;

			if (isUriReference(key)) {
				const resolved = this.resolveReference<SecurityScheme>(key);

				if (resolved) {
					schemes[key] = resolved;

					knownNames.add(key);
				}

				return;
			}

			const normalized = normalizeSecurityKey(key);

			if (knownNames.has(normalized)) return;

			const resolved = this.resolveReference<SecurityScheme>(key);

			if (resolved) {
				schemes[normalized] = resolved;

				knownNames.add(normalized);
			}
		};

		const scanSecurityRequirements = (
			security?: Record<string, string[]>[],
		) => {
			if (!security) return;

			security.forEach((req) => {
				if (!req || typeof req !== "object") return;

				Object.keys(req).forEach((key) => {
					if (!knownNames.has(key)) {
						addSchemeFromRef(key);
					}
				});
			});
		};

		const scanPathSecurity = (paths?: Record<string, PathItem>) => {
			if (!paths) return;

			const methods = [
				"get",
				"post",
				"put",
				"patch",
				"delete",
				"options",
				"head",
				"trace",
				"query",
			];

			Object.values(paths).forEach((pathItem) => {
				if (!pathItem || typeof pathItem !== "object") return;

				const pathRec = pathItem as Extract<
					PathItem,
					Record<string, OpenApiValue>
				>;

				methods.forEach((method) => {
					const op = pathRec[method] as SpecOperation | undefined;

					if (op?.security) scanSecurityRequirements(op.security);
				});

				if (pathRec.additionalOperations) {
					Object.values(
						pathRec.additionalOperations as Record<string, SpecOperation>,
					).forEach((op) => {
						if (op?.security) scanSecurityRequirements(op.security);
					});
				}
			});
		};

		scanSecurityRequirements(this.spec.security);

		scanPathSecurity(this.spec.paths as Record<string, PathItem>);

		scanPathSecurity(this.spec.webhooks as Record<string, PathItem>);

		return schemes;
	}

	/**
	 * Resolves and returns all reusable `LinkObject` definitions from `components.links`.
	 *
	 * @returns Record mapping link names to resolved `LinkObject` definitions.
	 */
	public getLinks(): Record<string, LinkObject> {
		if (!this.spec.components?.links) return {};

		const links: Record<string, LinkObject> = {};

		for (const [key, val] of Object.entries(this.spec.components.links)) {
			if ("$ref" in val) {
				const resolved = this.resolveReference<LinkObject>(
					(val as { $ref: string }).$ref,
				);

				if (resolved) links[key] = resolved;
			} else {
				links[key] = val as LinkObject;
			}
		}

		return links;
	}

	/**
	 * Resolves an object that may be a direct definition, a `$ref`, or a `$dynamicRef`.
	 *
	 * @template T - Expected resolved object type.
	 * @param obj - Value or reference object to resolve.
	 * @returns The resolved target of type `T`, or `undefined`.
	 */
	public resolve<T>(
		obj: T | { $ref: string } | { $dynamicRef: string } | null | undefined,
	): T | undefined {
		return this.resolver.resolve(obj);
	}

	/**
	 * Resolves a reference URI or JSON Pointer string against the specification cache.
	 *
	 * @template T - Expected resolved target type.
	 * @param ref - Reference string (e.g., `"#/components/schemas/User"`).
	 * @param currentDocUri - Optional base document URI override.
	 * @returns The resolved target of type `T`, or `undefined`.
	 */
	public resolveReference<T = SwaggerDefinition>(
		ref: string,
		currentDocUri?: string,
	): T | undefined {
		return this.resolver.resolveReference(ref, currentDocUri);
	}

	/**
	 * Extracts polymorphic discriminator options (`oneOf` / `anyOf` variants) for a schema with a `discriminator`.
	 *
	 * @param schema - Schema definition containing a `discriminator`.
	 * @returns Array of resolved `PolymorphicOption` entries.
	 */
	public getPolymorphicSchemaOptions(
		schema: SwaggerDefinition,
	): PolymorphicOption[] {
		if (!schema.discriminator) {
			return [];
		}

		const dPropName = schema.discriminator.propertyName;

		const variants = schema.oneOf ?? schema.anyOf;

		if (!variants) {
			return [];
		}

		const mapping = schema.discriminator.mapping || {};

		if (Object.keys(mapping).length > 0) {
			return Object.entries(mapping)
				.map(([name, ref]) => {
					const resolvedSchema = this.resolveReference<SwaggerDefinition>(ref);

					return resolvedSchema ? { name, schema: resolvedSchema } : null;
				})

				.filter((opt): opt is PolymorphicOption => !!opt);
		}

		return variants
			.map((refSchema) => {
				let ref: string | undefined;

				if (typeof refSchema === "object") {
					const refObj = refSchema as { $ref?: string; $dynamicRef?: string };

					if (refObj.$ref) ref = refObj.$ref;
					else if (refObj.$dynamicRef) ref = refObj.$dynamicRef;
				}

				if (!ref) return null;

				const resolvedSchema = this.resolveReference<SwaggerDefinition>(ref);

				if (!resolvedSchema) {
					return null;
				}

				const hasProp =
					typeof resolvedSchema === "object" &&
					resolvedSchema.properties &&
					resolvedSchema.properties[dPropName];

				if (!hasProp) {
					return null;
				}

				if (
					typeof resolvedSchema === "object" &&
					resolvedSchema.properties &&
					(resolvedSchema.properties[dPropName] as SwaggerDefinition)?.enum
				) {
					const name = (
						resolvedSchema.properties[dPropName] as SwaggerDefinition
					).enum?.[0] as string;

					return { name, schema: resolvedSchema };
				}

				const implicitName = ref.split("/").pop();

				if (implicitName) {
					return { name: implicitName, schema: resolvedSchema };
				}

				return null;
			})

			.filter((opt): opt is PolymorphicOption => !!opt);
	}

	/**
	 * Checks whether the specification has a valid Swagger `2.x` or OpenAPI `3.x` version string.
	 *
	 * @returns `true` if `swagger` starts with `"2."` or `openapi` starts with `"3."`.
	 */
	public isValidSpec(): boolean {
		return !!(
			this.spec.swagger?.startsWith("2.") || this.spec.openapi?.startsWith("3.")
		);
	}

	/**
	 * Returns the specification family (`"swagger"` or `"openapi"`) and version string.
	 *
	 * @returns Object `{ type, version }` or `null` if neither header is present.
	 */
	public getSpecVersion(): SpecVersionInfo | null {
		if (this.spec.swagger)
			return { type: "swagger", version: this.spec.swagger };

		if (this.spec.openapi)
			return { type: "openapi", version: this.spec.openapi };

		return null;
	}

	private assertUniqueResolvedOperationIds(): void {
		const operationIdLocations = new Map<string, string[]>();

		const operationKeys = [
			"get",
			"post",
			"put",
			"patch",
			"delete",
			"options",
			"head",
			"trace",
			"query",
		];

		const record = (op: PathInfo, prefix: string) => {
			if (!op.operationId) return;

			const location = `${prefix}${op.method.toUpperCase()} ${op.path}`;

			const existing = operationIdLocations.get(op.operationId);

			if (existing) {
				existing.push(location);
			} else {
				operationIdLocations.set(op.operationId, [location]);
			}
		};

		const recordFromPathItem = (
			pathItem: OpenApiValue,
			pathKey: string,
			prefix: string,
		) => {
			if (!pathItem || typeof pathItem !== "object") return;

			const pi = pathItem as Record<string, OpenApiValue>;

			for (const method of operationKeys) {
				const operation = pi[method] as SpecOperation | undefined;

				if (operation?.operationId) {
					const location = `${prefix}${method.toUpperCase()} ${pathKey}`;

					const existing = operationIdLocations.get(operation.operationId);

					if (existing) {
						existing.push(location);
					} else {
						operationIdLocations.set(operation.operationId, [location]);
					}
				}
			}

			if (pi.additionalOperations) {
				for (const [method, operationVal] of Object.entries(
					pi.additionalOperations as Record<string, SpecOperation>,
				)) {
					const operation = operationVal as SpecOperation | undefined;

					if (operation?.operationId) {
						const location = `${prefix}${method} ${pathKey}`;

						const existing = operationIdLocations.get(operation.operationId);

						if (existing) {
							existing.push(location);
						} else {
							operationIdLocations.set(operation.operationId, [location]);
						}
					}
				}
			}
		};

		this.operations.forEach((op) => record(op, "paths: "));

		this.webhooks.forEach((op) => record(op, "webhooks: "));

		const resolvedPaths = new Set(this.operations.map((op) => op.path));

		if (this.spec.paths) {
			for (const [pathKey, pathItem] of Object.entries(this.spec.paths)) {
				if (!pathItem || typeof pathItem !== "object") continue;

				if (!(pathItem as Record<string, OpenApiValue>).$ref) continue;

				if (resolvedPaths.has(pathKey)) continue;

				const resolved = this.resolveReference<PathItem>(
					(pathItem as Record<string, OpenApiValue>).$ref as string,
					this.documentUri,
				);

				if (resolved) {
					recordFromPathItem(resolved, pathKey, "paths: ");
				}
			}
		}

		if (this.spec.webhooks) {
			const resolvedWebhookPaths = new Set(this.webhooks.map((op) => op.path));

			for (const [pathKey, pathItem] of Object.entries(this.spec.webhooks)) {
				if (!pathItem || typeof pathItem !== "object") continue;

				if (!(pathItem as Record<string, OpenApiValue>).$ref) continue;

				if (resolvedWebhookPaths.has(pathKey)) continue;

				const resolved = this.resolveReference<PathItem>(
					(pathItem as Record<string, OpenApiValue>).$ref as string,
					this.documentUri,
				);

				if (resolved) {
					recordFromPathItem(resolved, pathKey, "webhooks: ");
				}
			}
		}

		for (const [operationId, locations] of operationIdLocations.entries()) {
			if (locations.length > 1) {
				const message = `Duplicate operationId "${operationId}" found in multiple operations: ${locations.join(
					", ",
				)}`;
				let error: Error;

				try {
					const candidate = new SpecValidationError(message);

					error =
						candidate instanceof Error && candidate.message
							? candidate
							: Object.assign(new Error(message), {
									name: "SpecValidationError",
								});
				} catch {
					error = Object.assign(new Error(message), {
						name: "SpecValidationError",
					});
				}

				throw error;
			}
		}
	}
}
