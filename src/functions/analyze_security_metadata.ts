/**
 * Analyzes OpenAPI operation security requirements, server overrides, JSDoc metadata, media types, and XML/encoding/decoding configurations.
 *
 * @module functions/analyze_security_metadata
 */
import type {
	EncodingProperty,
	MediaTypeObject,
	OpenApiValue,
	PathInfo,
	ServerObject,
	SwaggerDefinition,
} from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { sanitizeComment } from "./utils.js";

/**
 * Normalizes a MIME media type by stripping parameters and converting to lowercase.
 *
 * @param mediaType - Raw media type string.
 * @returns Normalized media type string.
 */
export function normalizeMediaType(mediaType: string): string {
	return (mediaType.split(";")[0] as string).trim().toLowerCase();
}

/**
 * Computes specificity rank for a normalized media type (`0` = wildcard, `1` = subtype wildcard, `2` = exact).
 *
 * @param normalized - Normalized media type string.
 * @returns Specificity score (`0`, `1`, or `2`).
 */
export function getMediaTypeSpecificity(normalized: string): number {
	const [type, subtype] = normalized.split("/");
	if (!type || !subtype || (type === "*" && subtype === "*")) return 0;
	if (subtype === "*") return 1;
	return 2;
}

/**
 * Returns preference order for a normalized media type (lower is higher priority).
 *
 * @param normalized - Normalized media type string.
 * @returns Numeric preference rank.
 */
export function getMediaTypePreference(normalized: string): number {
	if (normalized === "application/json") return 0;
	if (
		normalized === "application/json-seq" ||
		normalized.endsWith("+json-seq") ||
		normalized === "application/jsonl" ||
		normalized === "application/x-ndjson"
	) {
		return 1;
	}
	if (normalized.endsWith("+json")) return 2;
	if (normalized === "application/xml") return 3;
	if (normalized.endsWith("+xml")) return 4;
	if (normalized === "text/plain") return 5;
	if (normalized.startsWith("text/")) return 6;
	if (normalized === "application/x-www-form-urlencoded") return 7;
	if (normalized.startsWith("multipart/")) return 8;
	if (normalized === "*/*") return 99;
	return 50;
}

/**
 * Checks whether a normalized media type is JSON-compatible.
 *
 * @param mediaType - Normalized media type string.
 * @returns `true` if JSON-compatible.
 */
export function isJsonMediaType(mediaType: string): boolean {
	return mediaType === "*/*" || mediaType.includes("json");
}

/**
 * Checks whether a normalized media type is XML-compatible.
 *
 * @param mediaType - Normalized media type string.
 * @returns `true` if XML-compatible.
 */
export function isXmlMediaType(mediaType: string): boolean {
	return mediaType.endsWith("+xml") || mediaType.includes("/xml");
}

/**
 * Checks whether a normalized media type is `text/*`.
 *
 * @param mediaType - Normalized media type string.
 * @returns `true` if text media type.
 */
export function isTextMediaType(mediaType: string): boolean {
	return mediaType.startsWith("text/");
}

/**
 * Checks whether a normalized media type is `application/x-www-form-urlencoded`.
 *
 * @param mediaType - Normalized media type string.
 * @returns `true` if form URL-encoded.
 */
export function isFormUrlEncodedMediaType(mediaType: string): boolean {
	return mediaType === "application/x-www-form-urlencoded";
}

/**
 * Checks whether a normalized media type is `multipart/*`.
 *
 * @param mediaType - Normalized media type string.
 * @returns `true` if multipart media type.
 */
export function isMultipartMediaType(mediaType: string): boolean {
	return mediaType.startsWith("multipart/");
}

/**
 * Returns the sequential JSON streaming kind (`"json-lines"` or `"json-seq"`) for a media type if applicable.
 *
 * @param mediaType - Normalized media type string.
 * @returns Sequential JSON kind or `undefined`.
 */
export function getSequentialJsonKind(
	mediaType: string,
): "json-lines" | "json-seq" | undefined {
	if (mediaType === "application/json-seq" || mediaType.endsWith("+json-seq"))
		return "json-seq";
	if (mediaType === "application/jsonl" || mediaType === "application/x-ndjson")
		return "json-lines";
	return undefined;
}

/**
 * Infers sequential JSON streaming kind from a normalized media type and optional `itemSchema`.
 *
 * @param normalizedMediaType - Normalized media type string.
 * @param mediaObj - Optional `MediaTypeObject`.
 * @returns Sequential JSON kind or `undefined`.
 */
export function inferSequentialJsonKind(
	normalizedMediaType: string,
	mediaObj?: MediaTypeObject,
): "json-lines" | "json-seq" | undefined {
	const known = getSequentialJsonKind(normalizedMediaType);
	if (known) return known;
	if (!mediaObj || mediaObj.itemSchema === undefined) return undefined;
	if (!isJsonMediaType(normalizedMediaType)) return undefined;
	if (
		normalizedMediaType === "application/json" ||
		normalizedMediaType === "*/*"
	)
		return undefined;
	return "json-lines";
}

/**
 * Checks whether a normalized media type represents a binary payload (`image/*`, `audio/*`, `video/*`, `application/octet-stream`, `application/pdf`).
 *
 * @param mediaType - Normalized media type string.
 * @returns `true` if binary media type.
 */
export function isBinaryMediaType(mediaType: string): boolean {
	return (
		mediaType.startsWith("image/") ||
		mediaType.startsWith("audio/") ||
		mediaType.startsWith("video/") ||
		mediaType === "application/octet-stream" ||
		mediaType === "application/pdf" ||
		mediaType.endsWith("+octet-stream")
	);
}

/**
 * Checks whether a schema definition requires a `*Request` variant due to `readOnly` or `writeOnly` properties.
 *
 * @param definition - OpenAPI schema definition.
 * @returns `true` if a `*Request` variant is needed.
 */
export function needsRequestType(definition: SwaggerDefinition): boolean {
	if (!definition.properties) return false;
	const properties = Object.values(definition.properties).filter(
		(p) => p !== null && typeof p === "object",
	) as SwaggerDefinition[];
	return properties.some((p) => p.readOnly || p.writeOnly);
}

/**
 * Enriches an encoding map entry with default `contentType: "application/json"` for objects/arrays and `Content-Transfer-Encoding` headers.
 *
 * @param parser - Parsed OpenAPI specification.
 * @param propSchema - Property schema definition.
 * @param configMap - Target encoding property map to mutate.
 * @param key - Property key in `configMap`.
 */
export function enrichEncodingConfig(
	parser: SwaggerParser,
	propSchema: SwaggerDefinition | boolean,
	configMap: Record<string, EncodingProperty>,
	key: string,
): void {
	const resolvedProp = parser.resolve(propSchema as SwaggerDefinition);
	if (!resolvedProp || typeof resolvedProp !== "object") return;

	let entry = configMap[key];
	if (!entry) {
		entry = {};
		configMap[key] = entry;
	}

	if (!entry.contentType) {
		if (resolvedProp.type === "object" || resolvedProp.type === "array") {
			entry.contentType = "application/json";
		}
	}

	if (resolvedProp.contentEncoding) {
		if (!entry.headers) {
			entry.headers = {};
		}
		const headers = entry.headers as Record<string, OpenApiValue>;
		const hasTransferHeader = Object.keys(headers).some(
			(h) => h.toLowerCase() === "content-transfer-encoding",
		);
		if (!hasTransferHeader) {
			headers["Content-Transfer-Encoding"] = resolvedProp.contentEncoding;
		}
	}
}

/**
 * Recursively builds an XML serialization/deserialization configuration tree from a schema definition.
 *
 * @param parser - Parsed OpenAPI specification.
 * @param schema - OpenAPI schema definition.
 * @param depth - Maximum recursion depth.
 * @returns XML configuration object.
 */
export function getXmlConfig(
	parser: SwaggerParser,
	schema: SwaggerDefinition | boolean | undefined,
	depth: number,
): Record<string, OpenApiValue> {
	if (!schema || typeof schema !== "object" || depth <= 0) return {};

	const resolved = parser.resolve(schema as SwaggerDefinition);
	if (!resolved) return {};

	const config: Record<string, OpenApiValue> = {};

	if (resolved.xml?.name) config.name = resolved.xml.name;
	if (resolved.xml?.attribute) config.attribute = true;
	if (resolved.xml?.wrapped) config.wrapped = true;
	if (resolved.xml?.prefix) config.prefix = resolved.xml.prefix;
	if (resolved.xml?.namespace) config.namespace = resolved.xml.namespace;

	if (resolved.xml?.nodeType) {
		config.nodeType = resolved.xml.nodeType;
	} else if (resolved.xml?.wrapped) {
		config.nodeType = "element";
	} else {
		const isRef =
			!!(schema as Record<string, OpenApiValue>).$ref ||
			!!(schema as Record<string, OpenApiValue>).$dynamicRef;
		const isArray = resolved.type === "array";
		if (isRef || isArray) {
			config.nodeType = "none";
		} else {
			config.nodeType = "element";
		}
	}

	if (resolved.type === "array" && resolved.items) {
		config.items = getXmlConfig(
			parser,
			resolved.items as SwaggerDefinition,
			depth - 1,
		);
	}

	if (Array.isArray(resolved.prefixItems)) {
		config.prefixItems = resolved.prefixItems.map((item) =>
			getXmlConfig(parser, item as SwaggerDefinition, depth - 1),
		);
	}

	if (resolved.properties) {
		config.properties = {};
		Object.entries(resolved.properties).forEach(([propName, propSchema]) => {
			const propConfig = getXmlConfig(
				parser,
				propSchema as SwaggerDefinition | boolean,
				depth - 1,
			);
			if (Object.keys(propConfig).length > 0) {
				(config.properties as Record<string, OpenApiValue>)[propName] =
					propConfig;
			}
		});
	}

	if (resolved.allOf) {
		resolved.allOf.forEach((sub) => {
			const subConfig = getXmlConfig(
				parser,
				sub as SwaggerDefinition | boolean,
				depth - 1,
			);
			if (subConfig.properties) {
				config.properties = {
					...(config.properties as Record<string, OpenApiValue>),
					...(subConfig.properties as Record<string, OpenApiValue>),
				};
			}
		});
	}

	return config;
}

/**
 * Recursively builds a `ContentDecoder` configuration tree for `contentEncoding` / `contentSchema` properties.
 *
 * @param parser - Parsed OpenAPI specification.
 * @param schema - OpenAPI schema definition.
 * @param depth - Maximum recursion depth.
 * @returns Decoding configuration object.
 */
export function getDecodingConfig(
	parser: SwaggerParser,
	schema: SwaggerDefinition | boolean | undefined,
	depth: number = 5,
): Record<string, OpenApiValue> {
	if (!schema || typeof schema !== "object" || depth <= 0) return {};

	const resolved = parser.resolve(schema as SwaggerDefinition);
	if (!resolved) return {};

	const config: Record<string, OpenApiValue> = {};

	if (resolved.contentEncoding) {
		config.contentEncoding = resolved.contentEncoding;
	}

	if (resolved.contentSchema && resolved.type === "string") {
		if (resolved.contentMediaType?.includes("xml")) {
			config.decode = "xml";
			config.xmlConfig = getXmlConfig(
				parser,
				resolved.contentSchema as SwaggerDefinition | boolean,
				5,
			);
		} else {
			config.decode = true;
		}
		return config;
	}

	if (resolved.type === "array" && resolved.items) {
		const itemConfig = getDecodingConfig(
			parser,
			resolved.items as SwaggerDefinition,
			depth - 1,
		);
		if (Object.keys(itemConfig).length > 0) {
			config.items = itemConfig;
		}
	}

	if (resolved.properties) {
		const propConfigs: Record<string, OpenApiValue> = {};
		Object.entries(resolved.properties).forEach(([propName, propSchema]) => {
			const pConfig = getDecodingConfig(
				parser,
				propSchema as SwaggerDefinition | boolean,
				depth - 1,
			);
			if (Object.keys(pConfig).length > 0) {
				propConfigs[propName] = pConfig;
			}
		});
		if (Object.keys(propConfigs).length > 0) {
			config.properties = propConfigs;
		}
	}

	if (resolved.allOf) {
		resolved.allOf.forEach((sub) => {
			const subConfig = getDecodingConfig(
				parser,
				sub as SwaggerDefinition | boolean,
				depth - 1,
			);
			if (subConfig.properties) {
				config.properties = {
					...((config.properties as Record<string, OpenApiValue>) || {}),
					...(subConfig.properties as Record<string, OpenApiValue>),
				};
			}
		});
	}

	return config;
}

/**
 * Determines whether a Server-Sent Events (`text/event-stream`) schema represents a full SSE event envelope (`"event"`) or raw `"data"`.
 *
 * @param parser - Parsed OpenAPI specification.
 * @param schema - SSE item schema.
 * @returns `"event"` or `"data"`.
 */
export function getSseMode(
	parser: SwaggerParser,
	schema: SwaggerDefinition | boolean | undefined,
): "event" | "data" {
	const hasDataProperty = (
		node: SwaggerDefinition | boolean | undefined,
	): boolean => {
		if (!node || typeof node !== "object") return false;
		const resolvedNode = parser.resolve(
			node as SwaggerDefinition,
		) as SwaggerDefinition;

		const props = resolvedNode.properties;
		if (props && Object.hasOwn(props, "data")) return true;

		const composites = [
			...(resolvedNode.allOf ?? []),
			...(resolvedNode.anyOf ?? []),
			...(resolvedNode.oneOf ?? []),
		];
		return composites.some((sub) =>
			hasDataProperty(sub as SwaggerDefinition | boolean),
		);
	};

	return hasDataProperty(schema) ? "event" : "data";
}

/**
 * Recursively builds a `ContentEncoder` configuration tree for `contentMediaType` / `contentEncoding` properties.
 *
 * @param parser - Parsed OpenAPI specification.
 * @param schema - OpenAPI schema definition.
 * @param depth - Maximum recursion depth.
 * @returns Encoding configuration object.
 */
export function getEncodingConfig(
	parser: SwaggerParser,
	schema: SwaggerDefinition | boolean | undefined,
	depth: number = 5,
): Record<string, OpenApiValue> {
	if (!schema || typeof schema !== "object" || depth <= 0) return {};

	const resolved = parser.resolve(schema as SwaggerDefinition);
	if (!resolved) return {};

	const config: Record<string, OpenApiValue> = {};

	if (resolved.contentMediaType) {
		config.contentMediaType = resolved.contentMediaType;
	}

	if (resolved.contentEncoding) {
		config.contentEncoding = resolved.contentEncoding;
	}

	if (
		resolved.type === "string" &&
		resolved.contentMediaType &&
		resolved.contentMediaType.includes("json")
	) {
		config.encode = true;
		return config;
	}

	if (resolved.type === "array" && resolved.items) {
		const itemConfig = getEncodingConfig(
			parser,
			resolved.items as SwaggerDefinition,
			depth - 1,
		);
		if (Object.keys(itemConfig).length > 0) {
			config.items = itemConfig;
		}
	}

	if (resolved.properties) {
		const propConfigs: Record<string, OpenApiValue> = {};
		Object.entries(resolved.properties).forEach(([propName, propSchema]) => {
			const pConfig = getEncodingConfig(
				parser,
				propSchema as SwaggerDefinition | boolean,
				depth - 1,
			);
			if (Object.keys(pConfig).length > 0) {
				propConfigs[propName] = pConfig;
			}
		});
		if (Object.keys(propConfigs).length > 0) {
			config.properties = propConfigs;
		}
	}

	if (resolved.allOf) {
		resolved.allOf.forEach((sub) => {
			const subConfig = getEncodingConfig(
				parser,
				sub as SwaggerDefinition | boolean,
				depth - 1,
			);
			if (subConfig.properties) {
				config.properties = {
					...((config.properties as Record<string, OpenApiValue>) || {}),
					...(subConfig.properties as Record<string, OpenApiValue>),
				};
			}
		});
	}

	return config;
}

/** Security, extension, server, and JSDoc metadata analyzed for an operation. */
export interface AnalyzedSecurityAndMetadata {
	/** Effective security requirement objects. */
	effectiveSecurity: Record<string, string[]>[];
	/** Operation-level `x-*` specification extensions. */
	extensions: Record<string, OpenApiValue>;
	/** Resolved operation-level base URL path. */
	basePath?: string;
	/** Operation-level server overrides. */
	operationServers?: ServerObject[];
	/** Formatted JSDoc description and tag text. */
	docText: string;
}

/**
 * Analyzes security requirements, specification extensions, server overrides, and formatted JSDoc text for an operation.
 *
 * @param operation - Parsed OpenAPI `PathInfo` operation.
 * @param parser - Parsed OpenAPI specification.
 * @returns Security, extensions, server overrides, and JSDoc metadata.
 */
export function analyzeSecurityAndMetadata(
	operation: PathInfo,
	parser: SwaggerParser,
): AnalyzedSecurityAndMetadata {
	const nl = String.fromCharCode(10);
	const specSecurity = parser.getSpec().security;
	const opSecurity = operation.security;
	const effectiveSecurity =
		opSecurity !== undefined ? opSecurity : specSecurity || [];

	const extensions: Record<string, OpenApiValue> = {};
	Object.keys(operation).forEach((key) => {
		if (key.startsWith("x-")) {
			extensions[key] = (operation as Record<string, OpenApiValue>)[key];
		}
	});

	let basePath: string | undefined;
	const operationServers =
		operation.servers && operation.servers.length > 0
			? operation.servers
			: undefined;

	const firstServer = operationServers?.[0];
	if (firstServer) {
		let resolvedUrl = firstServer.url;
		if (firstServer.variables) {
			Object.entries(firstServer.variables).forEach(([key, variable]) => {
				resolvedUrl = resolvedUrl.replace(`{${key}}`, variable.default);
			});
		}
		basePath = resolvedUrl;
	}

	const rawDescription = operation.description || "";
	const rawSummary = operation.summary || "";
	let docText =
		(rawSummary ||
			rawDescription ||
			`Performs a ${operation.method} request to ${operation.path}.`) +
		(rawDescription && rawSummary ? `${nl}${nl}${rawDescription}` : "");

	docText = sanitizeComment(docText);

	if (operation.externalDocs?.url) {
		const cleanDesc = sanitizeComment(operation.externalDocs.description || "");
		docText +=
			`${nl}${nl}@see ${operation.externalDocs.url} ${cleanDesc}`.trimEnd();
	}

	if (operation.tags && operation.tags.length > 0) {
		const tagList = operation.tags
			.map((tag) => sanitizeComment(tag))
			.filter(Boolean);
		docText += `${nl}${nl}@tags ${tagList.join(", ")}`;
	}

	if (operation.servers && operation.servers.length > 0) {
		operation.servers.forEach((server) => {
			docText += `${nl}${nl}@server ${JSON.stringify(server)}`;
		});
	}

	if (opSecurity && opSecurity.length > 0) {
		docText += `${nl}${nl}@security ${JSON.stringify(opSecurity)}`;
	}

	if (Object.keys(extensions).length > 0) {
		Object.entries(extensions).forEach(([key, value]) => {
			docText += `${nl}${nl}@${key} ${JSON.stringify(value)}`;
		});
	}

	if (operation.deprecated) {
		docText += `${nl}${nl}@deprecated`;
	}

	return {
		effectiveSecurity,
		extensions,
		...(basePath !== undefined ? { basePath } : {}),
		...(operationServers ? { operationServers } : {}),
		docText,
	};
}
