/**
 * Reverse-parses generated SDK metadata files and assembles OpenAPI components, security, headers, links, callbacks, and webhooks.
 *
 * @module openapi/emitters/assemble_components
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
	ExampleObject,
	ExternalDocumentationObject,
	HeaderObject,
	InfoObject,
	LinkObject,
	MediaTypeObject,
	OpenApiValue,
	Parameter,
	PathItem,
	ReferenceObject,
	RequestBody,
	SecurityScheme,
	ServerObject,
	SwaggerResponse,
	SwaggerSpec,
	TagObject,
	XmlObject,
} from "../../core/types/index.js";
import { applyWebhooksAndCallbacks } from "./assemble_webhooks_callbacks.js";

/** Reverse Callback Meta */
export interface ReverseCallbackMeta {
	/** doc */
	name: string;
	/** doc */
	method: string;
	/** doc */
	interfaceName?: string;
	/** doc */
	expression?: string;
	/** doc */
	pathItem?: PathItem;
	/** doc */
	scope?: "component" | "operation";
}

/** Reverse Webhook Meta */
export interface ReverseWebhookMeta {
	/** doc */
	name: string;
	/** doc */
	method: string;
	/** doc */
	interfaceName?: string;
	/** doc */
	pathItem?: PathItem;
	/** doc */
	scope?: "root" | "component";
}

/** Document-level OpenAPI metadata parsed from `document.ts`. */
export interface ReverseDocumentMeta {
	/** OpenAPI 3.x version string. */
	openapi?: string;
	/** Swagger 2.0 version string. */
	swagger?: string;
	/** Document `$self` base URI (OAS 3.2). */
	$self?: string;
	/** Default JSON Schema dialect URI (OAS 3.1+). */
	jsonSchemaDialect?: string;
	/** Top-level specification extensions (`x-*`). */
	extensions?: Record<string, OpenApiValue>;
}

/** Reverse Metadata */
export interface ReverseMetadata {
	/** doc */
	info?: InfoObject;
	/** doc */
	tags?: TagObject[];
	/** doc */
	externalDocs?: ExternalDocumentationObject;
	/** doc */
	inferredSelf?: string;
	/** Document-level OpenAPI version, dialect, and extension metadata. */
	documentMeta?: ReverseDocumentMeta;
	/** Parsed server definitions from `servers.ts`. */
	servers?: ServerObject[];
	/** Parsed security schemes from `security.ts`. */
	securitySchemes?: Record<string, SecurityScheme>;
	/** Parsed global security requirements from `security.ts`. */
	securityRequirements?: Record<string, string[]>[];
	/** Parsed response header type hints from `response-headers.ts`. */
	responseHeaders?: Record<string, Record<string, Record<string, string>>>;
	/** Parsed full response header objects from `response-headers.ts`. */
	responseHeaderObjects?: Record<
		string,
		Record<string, Record<string, HeaderObject | ReferenceObject>>
	>;
	/** Parsed XML header configurations from `response-headers.ts`. */
	headerXmlConfigs?: Record<string, XmlObject>;
	/** Parsed operation links from `links.ts`. */
	links?: Record<string, Record<string, Record<string, LinkObject>>>;
	/** Parsed reusable component links from `links.ts`. */
	componentLinks?: Record<string, LinkObject>;
	/** Parsed callbacks metadata from `callbacks.ts`. */
	callbacks?: ReverseCallbackMeta[];
	/** Parsed webhooks metadata from `webhooks.ts`. */
	webhooks?: ReverseWebhookMeta[];
	/** Parsed reusable examples from `examples.ts`. */
	examples?: Record<string, ExampleObject>;
	/** Parsed reusable media types from `media-types.ts`. */
	mediaTypes?: Record<string, MediaTypeObject>;
	/** Parsed reusable path items from `path-items.ts`. */
	pathItems?: Record<string, PathItem>;
	/** Parsed reusable parameters from `parameters.ts`. */
	parameters?: Record<string, Parameter>;
	/** Parsed reusable headers from `headers.ts`. */
	headers?: Record<string, HeaderObject>;
	/** Parsed reusable request bodies from `request-bodies.ts`. */
	requestBodies?: Record<string, RequestBody>;
	/** Parsed reusable responses from `responses.ts`. */
	responses?: Record<string, SwaggerResponse>;
	/** Parsed path items from `paths.ts`. */
	paths?: Record<string, PathItem>;
}

/** File status entry returned by `ReverseMetadataFileSystem.statSync`. */
export interface ReverseMetadataFileStat {
	/**
	 * Returns `true` if the path is a regular file.
	 * @returns `true` if file.
	 */
	isFile(): boolean;
}

/** File system adapter for `parseGeneratedMetadata`. */
export interface ReverseMetadataFileSystem {
	/**
	 * Synchronously inspects file status.
	 * @param filePath - Path to inspect.
	 * @returns File status entry.
	 */
	statSync(filePath: string): ReverseMetadataFileStat;
	/**
	 * Optional existence check.
	 * @param filePath - Path to check.
	 * @returns `true` if path exists.
	 */
	existsSync?(filePath: string): boolean;
	/**
	 * Synchronously reads a UTF-8 file.
	 * @param filePath - Path to read.
	 * @param encoding - Text encoding string.
	 * @returns File contents string.
	 */
	readFileSync(filePath: string, encoding: BufferEncoding): string;
}

/**
 * Parses generated SDK utility metadata files (`info.ts`, `security.ts`, `servers.ts`, `document.ts`, etc.) from a directory.
 *
 * @param inputPath - Directory containing generated SDK utility files.
 * @param fileSystem - File system adapter.
 * @returns Extracted `ReverseMetadata` object.
 */
export function parseGeneratedMetadata(
	inputPath: string,
	fileSystem: ReverseMetadataFileSystem,
): ReverseMetadata {
	const meta: ReverseMetadata = {};

	const readMetadataFile = (filePath: string): string | undefined => {
		try {
			if (!fileSystem.statSync(filePath).isFile()) return undefined;
			return fileSystem.readFileSync(filePath, "utf-8");
		} catch {
			return undefined;
		}
	};

	const parseExportedJson = (rawLiteral: string): OpenApiValue | undefined => {
		try {
			return JSON.parse(rawLiteral) as OpenApiValue;
		} catch {
			return undefined;
		}
	};

	const tryParse = (
		filename: string,
		key: keyof ReverseMetadata,
		varName: string,
	) => {
		const p = path.join(inputPath, filename);
		const content = readMetadataFile(p);
		if (!content) return;

		const bs = String.fromCharCode(92);
		const regex = new RegExp(
			`export const ${varName}(?:[^=]*)=${bs}s*([^;]+);?`,
		);
		const m = regex.exec(content);
		if (!m?.[1]) return;

		const parsed = parseExportedJson(m[1]);
		if (parsed !== undefined) {
			(meta as Record<string, OpenApiValue>)[key] = parsed;
		}
	};

	tryParse("info.ts", "info", "API_INFO");
	tryParse("info.ts", "tags", "API_TAGS");
	tryParse("info.ts", "externalDocs", "API_EXTERNAL_DOCS");
	tryParse("security.ts", "securitySchemes", "API_SECURITY_SCHEMES");
	tryParse("security.ts", "securityRequirements", "API_SECURITY_REQUIREMENTS");
	tryParse("servers.ts", "servers", "API_SERVERS");
	tryParse("document.ts", "documentMeta", "API_DOCUMENT_META");
	tryParse("response-headers.ts", "responseHeaders", "API_RESPONSE_HEADERS");
	tryParse(
		"response-headers.ts",
		"responseHeaderObjects",
		"API_RESPONSE_HEADER_OBJECTS",
	);
	tryParse("response-headers.ts", "headerXmlConfigs", "API_HEADER_XML_CONFIGS");
	tryParse("links.ts", "links", "API_LINKS");
	tryParse("links.ts", "componentLinks", "API_COMPONENT_LINKS");
	tryParse("callbacks.ts", "callbacks", "API_CALLBACKS");
	tryParse("webhooks.ts", "webhooks", "API_WEBHOOKS");
	tryParse("examples.ts", "examples", "API_EXAMPLES");
	tryParse("media-types.ts", "mediaTypes", "API_MEDIA_TYPES");
	tryParse("path-items.ts", "pathItems", "API_PATH_ITEMS");
	tryParse("parameters.ts", "parameters", "API_PARAMETERS");
	tryParse("headers.ts", "headers", "API_HEADERS");
	tryParse("request-bodies.ts", "requestBodies", "API_REQUEST_BODIES");
	tryParse("responses.ts", "responses", "API_RESPONSES");
	tryParse("paths.ts", "paths", "API_PATHS");

	meta.inferredSelf = pathToFileURL(
		path.resolve(inputPath, "openapi.yaml"),
	).href;

	return meta;
}

/**
 * Applies extracted `ReverseMetadata` (document metadata, info, tags, servers, security, and components) onto `spec`.
 *
 * @param spec - Base `SwaggerSpec` object.
 * @param metadata - Extracted `ReverseMetadata` to apply.
 * @returns Cloned `SwaggerSpec` with components and document metadata applied.
 */
export function applyComponentsAndMetadata(
	spec: SwaggerSpec,
	metadata: ReverseMetadata,
): SwaggerSpec {
	const out = { ...spec };

	if (metadata.documentMeta) {
		if (metadata.documentMeta.openapi) {
			out.openapi = metadata.documentMeta.openapi;
			delete out.swagger;
		}

		if (metadata.documentMeta.swagger) {
			out.swagger = metadata.documentMeta.swagger;
			delete out.openapi;
			delete out.jsonSchemaDialect;
		}

		if (metadata.documentMeta.$self) out.$self = metadata.documentMeta.$self;

		if (
			metadata.documentMeta.jsonSchemaDialect &&
			!metadata.documentMeta.swagger
		)
			out.jsonSchemaDialect = metadata.documentMeta.jsonSchemaDialect;

		if (metadata.documentMeta.extensions)
			Object.assign(out, metadata.documentMeta.extensions);
	} else if (metadata.inferredSelf) {
		out.$self = metadata.inferredSelf;
	}

	if (metadata.info) out.info = Object.assign({}, out.info, metadata.info);
	if (metadata.tags) out.tags = metadata.tags;
	if (metadata.externalDocs) out.externalDocs = metadata.externalDocs;
	if (metadata.servers) out.servers = metadata.servers;
	if (metadata.securityRequirements)
		out.security = metadata.securityRequirements;

	if (
		metadata.securitySchemes ||
		metadata.responseHeaderObjects ||
		metadata.componentLinks ||
		metadata.examples ||
		metadata.mediaTypes ||
		metadata.pathItems ||
		metadata.parameters ||
		metadata.requestBodies ||
		metadata.responses ||
		metadata.headers ||
		metadata.callbacks ||
		metadata.headerXmlConfigs ||
		metadata.webhooks
	) {
		out.components = out.components || {};
		const components = out.components;

		if (metadata.securitySchemes)
			components.securitySchemes = metadata.securitySchemes;

		if (metadata.headerXmlConfigs) {
			components.headers = components.headers || {};
			const headers = components.headers;

			Object.entries(metadata.headerXmlConfigs).forEach(([key, config]) => {
				headers[key] = {
					content: {
						"application/xml": {
							schema: {
								xml: config as XmlObject,
							},
						},
					},
				} as HeaderObject;
			});
		}

		applyWebhooksAndCallbacks(out, metadata);

		if (metadata.componentLinks) out.components.links = metadata.componentLinks;
		if (metadata.examples) out.components.examples = metadata.examples;
		if (metadata.mediaTypes) out.components.mediaTypes = metadata.mediaTypes;
		if (metadata.pathItems) out.components.pathItems = metadata.pathItems;
		if (metadata.parameters) out.components.parameters = metadata.parameters;
		if (metadata.requestBodies)
			out.components.requestBodies = metadata.requestBodies;
		if (metadata.responses) out.components.responses = metadata.responses;

		if (metadata.headers) {
			out.components.headers = {
				...out.components.headers,
				...metadata.headers,
			};
		}
	}

	return out;
}
