/**
 * Analyzes OpenAPI operation parameters into `ts-morph` parameter declarations and runtime `ParamSerialization` structures.
 *
 * @module functions/analyze_parameters
 */
import type { OptionalKind, ParameterDeclarationStructure } from "ts-morph";
import {
	type GeneratorConfig,
	type MediaTypeObject,
	type OpenApiValue,
	type Parameter,
	type PathInfo,
	type SwaggerDefinition,
	UNKNOWN_PAYLOAD_TYPE,
} from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { selectRequestBodyContentType } from "./analyze_request_body.js";
import {
	getEncodingConfig,
	inferSequentialJsonKind,
	isBinaryMediaType,
	isJsonMediaType,
	isMultipartMediaType,
	isTextMediaType,
	isXmlMediaType,
	needsRequestType,
	normalizeMediaType,
} from "./analyze_security_metadata.js";
import type { ParamSerialization } from "./types.js";
import { camelCase, getTypeScriptType, isDataTypeInterface } from "./utils.js";

/**
 * Checks whether a header parameter should be omitted from method signatures because it is managed automatically (`Accept`, `Content-Type`, `Authorization`).
 *
 * @param param - OpenAPI `Parameter` object.
 * @returns `true` if the header parameter is ignored.
 */
export function isIgnoredHeaderParam(param: Parameter): boolean {
	if (param.in !== "header") return false;
	const name = param.name.toLowerCase();
	return (
		name === "accept" || name === "content-type" || name === "authorization"
	);
}

/**
 * Checks whether a parameter uses a JSON `content` map entry.
 *
 * @param p - OpenAPI `Parameter` object.
 * @returns `true` if `p.content` contains a JSON media type.
 */
export function isJsonContent(p: Parameter): boolean {
	if (!p.content) return false;
	const keys = Object.keys(p.content);
	return keys.some((k) => isJsonMediaType(normalizeMediaType(k)));
}

/** Extracted parameter content media type and encoding map. */
export interface ParameterContentInfo {
	/** Primary media type key. */
	contentType?: string;
	/** Optional property encoding map. */
	encoding?: Record<string, OpenApiValue>;
}

/**
 * Extracts the primary `contentType` and `encoding` map from a parameter's `content` definition.
 *
 * @param p - OpenAPI `Parameter` object.
 * @returns Extracted `contentType` and `encoding` map.
 */
export function getParameterContent(p: Parameter): ParameterContentInfo {
	if (!p.content) return {};
	const keys = Object.keys(p.content);
	const contentType = keys[0];
	if (!contentType) return {};

	const encoding = (
		p.content as Record<string, { encoding?: Record<string, OpenApiValue> }>
	)?.[contentType]?.encoding;

	return {
		contentType,
		...(encoding ? { encoding } : {}),
	};
}

/**
 * Resolves the effective schema for a parameter from either `p.schema` or `p.content[contentType].schema`.
 *
 * @param p - OpenAPI `Parameter` object.
 * @param contentType - Optional media type key in `p.content`.
 * @returns Parameter schema or `undefined`.
 */
export function getParameterSchema(
	p: Parameter,
	contentType?: string,
): SwaggerDefinition | boolean | undefined {
	if (p.schema !== undefined) return p.schema as SwaggerDefinition | boolean;
	if (!p.content) return undefined;

	const key = contentType ?? Object.keys(p.content)[0];
	if (!key) return undefined;

	const entry = (
		p.content as Record<string, { schema?: SwaggerDefinition | boolean }>
	)?.[key];
	return entry?.schema;
}

/**
 * Checks whether a parameter's schema declares a JSON `contentMediaType`.
 *
 * @param p - OpenAPI `Parameter` object.
 * @param parser - Parsed OpenAPI specification.
 * @returns `true` if `contentMediaType` is JSON-compatible.
 */
export function isJsonContentMediaType(
	p: Parameter,
	parser: SwaggerParser,
): boolean {
	if (p.schema === undefined || typeof p.schema !== "object") return false;

	const inlineContentMediaType = (p.schema as SwaggerDefinition)
		.contentMediaType;
	if (
		inlineContentMediaType &&
		isJsonMediaType(normalizeMediaType(inlineContentMediaType))
	) {
		return true;
	}

	const resolved = parser.resolve(p.schema as SwaggerDefinition);
	return !!(
		resolved?.contentMediaType &&
		isJsonMediaType(normalizeMediaType(resolved.contentMediaType))
	);
}

/**
 * Checks whether a parameter uses an XML `content` map entry.
 *
 * @param p - OpenAPI `Parameter` object.
 * @returns `true` if `p.content` contains an XML media type with a schema.
 */
export function isXmlContent(p: Parameter): boolean {
	return getXmlContentEntry(p) !== undefined;
}

/** Extracted XML media type and schema for an XML-serialized parameter. */
export interface XmlParameterContentEntry {
	/** Raw XML media type string. */
	mediaType: string;
	/** Parameter schema definition. */
	schema: SwaggerDefinition | boolean;
}

/**
 * Extracts the XML media type and schema from a parameter's `content` map if present.
 *
 * @param p - OpenAPI `Parameter` object.
 * @returns XML media type and schema or `undefined`.
 */
export function getXmlContentEntry(
	p: Parameter,
): XmlParameterContentEntry | undefined {
	if (!p.content) return undefined;

	for (const [mediaType, mediaObj] of Object.entries(p.content)) {
		const normalized = normalizeMediaType(mediaType);
		if (!isXmlMediaType(normalized)) continue;

		const schema = (mediaObj as MediaTypeObject | undefined)?.schema;
		if (schema !== undefined) {
			return { mediaType, schema };
		}
	}

	return undefined;
}

/** Grouped parameter serialization descriptors for an operation. */
export interface ParameterSerializationGroups {
	/** Path parameter serializations. */
	pathParams: ParamSerialization[];
	/** Query parameter serializations. */
	queryParams: ParamSerialization[];
	/** Header parameter serializations. */
	headerParams: ParamSerialization[];
	/** Cookie parameter serializations. */
	cookieParams: ParamSerialization[];
}

/**
 * Analyzes an operation's parameters into `pathParams`, `queryParams`, `headerParams`, and `cookieParams` serialization descriptors.
 *
 * @param operation - Parsed OpenAPI `PathInfo` operation.
 * @param parser - Parsed OpenAPI specification.
 * @returns Grouped parameter serialization descriptors.
 */
export function analyzeParameterSerializations(
	operation: PathInfo,
	parser: SwaggerParser,
): ParameterSerializationGroups {
	const pathParams: ParamSerialization[] = [];
	const queryParams: ParamSerialization[] = [];
	const headerParams: ParamSerialization[] = [];
	const cookieParams: ParamSerialization[] = [];

	(operation.parameters || []).forEach((p) => {
		if (isIgnoredHeaderParam(p)) return;

		const paramName = camelCase(p.name);
		const effectiveStyle =
			p.style || (p.in === "query" || p.in === "cookie" ? "form" : "simple");
		const defaultExplode =
			effectiveStyle === "form" || effectiveStyle === "cookie";
		const explode = p.explode ?? defaultExplode;

		const explicitJson = isJsonContent(p);
		const implicitJson = isJsonContentMediaType(p, parser);
		const { contentType, encoding } = getParameterContent(p);
		const paramSchema = getParameterSchema(p, contentType);
		const encoderConfig = getEncodingConfig(parser, paramSchema);
		const hasEncoderConfig = Object.keys(encoderConfig).length > 0;

		let serializationLink: "json" | "json-subset" | undefined;
		if (explicitJson || implicitJson) serializationLink = "json";

		const serialization: ParamSerialization = {
			paramName: isXmlContent(p) ? `${paramName}Serialized` : paramName,
			originalName: p.name,
			explode: explode,
			allowReserved: p.allowReserved ?? false,
			serializationLink,
			style: effectiveStyle,
			...(contentType ? { contentType } : {}),
			...(encoding ? { encoding } : {}),
			...(hasEncoderConfig ? { contentEncoderConfig: encoderConfig } : {}),
		};

		switch (p.in) {
			case "path":
				pathParams.push(serialization);
				break;
			case "query":
				queryParams.push(serialization);
				break;
			case "header":
				headerParams.push(serialization);
				break;
			case "cookie":
				cookieParams.push(serialization);
				break;
			case "querystring" as string:
				queryParams.push(serialization);
				break;
		}
	});

	return { pathParams, queryParams, headerParams, cookieParams };
}

function resolveRequestModelVariant(
	bodyType: string,
	rawBodyType: string,
	knownTypes: string[],
	parser: SwaggerParser,
): string {
	if (!knownTypes.includes(rawBodyType)) return bodyType;
	const schemaObj = parser.schemas.find((s) => s.name === rawBodyType);
	const definition = schemaObj?.definition;
	if (
		definition &&
		typeof definition === "object" &&
		needsRequestType(definition)
	) {
		return bodyType.replace(rawBodyType, `${rawBodyType}Request`);
	}
	return bodyType;
}

/**
 * Analyzes an operation's parameters and requestBody into sorted `ts-morph` parameter declaration structures.
 *
 * @param operation - Parsed OpenAPI `PathInfo` operation.
 * @param config - Active generator configuration.
 * @param parser - Parsed OpenAPI specification.
 * @param knownTypes - Known generated PascalCase model names.
 * @returns Sorted array of parameter declaration structures.
 */
export function analyzeMethodParameters(
	operation: PathInfo,
	config: GeneratorConfig,
	parser: SwaggerParser,
	knownTypes: string[],
): OptionalKind<ParameterDeclarationStructure>[] {
	const parameters: OptionalKind<ParameterDeclarationStructure>[] = [];

	(operation.parameters ?? []).forEach((param) => {
		if (isIgnoredHeaderParam(param)) return;

		let effectiveSchema = param.schema;
		if (param.content) {
			const firstType = Object.keys(param.content)[0];
			if (firstType && param.content[firstType]?.schema !== undefined) {
				effectiveSchema = param.content[firstType]?.schema as SwaggerDefinition;
			}
		}

		const paramType = getTypeScriptType(effectiveSchema, config, knownTypes);

		parameters.push({
			name: camelCase(param.name),
			type: paramType,
			hasQuestionToken: !param.required,
			...(param.deprecated && { leadingTrivia: [`/** @deprecated */ `] }),
		});
	});

	const requestBody = operation.requestBody;
	if (requestBody) {
		const contentMap = requestBody.content || {};
		const contentType = selectRequestBodyContentType(
			contentMap as Record<string, { schema?: SwaggerDefinition }>,
		);

		if (!contentType) {
			parameters.push({
				name: "body",
				type: UNKNOWN_PAYLOAD_TYPE,
				hasQuestionToken: !requestBody.required,
			});
		} else {
			const normalized = normalizeMediaType(contentType);
			const content = contentMap[contentType] as MediaTypeObject | undefined;
			const effectiveSchema = content?.schema ?? content?.itemSchema;
			const sequentialKind = inferSequentialJsonKind(normalized, content);

			if (sequentialKind) {
				const schemaAsDef = content?.schema as SwaggerDefinition | undefined;
				const itemSchema =
					content?.itemSchema ?? schemaAsDef?.items ?? content?.schema;
				const itemType =
					itemSchema !== undefined
						? getTypeScriptType(
								itemSchema as SwaggerDefinition,
								config,
								knownTypes,
							)
						: UNKNOWN_PAYLOAD_TYPE;

				const needsParens = /[|&]/.test(itemType);
				const rawBodyType = itemType.replace(/\[]| \| null/g, "");
				const bodyType = resolveRequestModelVariant(
					`${needsParens ? `(${itemType})` : itemType}[]`,
					rawBodyType,
					knownTypes,
					parser,
				);
				const bodyName = isDataTypeInterface(rawBodyType)
					? camelCase(rawBodyType)
					: "body";

				parameters.push({
					name: bodyName,
					type: bodyType,
					hasQuestionToken: !requestBody.required,
				});
			} else if (isJsonMediaType(normalized) && effectiveSchema !== undefined) {
				const baseBodyType = getTypeScriptType(
					effectiveSchema as SwaggerDefinition,
					config,
					knownTypes,
				);
				const rawBodyType = baseBodyType.replace(/\[]| \| null/g, "");
				const bodyType = resolveRequestModelVariant(
					baseBodyType,
					rawBodyType,
					knownTypes,
					parser,
				);
				const bodyName = isDataTypeInterface(rawBodyType)
					? camelCase(rawBodyType)
					: "body";

				parameters.push({
					name: bodyName,
					type: bodyType,
					hasQuestionToken: !requestBody.required,
				});
			} else if (isMultipartMediaType(normalized)) {
				parameters.push({
					name: "body",
					type: "FormData | OpenApiValue[] | OpenApiValue",
					hasQuestionToken: !requestBody.required,
				});
			} else if (isTextMediaType(normalized)) {
				parameters.push({
					name: "body",
					type: "string",
					hasQuestionToken: !requestBody.required,
				});
			} else {
				const fallbackType = isXmlMediaType(normalized)
					? "string"
					: isBinaryMediaType(normalized)
						? "Blob"
						: UNKNOWN_PAYLOAD_TYPE;
				const rawBodyType =
					effectiveSchema !== undefined
						? getTypeScriptType(
								effectiveSchema as SwaggerDefinition,
								config,
								knownTypes,
							)
						: fallbackType;
				const bodyType = rawBodyType.includes("|")
					? `(${rawBodyType})`
					: rawBodyType;
				const bodyName = isDataTypeInterface(rawBodyType)
					? camelCase(rawBodyType)
					: "body";

				parameters.push({
					name: bodyName,
					type: bodyType,
					hasQuestionToken: !requestBody.required,
				});
			}
		}
	}

	return parameters.sort(
		(a, b) => (a.hasQuestionToken ? 1 : 0) - (b.hasQuestionToken ? 1 : 0),
	);
}
