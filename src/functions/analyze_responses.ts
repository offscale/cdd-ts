/**
 * Analyzes OpenAPI operation success and error responses into `ResponseVariant` and `ErrorResponseInfo` descriptors.
 *
 * @module functions/analyze_responses
 */
import {
	type GeneratorConfig,
	type MediaTypeObject,
	type OpenApiValue,
	type PathInfo,
	type SwaggerDefinition,
	type SwaggerResponse,
	UNKNOWN_PAYLOAD_TYPE,
} from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import {
	getDecodingConfig,
	getMediaTypePreference,
	getMediaTypeSpecificity,
	getSseMode,
	getXmlConfig,
	inferSequentialJsonKind,
	isJsonMediaType,
	isTextMediaType,
	isXmlMediaType,
	normalizeMediaType,
} from "./analyze_security_metadata.js";
import type {
	ErrorResponseInfo,
	ResponseSerialization,
	ResponseVariant,
} from "./types.js";
import { getTypeScriptType, sanitizeComment } from "./utils.js";

/** Result of analyzing an operation's success responses. */
export interface AnalyzedResponsesResult {
	/** Analyzed response variants. */
	variants: ResponseVariant[];
	/** Optional explicit success code (e.g. `"default"`). */
	successCode?: string;
}

/**
 * Analyzes an operation's success responses (`2xx`, `2XX`, or `default`) into `ResponseVariant` descriptors.
 *
 * @param operation - Parsed OpenAPI `PathInfo` operation.
 * @param config - Active generator configuration.
 * @param parser - Parsed OpenAPI specification.
 * @param knownTypes - Known generated PascalCase model names.
 * @param resolveType - Type resolver callback (`(schema, knownTypes) => string`).
 * @returns Analyzed `ResponseVariant` list and optional `successCode`.
 */
export function analyzeOperationResponses(
	operation: PathInfo,
	config: GeneratorConfig,
	parser: SwaggerParser,
	knownTypes: string[],
	resolveType: (schema: OpenApiValue, knownTypes: string[]) => string,
): AnalyzedResponsesResult {
	const variants: ResponseVariant[] = [];
	const responses = operation.responses ?? {};

	const explicitSuccessCodes = Object.keys(responses).filter((code) =>
		/^2\d{2}$/.test(code),
	);
	const rangeSuccessCodes = Object.keys(responses).filter(
		(code) => code === "2XX",
	);

	let codesToProcess =
		explicitSuccessCodes.length > 0 ? explicitSuccessCodes : rangeSuccessCodes;
	let successCode: string | undefined;

	if (codesToProcess.length === 0 && responses.default) {
		codesToProcess = ["default"];
		successCode = "default";
	}

	const addVariant = (variant: ResponseVariant) => {
		const key = `${variant.mediaType}|${variant.type}|${variant.serialization}`;
		if (
			variants.some(
				(v) => `${v.mediaType}|${v.type}|${v.serialization}` === key,
			)
		) {
			return;
		}
		variants.push(variant);
	};

	const processResponseContent = (responseObj: SwaggerResponse) => {
		if (!responseObj?.content) {
			return;
		}

		Object.entries(responseObj.content).forEach(([mediaType, mediaObj]) => {
			if (!mediaObj) return;

			const normalized = normalizeMediaType(mediaType);
			const media = mediaObj as MediaTypeObject;
			const hasSchema =
				media.schema !== undefined || media.itemSchema !== undefined;

			if (normalized.includes("json") || normalized === "*/*") {
				if (!hasSchema) return;

				let serialization: ResponseSerialization = "json";
				let type = UNKNOWN_PAYLOAD_TYPE;
				let decodingConfig: Record<string, OpenApiValue> | undefined;

				const sequentialKind = inferSequentialJsonKind(normalized, media);
				const sequentialSchema =
					media.itemSchema ??
					(media.schema as SwaggerDefinition | undefined)?.items ??
					media.schema;

				if (sequentialKind) {
					serialization =
						sequentialKind === "json-seq" ? "json-seq" : "json-lines";
					const itemType = resolveType(sequentialSchema, knownTypes);
					type = `(${itemType})[]`;
				} else {
					const schema = media.schema;
					type = getTypeScriptType(
						schema as SwaggerDefinition,
						config,
						knownTypes,
					);
					const dConf = getDecodingConfig(parser, schema as SwaggerDefinition);
					if (Object.keys(dConf).length > 0) decodingConfig = dConf;
				}

				addVariant({
					mediaType,
					type,
					serialization,
					isDefault: false,
					...(decodingConfig ? { decodingConfig } : {}),
				});
				return;
			}

			if (normalized === "application/xml" || normalized.endsWith("+xml")) {
				const schema = media.schema as SwaggerDefinition;

				if (schema !== undefined) {
					const xmlConfig = getXmlConfig(parser, schema, 5);
					const type = getTypeScriptType(schema, config, knownTypes);
					addVariant({
						mediaType,
						type,
						serialization: "xml",
						isDefault: false,
						xmlConfig,
					});
				} else {
					addVariant({
						mediaType,
						type: "string",
						serialization: "text",
						isDefault: false,
					});
				}
				return;
			}

			if (normalized === "text/event-stream") {
				const effectiveSchema = media.schema ?? media.itemSchema;
				const itemType =
					effectiveSchema !== undefined
						? getTypeScriptType(
								effectiveSchema as SwaggerDefinition,
								config,
								knownTypes,
							)
						: UNKNOWN_PAYLOAD_TYPE;
				const decodingConfig =
					effectiveSchema !== undefined
						? getDecodingConfig(parser, effectiveSchema as SwaggerDefinition)
						: undefined;
				const sseMode = getSseMode(
					parser,
					effectiveSchema as SwaggerDefinition | undefined,
				);

				addVariant({
					mediaType,
					type: itemType,
					serialization: "sse",
					isDefault: false,
					...(decodingConfig ? { decodingConfig } : {}),
					sseMode,
				});
				return;
			}

			if (normalized.startsWith("text/")) {
				addVariant({
					mediaType,
					type: "string",
					serialization: "text",
					isDefault: false,
				});
				return;
			}

			addVariant({
				mediaType,
				type: "Blob",
				serialization: "blob",
				isDefault: false,
			});
		});
	};

	if (responses["204"]) {
		addVariant({
			mediaType: "",
			type: "void",
			serialization: "json",
			isDefault: false,
		});
	}

	codesToProcess.forEach((code) => {
		if (code === "204") return;
		const responseObj = responses[code] as SwaggerResponse;
		processResponseContent(responseObj);
	});

	if (variants.length === 0) {
		const reqSchema =
			operation.requestBody?.content?.["application/json"]?.schema;
		if (reqSchema !== undefined) {
			addVariant({
				mediaType: "application/json",
				type: getTypeScriptType(
					reqSchema as SwaggerDefinition,
					config,
					knownTypes,
				),
				serialization: "json",
				isDefault: true,
			});
		}
	}

	if (variants.length > 0) {
		const scored = variants.map((variant) => ({
			variant,
			normalized: normalizeMediaType(variant.mediaType),
		}));

		scored.sort(
			(a, b) =>
				getMediaTypeSpecificity(b.normalized) -
					getMediaTypeSpecificity(a.normalized) ||
				getMediaTypePreference(a.normalized) -
					getMediaTypePreference(b.normalized),
		);

		variants.forEach((v) => {
			v.isDefault = false;
		});

		const top = scored[0] as (typeof scored)[number];
		top.variant.isDefault = true;
	}

	return { variants, ...(successCode ? { successCode } : {}) };
}

/**
 * Analyzes an operation's non-2xx error responses into `ErrorResponseInfo` descriptors.
 *
 * @param operation - Parsed OpenAPI `PathInfo` operation.
 * @param config - Active generator configuration.
 * @param knownTypes - Known generated PascalCase model names.
 * @param successCode - Optional status code already treated as the primary success response.
 * @returns Array of `ErrorResponseInfo` descriptors.
 */
export function analyzeOperationErrorResponses(
	operation: PathInfo,
	config: GeneratorConfig,
	knownTypes: string[],
	successCode?: string,
): ErrorResponseInfo[] {
	if (!operation.responses) return [];

	const errors: ErrorResponseInfo[] = [];

	const pickJsonSchema = (
		content: Record<string, { schema?: SwaggerDefinition }>,
	): SwaggerDefinition | undefined => {
		const direct = content["application/json"]?.schema;
		if (direct !== undefined) return direct as SwaggerDefinition;

		const jsonLikeEntry = Object.entries(content).find(([mediaType, obj]) => {
			const normalized = normalizeMediaType(mediaType);
			if (normalized === "*/*") return false;
			return isJsonMediaType(normalized) && obj?.schema !== undefined;
		});

		if (jsonLikeEntry) return jsonLikeEntry[1]?.schema as SwaggerDefinition;

		const wildcard = content["*/*"]?.schema;
		return wildcard as SwaggerDefinition | undefined;
	};

	const pickXmlSchema = (
		content: Record<string, { schema?: SwaggerDefinition }>,
	): SwaggerDefinition | undefined => {
		const entries = Object.entries(content);
		for (const [mediaType, obj] of entries) {
			const normalized = normalizeMediaType(mediaType);
			if (!isXmlMediaType(normalized)) continue;
			if (obj?.schema !== undefined) return obj.schema as SwaggerDefinition;
		}
		return undefined;
	};

	for (const [code, responseObj] of Object.entries(operation.responses)) {
		if (code === successCode) continue;
		if (/^2\d{2}$/.test(code) || code === "2XX") continue;

		let type = UNKNOWN_PAYLOAD_TYPE;
		const content = (responseObj as SwaggerResponse).content;
		if (content) {
			const jsonSchema = pickJsonSchema(
				content as Record<string, { schema?: SwaggerDefinition }>,
			);

			if (jsonSchema !== undefined) {
				type = getTypeScriptType(
					jsonSchema as SwaggerDefinition,
					config,
					knownTypes,
				);
			} else {
				const xmlSchema = pickXmlSchema(
					content as Record<string, { schema?: SwaggerDefinition }>,
				);

				if (xmlSchema !== undefined) {
					type = getTypeScriptType(
						xmlSchema as SwaggerDefinition,
						config,
						knownTypes,
					);
				} else if (
					Object.keys(content).some((mt) =>
						isTextMediaType(normalizeMediaType(mt)),
					)
				) {
					type = "string";
				} else {
					const nonTextMedia = Object.keys(content).find((mt) => {
						const normalized = normalizeMediaType(mt);
						return (
							normalized !== "" &&
							!isJsonMediaType(normalized) &&
							!isXmlMediaType(normalized) &&
							!isTextMediaType(normalized)
						);
					});

					if (nonTextMedia) {
						type = "Blob";
					}
				}
			}
		} else if (code === "401" || code === "403") {
			type = "void";
		}

		errors.push({
			code,
			type,
			...((responseObj as SwaggerResponse).description && {
				description: sanitizeComment(
					(responseObj as SwaggerResponse).description,
				),
			}),
		});
	}

	return errors;
}
