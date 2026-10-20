/**
 * Analyzes OpenAPI `requestBody` definitions into `BodyVariant` serialization configurations.
 *
 * @module functions/analyze_request_body
 */
import type { OptionalKind, ParameterDeclarationStructure } from "ts-morph";
import type {
	EncodingProperty,
	MediaTypeObject,
	OpenApiValue,
	PathInfo,
	SwaggerDefinition,
} from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import {
	enrichEncodingConfig,
	getEncodingConfig,
	getMediaTypePreference,
	getMediaTypeSpecificity,
	getXmlConfig,
	inferSequentialJsonKind,
	isFormUrlEncodedMediaType,
	isJsonMediaType,
	isTextMediaType,
	isXmlMediaType,
	normalizeMediaType,
} from "./analyze_security_metadata.js";
import type { BodyVariant } from "./types.js";
import { camelCase } from "./utils.js";

/**
 * Selects the highest-priority request body media type from a `content` map.
 *
 * @param content - Request body `content` map.
 * @returns Preferred raw media type key or `undefined`.
 */
export function selectRequestBodyContentType(
	content: Record<string, { schema?: SwaggerDefinition }>,
): string | undefined {
	const entries = Object.keys(content).map((key) => ({
		raw: key,
		normalized: normalizeMediaType(key),
	}));

	entries.sort(
		(a, b) =>
			getMediaTypeSpecificity(b.normalized) -
				getMediaTypeSpecificity(a.normalized) ||
			getMediaTypePreference(a.normalized) -
				getMediaTypePreference(b.normalized),
	);

	return entries[0]?.raw;
}

/**
 * Returns the preferred `Content-Type` header string for an operation's `requestBody`.
 *
 * @param requestBody - OpenAPI `RequestBody` definition.
 * @returns Selected media type string or `undefined`.
 */
export function getRequestBodyContentType(
	requestBody: PathInfo["requestBody"],
): string | undefined {
	if (!requestBody?.content) return undefined;
	return selectRequestBodyContentType(
		requestBody.content as Record<string, { schema?: SwaggerDefinition }>,
	);
}

/** Result of analyzing an operation's `requestBody`. */
export interface AnalyzedRequestBodyResult {
	/** Analyzed request body variant. */
	body?: BodyVariant;
	/** Selected primary `Content-Type` header string. */
	requestContentType?: string;
	/** Optional `ContentEncoder` configuration tree. */
	requestEncodingConfig?: Record<string, OpenApiValue>;
}

/**
 * Analyzes an operation's `requestBody` and `formData` parameters into a `BodyVariant` and optional `requestEncodingConfig`.
 *
 * @param operation - Parsed OpenAPI `PathInfo` operation.
 * @param parameters - Analyzed method parameter declarations.
 * @param parser - Parsed OpenAPI specification.
 * @param analyzeBodyFn - Callback for `analyzeBodyVariant`.
 * @returns Analyzed `body`, `requestContentType`, and `requestEncodingConfig`.
 */
export function analyzeRequestBody(
	operation: PathInfo,
	parameters: OptionalKind<ParameterDeclarationStructure>[],
	parser: SwaggerParser,
	analyzeBodyFn: (
		op: PathInfo,
		params: OptionalKind<ParameterDeclarationStructure>[],
	) => BodyVariant | undefined,
): AnalyzedRequestBodyResult {
	const body = analyzeBodyFn(operation, parameters);
	const requestContentType = getRequestBodyContentType(operation.requestBody);

	let requestEncodingConfig: Record<string, OpenApiValue> | undefined;

	if (
		body &&
		requestContentType &&
		(body.type === "json" ||
			body.type === "json-lines" ||
			body.type === "json-seq" ||
			body.type === "urlencoded")
	) {
		const rbSchema =
			operation.requestBody?.content?.[requestContentType]?.schema;
		if (rbSchema !== undefined) {
			const cfg = getEncodingConfig(parser, rbSchema as SwaggerDefinition);
			if (Object.keys(cfg).length > 0) {
				requestEncodingConfig = cfg;
			}
		}
	}

	return {
		...(body !== undefined ? { body } : {}),
		...(requestContentType !== undefined ? { requestContentType } : {}),
		...(requestEncodingConfig !== undefined ? { requestEncodingConfig } : {}),
	};
}

/**
 * Analyzes an operation's `requestBody` and `formData` parameters into a `BodyVariant`.
 *
 * @param operation - Parsed OpenAPI `PathInfo` operation.
 * @param parameters - Analyzed method parameter declarations.
 * @param parser - Parsed OpenAPI specification.
 * @returns Analyzed `BodyVariant` or `undefined`.
 */
export function analyzeBodyVariant(
	operation: PathInfo,
	parameters: OptionalKind<ParameterDeclarationStructure>[],
	parser: SwaggerParser,
): BodyVariant | undefined {
	const nonBodyOpParams = new Set(
		(operation.parameters ?? []).map((p) => camelCase(p.name)),
	);

	const bodyParamDef = parameters.find((p) => !nonBodyOpParams.has(p.name));

	const formDataParams = operation.parameters?.filter(
		(p) => (p as Record<string, OpenApiValue>).in === "formData",
	);

	if (formDataParams && formDataParams.length > 0) {
		const isMulti = operation.consumes?.includes("multipart/form-data");
		return {
			type: "encoded-form-data",
			paramName: isMulti ? "formData" : "formBody",
			mappings: [],
		};
	}

	if (!bodyParamDef) return undefined;

	const bodyParamName = bodyParamDef.name;
	const rb = operation.requestBody;

	const selectedContentType = rb?.content
		? selectRequestBodyContentType(
				rb.content as Record<string, { schema?: SwaggerDefinition }>,
			)
		: undefined;

	if (!selectedContentType || !rb?.content) {
		return { type: "raw", paramName: bodyParamName };
	}

	const normalizedContentType = normalizeMediaType(selectedContentType);

	const multipartKey = normalizedContentType.startsWith("multipart/")
		? normalizedContentType
		: undefined;

	if (multipartKey) {
		const mediaType = rb.content[selectedContentType];
		const schema = (mediaType as MediaTypeObject).schema as
			| SwaggerDefinition
			| boolean
			| undefined;

		const multipartConfig: {
			mediaType?: string;
			encoding?: Record<string, EncodingProperty>;
			prefixEncoding?: EncodingProperty[];
			itemEncoding?: EncodingProperty;
		} = { mediaType: multipartKey };

		if ((mediaType as MediaTypeObject).encoding) {
			multipartConfig.encoding = {
				...(mediaType as MediaTypeObject).encoding,
			};
		}

		const rawPrefixEncoding = (mediaType as MediaTypeObject).prefixEncoding;
		if (rawPrefixEncoding) {
			multipartConfig.prefixEncoding = [...rawPrefixEncoding];
		}

		if ((mediaType as MediaTypeObject).itemEncoding) {
			multipartConfig.itemEncoding = {
				...(mediaType as MediaTypeObject).itemEncoding,
			};
		}

		if (schema && typeof schema === "object" && schema.properties) {
			if (!multipartConfig.encoding) {
				multipartConfig.encoding = {};
			}
			const encodingMap = multipartConfig.encoding;
			Object.entries(schema.properties).forEach(([propName, propSchema]) => {
				enrichEncodingConfig(parser, propSchema, encodingMap, propName);
			});
		}

		if (
			schema &&
			typeof schema === "object" &&
			(schema.type === "array" || schema.items || schema.prefixItems)
		) {
			if (schema.prefixItems && Array.isArray(schema.prefixItems)) {
				if (!multipartConfig.prefixEncoding) {
					multipartConfig.prefixEncoding = [];
				}
				const prefixEncoding = multipartConfig.prefixEncoding;

				schema.prefixItems.forEach((prefixItemSchema, index) => {
					let itemConfig = prefixEncoding[index];
					if (!itemConfig) {
						itemConfig = {};
						prefixEncoding[index] = itemConfig;
					}
					const wrapper = { temp: itemConfig };
					enrichEncodingConfig(
						parser,
						prefixItemSchema as SwaggerDefinition | boolean,
						wrapper,
						"temp",
					);
				});
			}

			if (
				schema.items &&
				typeof schema.items === "object" &&
				!Array.isArray(schema.items)
			) {
				if (!multipartConfig.itemEncoding) {
					multipartConfig.itemEncoding = {};
				}
				const wrapper = { temp: multipartConfig.itemEncoding };
				enrichEncodingConfig(
					parser,
					schema.items as SwaggerDefinition,
					wrapper,
					"temp",
				);
			}
		}

		if (
			multipartConfig.mediaType === "multipart/form-data" &&
			multipartConfig.encoding &&
			!multipartConfig.prefixEncoding &&
			!multipartConfig.itemEncoding
		) {
			return {
				type: "multipart",
				paramName: bodyParamName,
				config: multipartConfig.encoding,
			};
		}

		return {
			type: "multipart",
			paramName: bodyParamName,
			config: multipartConfig,
		};
	}

	if (isFormUrlEncodedMediaType(normalizedContentType)) {
		const encodingConfig: Record<string, EncodingProperty> = {
			...((rb.content[selectedContentType] as MediaTypeObject)?.encoding || {}),
		};

		const schema = (rb.content[selectedContentType] as MediaTypeObject)
			?.schema as SwaggerDefinition | boolean | undefined;

		if (schema && typeof schema === "object" && schema.properties) {
			Object.entries(schema.properties).forEach(([propName, propSchema]) => {
				let entry = encodingConfig[propName];
				if (!entry) {
					entry = {};
					encodingConfig[propName] = entry;
				}

				const hasSerializationHints =
					entry.style !== undefined ||
					entry.explode !== undefined ||
					entry.allowReserved !== undefined;

				if (!hasSerializationHints) {
					enrichEncodingConfig(parser, propSchema, encodingConfig, propName);
				}
			});
		}

		return {
			type: "urlencoded",
			paramName: bodyParamName,
			config: encodingConfig,
		};
	}

	if (isXmlMediaType(normalizedContentType)) {
		const schema = (rb.content[selectedContentType] as MediaTypeObject)
			?.schema as SwaggerDefinition | boolean | undefined;

		if (schema && typeof schema === "object") {
			const rootName = schema.xml?.name || "root";
			const xmlConfig = getXmlConfig(parser, schema, 5);
			return {
				type: "xml",
				paramName: bodyParamName,
				rootName,
				config: xmlConfig,
			};
		}

		return { type: "raw", paramName: bodyParamName };
	}

	if (isTextMediaType(normalizedContentType)) {
		return { type: "raw", paramName: bodyParamName };
	}

	const sequentialKind = inferSequentialJsonKind(
		normalizedContentType,
		rb.content[selectedContentType] as MediaTypeObject | undefined,
	);

	if (sequentialKind) {
		return { type: sequentialKind, paramName: bodyParamName };
	}

	if (!isJsonMediaType(normalizedContentType)) {
		return { type: "raw", paramName: bodyParamName };
	}

	return { type: "json", paramName: bodyParamName };
}
