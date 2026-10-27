/**
 * Loads, caches, indexes, and validates OpenAPI/Swagger documents and external `$ref` files.
 *
 * @module openapi/parse_spec_loader
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import * as yaml from "js-yaml";

import type { OpenApiValue, SwaggerSpec } from "../core/types/index.js";
import { isUrl } from "../functions/utils.js";
import { ReferenceResolver } from "./parse_reference_resolver.js";
import { validateSpec } from "./parse_validator.js";

/**
 * Result bundle returned when loading an entry OpenAPI/Swagger specification and its `$ref` cache.
 */
export interface LoadedSpecBundle {
	/** Parsed root specification object. */
	entrySpec: SwaggerSpec;
	/** Cache of all loaded specification documents keyed by canonical URI. */
	cache: Map<string, SwaggerSpec>;
	/** Canonical URI of the entry specification document. */
	documentUri: string;
}

/**
 * Loads OpenAPI/Swagger specifications (synchronously or asynchronously) along with referenced external files.
 */
export class SpecLoader {
	/**
	 * Synchronously loads an OpenAPI/Swagger specification and its local `$ref` dependencies from disk.
	 *
	 * @param inputPath - Local file path to the entry OpenAPI/Swagger specification.
	 * @returns Object containing `entrySpec`, `cache`, and `documentUri`.
	 * @throws {Error} When the file cannot be read, parsed, or fails specification validation.
	 */
	public static loadSync(inputPath: string): LoadedSpecBundle {
		const documentUri = isUrl(inputPath)
			? inputPath
			: pathToFileURL(path.resolve(process.cwd(), inputPath)).href;

		const cache = new Map<string, SwaggerSpec>();
		SpecLoader.loadAndCacheSpecRecursiveSync(
			documentUri,
			cache,
			new Set<string>(),
		);

		return SpecLoader.finalizeLoadedBundle(documentUri, cache);
	}

	private static indexAndCollectExternalRefs(
		uri: string,
		spec: SwaggerSpec,
		cache: Map<string, SwaggerSpec>,
	): { baseUri: string; fileRefs: Set<string> } {
		cache.set(uri, spec);

		const baseUri = spec.$self ? new URL(spec.$self, uri).href : uri;

		if (baseUri !== uri) {
			cache.set(baseUri, spec);
		}

		ReferenceResolver.indexSchemaIds(spec, baseUri, cache, uri);

		const refs = ReferenceResolver.findRefs(spec);
		const operationRefs = SpecLoader.findOperationRefs(spec);
		const fileRefs = new Set<string>();

		refs.forEach((ref) => {
			const [filePath] = ref.split("#", 2);
			if (filePath) fileRefs.add(filePath);
		});

		operationRefs.forEach((ref) => {
			const [filePath] = ref.split("#", 2);
			if (filePath) fileRefs.add(filePath);
		});

		return { baseUri, fileRefs };
	}

	private static finalizeLoadedBundle(
		documentUri: string,
		cache: Map<string, SwaggerSpec>,
	): LoadedSpecBundle {
		const entrySpec = cache.get(documentUri);

		if (!entrySpec) {
			throw new Error(`Failed to load entry spec from ${documentUri}`);
		}

		const validated = new Set<SwaggerSpec>();

		for (const doc of cache.values()) {
			if (!SpecLoader.isOpenApiOrSwaggerDoc(doc)) continue;

			if (validated.has(doc)) continue;

			validateSpec(doc);

			validated.add(doc);
		}

		SpecLoader.validateOperationIdsAcrossDocuments(cache);

		return { entrySpec, cache, documentUri };
	}

	private static loadAndCacheSpecRecursiveSync(
		uri: string,
		cache: Map<string, SwaggerSpec>,
		visited: Set<string>,
	): void {
		if (visited.has(uri) || cache.has(uri)) return;
		visited.add(uri);

		const content = SpecLoader.loadContentSync(uri);
		const spec = SpecLoader.parseSpecContent(content, uri);
		const { baseUri, fileRefs } = SpecLoader.indexAndCollectExternalRefs(
			uri,
			spec,
			cache,
		);

		for (const filePath of fileRefs) {
			try {
				const nextUri = new URL(filePath, baseUri).href;
				SpecLoader.loadAndCacheSpecRecursiveSync(nextUri, cache, visited);
			} catch (_e) {
				console.warn(
					`[SpecLoader] Failed to resolve referenced URI: ${filePath}. Skipping.`,
				);
			}
		}
	}

	private static loadContentSync(pathOrUrl: string): string {
		try {
			if (isUrl(pathOrUrl) && !pathOrUrl.startsWith("file:")) {
				throw new Error("Synchronous fetch is not supported");
			}
			const filePath = new URL(pathOrUrl).pathname;
			if (!fs.existsSync(filePath))
				throw new Error(`Input file not found at ${filePath}`);
			return fs.readFileSync(filePath, "utf8");
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			throw new Error(`Failed to read content from "${pathOrUrl}": ${message}`);
		}
	}

	/**
	 * Asynchronously loads an OpenAPI/Swagger specification and its local or remote `$ref` dependencies.
	 *
	 * @param inputPath - File path or URL to the entry OpenAPI/Swagger specification.
	 * @returns Promise resolving to `{ entrySpec, cache, documentUri }`.
	 * @throws {Error} When the specification cannot be fetched, read, parsed, or fails validation.
	 */
	public static async load(inputPath: string): Promise<LoadedSpecBundle> {
		const documentUri = isUrl(inputPath)
			? inputPath
			: pathToFileURL(path.resolve(process.cwd(), inputPath)).href;

		const cache = new Map<string, SwaggerSpec>();

		await SpecLoader.loadAndCacheSpecRecursive(
			documentUri,
			cache,
			new Set<string>(),
		);

		return SpecLoader.finalizeLoadedBundle(documentUri, cache);
	}

	/**
	 * Recursively loads and caches an OpenAPI/Swagger document and its referenced external documents.
	 *
	 * @param uri - Resolved document URI.
	 * @param cache - Document cache map.
	 * @param visited - Set of already visited URIs.
	 */
	public static async loadAndCacheSpecRecursive(
		uri: string,
		cache: Map<string, SwaggerSpec>,
		visited: Set<string>,
	): Promise<void> {
		if (visited.has(uri) || cache.has(uri)) return;

		visited.add(uri);

		const content = await SpecLoader.loadContent(uri);

		const spec = SpecLoader.parseSpecContent(content, uri);

		const { baseUri, fileRefs } = SpecLoader.indexAndCollectExternalRefs(
			uri,
			spec,
			cache,
		);

		for (const filePath of fileRefs) {
			try {
				const nextUri = new URL(filePath, baseUri).href;

				await SpecLoader.loadAndCacheSpecRecursive(nextUri, cache, visited);
			} catch (_e) {
				console.warn(
					`[SpecLoader] Failed to resolve referenced URI: ${filePath}. Skipping.`,
				);
			}
		}
	}

	private static findOperationRefs(spec: OpenApiValue): string[] {
		const refs = new Set<string>();

		const traverse = (node: OpenApiValue) => {
			if (!node || typeof node !== "object") return;

			const record = node as Record<string, OpenApiValue>;

			if (typeof record.operationRef === "string") {
				refs.add(record.operationRef);
			}

			Object.values(record).forEach((value) => {
				traverse(value);
			});
		};

		traverse(spec);

		return Array.from(refs);
	}

	/**
	 * Loads raw specification content from a local file path, `file://` URL, or remote `http(s)://` URL.
	 *
	 * @param pathOrUrl - File path or URL string.
	 * @returns Raw text content of the specification.
	 */
	public static async loadContent(pathOrUrl: string): Promise<string> {
		try {
			if (isUrl(pathOrUrl) && !pathOrUrl.startsWith("file:")) {
				const response = await fetch(pathOrUrl);

				if (!response.ok)
					throw new Error(
						`Failed to fetch spec from ${pathOrUrl}: ${response.statusText}`,
					);

				return response.text();
			} else {
				const filePath = pathOrUrl.startsWith("file:")
					? new URL(pathOrUrl).pathname
					: pathOrUrl;

				if (!fs.existsSync(filePath))
					throw new Error(`Input file not found at ${filePath}`);

				return fs.readFileSync(filePath, "utf8");
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);

			throw new Error(`Failed to read content from "${pathOrUrl}": ${message}`);
		}
	}

	private static parseSpecContent(
		content: string,
		pathOrUrl: string,
	): SwaggerSpec {
		try {
			const extension = path.extname(pathOrUrl).toLowerCase();

			const isYamlExt = [".yaml", ".yml"].includes(extension);

			const isJsonExt = extension === ".json";

			if (isYamlExt || (!extension && content.trim().startsWith("openapi:"))) {
				return yaml.load(content) as SwaggerSpec;
			} else if (isJsonExt) {
				return JSON.parse(content);
			} else {
				try {
					return JSON.parse(content);
				} catch (_jsonError) {
					return yaml.load(content) as SwaggerSpec;
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);

			throw new Error(
				`Failed to parse content from ${pathOrUrl}. Error: ${message}`,
			);
		}
	}

	private static isOpenApiOrSwaggerDoc(doc: SwaggerSpec): boolean {
		return typeof doc.openapi === "string" || typeof doc.swagger === "string";
	}

	private static validateOperationIdsAcrossDocuments(
		cache: Map<string, SwaggerSpec>,
	): void {
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

		const operationIdLocations = new Map<string, string[]>();

		const seenDocs = new Set<object>();

		const recordOperationId = (operationId: string, location: string) => {
			const existing = operationIdLocations.get(operationId);

			if (existing) {
				existing.push(location);
			} else {
				operationIdLocations.set(operationId, [location]);
			}
		};

		const isRefLike = (value: OpenApiValue): boolean =>
			!!value &&
			typeof value === "object" &&
			("$ref" in (value as object) || "$dynamicRef" in (value as object));

		const collectFromPathItem = (
			pathItem: OpenApiValue,
			pathKey: string,
			prefix: string,
		) => {
			if (!pathItem || typeof pathItem !== "object") return;

			if (isRefLike(pathItem)) return;

			const pi = pathItem as Record<string, OpenApiValue>;

			for (const method of operationKeys) {
				const operation = pi[method] as
					| Record<string, OpenApiValue>
					| undefined;

				if (operation && typeof operation.operationId === "string") {
					recordOperationId(
						operation.operationId,
						`${prefix}${method.toUpperCase()} ${pathKey}`,
					);
				}
			}

			if (pi.additionalOperations) {
				for (const [method, opVal] of Object.entries(
					pi.additionalOperations as Record<string, OpenApiValue>,
				)) {
					const operation = opVal as Record<string, OpenApiValue> | undefined;

					if (operation && typeof operation.operationId === "string") {
						recordOperationId(
							operation.operationId,
							`${prefix}${method} ${pathKey}`,
						);
					}
				}
			}
		};

		const collectFromPaths = (
			paths: Record<string, OpenApiValue> | undefined,
			prefix: string,
		) => {
			if (!paths) return;

			for (const [pathKey, pathItem] of Object.entries(paths)) {
				collectFromPathItem(pathItem, pathKey, prefix);
			}
		};

		const collectFromCallbacks = (
			callbacks: Record<string, OpenApiValue>,
			prefix: string,
		) => {
			for (const [callbackName, callbackObj] of Object.entries(callbacks)) {
				if (
					!callbackObj ||
					typeof callbackObj !== "object" ||
					isRefLike(callbackObj)
				)
					continue;

				for (const [expression, callbackPathItem] of Object.entries(
					callbackObj as Record<string, OpenApiValue>,
				)) {
					collectFromPathItem(
						callbackPathItem,
						expression,
						`${prefix}${callbackName}.`,
					);
				}
			}
		};

		for (const [uri, doc] of cache.entries()) {
			if (seenDocs.has(doc)) continue;

			if (!SpecLoader.isOpenApiOrSwaggerDoc(doc)) continue;

			seenDocs.add(doc);

			const prefix = `${uri}::`;

			const spec = doc as SwaggerSpec;

			collectFromPaths(
				spec.paths as Record<string, OpenApiValue> | undefined,
				`${prefix}paths.`,
			);

			collectFromPaths(
				spec.webhooks as Record<string, OpenApiValue> | undefined,
				`${prefix}webhooks.`,
			);

			const components = spec.components;

			if (components?.pathItems) {
				collectFromPaths(
					components.pathItems as Record<string, OpenApiValue>,
					`${prefix}components.pathItems.`,
				);
			}

			if (components?.webhooks) {
				collectFromPaths(
					components.webhooks as Record<string, OpenApiValue>,
					`${prefix}components.webhooks.`,
				);
			}

			if (components?.callbacks) {
				collectFromCallbacks(
					components.callbacks as Record<string, OpenApiValue>,
					`${prefix}components.callbacks.`,
				);
			}
		}

		for (const [operationId, locations] of operationIdLocations.entries()) {
			if (locations.length > 1) {
				throw new Error(
					`Duplicate operationId "${operationId}" found across OpenAPI documents: ${locations.join(", ")}`,
				);
			}
		}
	}
}
