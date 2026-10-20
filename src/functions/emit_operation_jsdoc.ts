/**
 * Generates JSDoc tag blocks (`@operationId`, `@param`, `@paramExample`, `@requestExample`, `@response`, `@responseSummary`, `@responseExample`, `@throws`, `@tags`, `@see`, `@server`, `@security`, `@querystring`, `@x-*`) for generated HTTP service methods.
 *
 * @module functions/emit_operation_jsdoc
 */
import type { OptionalKind, ParameterDeclarationStructure } from "ts-morph";
import type {
	MediaTypeObject,
	OpenApiValue,
	Parameter,
	PathInfo,
	ReferenceLike,
	RequestBody,
	SwaggerResponse,
} from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import type { ResponseVariant, ServiceMethodModel } from "./types.js";
import { camelCase, sanitizeComment } from "./utils.js";

/**
 * Normalizes a MIME media type by stripping parameters and converting to lowercase.
 *
 * @param mediaType - Raw media type string.
 * @returns Normalized media type string.
 */
export function normalizeNegotiationMediaType(mediaType: string): string {
	return (mediaType.split(";")[0] as string).trim().toLowerCase();
}

function shouldPreferSerializedExample(mediaType: string): boolean {
	const normalized = normalizeNegotiationMediaType(mediaType);
	return (
		normalized !== "" &&
		normalized !== "application/json" &&
		!normalized.endsWith("+json")
	);
}

function mediaTypeSpecificity(normalized: string): number {
	const [type = "", subtype = ""] = normalized.split("/");
	if (normalized === "*/*" || !type || !subtype) return 0;
	if (type.includes("*") || subtype.includes("*")) return 1;
	return 2;
}

function matchesMediaType(range: string, candidate: string): boolean {
	const [rangeType = "", rangeSubtype = ""] = range.split("/");
	const [candType = "", candSubtype = ""] = candidate.split("/");
	return (
		(rangeType === "*" || rangeType === candType) &&
		(rangeSubtype === "*" || rangeSubtype === candSubtype)
	);
}

/**
 * Filters a list of media types, removing wildcard media types that are subsumed by more specific media types.
 *
 * @param mediaTypes - Raw media type strings.
 * @returns Filtered list of non-redundant media type strings.
 */
export function filterMediaTypes(mediaTypes: string[]): string[] {
	const entries: { raw: string; normalized: string; specificity: number }[] =
		[];
	const seen = new Set<string>();

	mediaTypes.forEach((raw) => {
		const normalized = normalizeNegotiationMediaType(raw);
		if (!normalized || seen.has(normalized)) return;
		seen.add(normalized);
		entries.push({
			raw,
			normalized,
			specificity: mediaTypeSpecificity(normalized),
		});
	});

	return entries
		.filter((candidate) => {
			if (candidate.specificity === 2) return true;
			return !entries.some(
				(other) =>
					other !== candidate &&
					other.specificity > candidate.specificity &&
					matchesMediaType(candidate.normalized, other.normalized),
			);
		})
		.map((entry) => entry.raw);
}

/**
 * Filters `ResponseVariant` entries to distinct, non-wildcard-subsumed content negotiation variants.
 *
 * @param variants - Analyzed response variants.
 * @returns Distinct negotiation response variants.
 */
export function getDistinctNegotiationVariants(
	variants: ResponseVariant[],
): ResponseVariant[] {
	const uniqueByMedia: ResponseVariant[] = [];
	const seen = new Set<string>();

	variants.forEach((variant) => {
		if (!variant.mediaType) return;
		const normalized = normalizeNegotiationMediaType(variant.mediaType);
		if (!normalized || seen.has(normalized)) return;
		seen.add(normalized);
		uniqueByMedia.push(variant);
	});

	const filteredMediaTypes = new Set(
		filterMediaTypes(uniqueByMedia.map((v) => v.mediaType)),
	);

	return uniqueByMedia.filter((v) => filteredMediaTypes.has(v.mediaType));
}

/**
 * Builds the complete JSDoc block array for a generated HTTP service method.
 *
 * @param operation - Parsed OpenAPI `PathInfo` operation.
 * @param model - Analyzed `ServiceMethodModel`.
 * @param parser - Parsed OpenAPI specification.
 * @param errorTypeAlias - Optional `*Error` union type alias name for `@throws`.
 * @returns Array of JSDoc block strings (`string[]`).
 */
export function buildOperationMethodDocs(
	operation: PathInfo,
	model: ServiceMethodModel,
	parser: SwaggerParser,
	errorTypeAlias?: string,
): string[] {
	const paramTags = buildParamTags(operation, model.parameters);
	const responseTags = buildResponseTags(operation);
	const exampleTags = buildExampleTags(operation, model.parameters, parser);
	const metaTags = buildOperationMetaTags(operation, parser);

	const docLines: string[] = [];

	if (model.docs) docLines.push(model.docs);
	if (operation.operationId)
		docLines.push(`@operationId ${operation.operationId}`);
	if (metaTags.length > 0) docLines.push(...metaTags);
	if (paramTags.length > 0) docLines.push(...paramTags);
	if (exampleTags.length > 0) docLines.push(...exampleTags);
	if (errorTypeAlias) docLines.push(`@throws {${errorTypeAlias}}`);
	if (responseTags.length > 0) docLines.push(...responseTags);

	return docLines.length > 0 ? [docLines.join(String.fromCharCode(10))] : [];
}

function buildResponseTags(operation: PathInfo): string[] {
	if (!operation.responses) return [];

	const tags: string[] = [];

	Object.entries(operation.responses).forEach(([code, resp]) => {
		const description = resp?.description
			? sanitizeComment(resp.description)
			: "";
		const summary = resp?.summary ? sanitizeComment(resp.summary) : "";
		const mediaTypes = resp?.content
			? filterMediaTypes(Object.keys(resp.content))
			: [];

		if (mediaTypes.length === 0) {
			tags.push(`@response ${code}${description ? ` ${description}` : ""}`);
		} else {
			mediaTypes.forEach((mediaType) => {
				const base = `@response ${code} ${mediaType}`;
				tags.push(description ? `${base} ${description}` : base);
			});
		}

		if (summary) tags.push(`@responseSummary ${code} ${summary}`);
	});

	return tags;
}

function collectParamNameSets(
	operation: PathInfo,
	parameters: OptionalKind<ParameterDeclarationStructure>[],
): {
	paramNames: Set<string>;
	bodyParamName: string | undefined;
} {
	const paramNames = new Set(
		parameters
			.map((p) => p.name)
			.filter((name) => name.length > 0 && name !== "options"),
	);

	const opParamNames = new Set(
		(operation.parameters ?? [])
			.map((param) => camelCase(param.name))
			.filter((name) => paramNames.has(name)),
	);

	const bodyParam = parameters.find(
		(p) => !opParamNames.has(p.name) && p.name !== "options",
	);

	return { paramNames, bodyParamName: bodyParam?.name };
}

function buildParamTags(
	operation: PathInfo,
	parameters: OptionalKind<ParameterDeclarationStructure>[],
): string[] {
	const tags: string[] = [];
	const { paramNames, bodyParamName } = collectParamNameSets(
		operation,
		parameters,
	);

	(operation.parameters ?? []).forEach((param) => {
		const paramName = camelCase(param.name);
		if (!paramNames.has(paramName) || !param.description) return;

		const desc = sanitizeComment(param.description);
		tags.push(`@param ${paramName} ${desc}`);
	});

	if (operation.requestBody?.description && bodyParamName) {
		const desc = sanitizeComment(operation.requestBody.description);
		tags.push(`@param ${bodyParamName} ${desc}`);
	}

	return tags;
}

function buildExampleTags(
	operation: PathInfo,
	parameters: OptionalKind<ParameterDeclarationStructure>[],
	parser: SwaggerParser,
): string[] {
	const tags: string[] = [];
	const { paramNames, bodyParamName } = collectParamNameSets(
		operation,
		parameters,
	);

	(operation.parameters ?? []).forEach((param) => {
		const paramName = camelCase(param.name);
		if (!paramNames.has(paramName)) return;

		const example = extractParameterExample(param, parser);
		if (example !== undefined) {
			tags.push(`@paramExample ${paramName} ${JSON.stringify(example)}`);
		}
	});

	if (bodyParamName && operation.requestBody) {
		const requestExamples = extractRequestBodyExamples(
			operation.requestBody,
			parser,
		);
		requestExamples.forEach((entry) => {
			tags.push(
				`@requestExample ${entry.mediaType} ${JSON.stringify(entry.value)}`,
			);
		});
	}

	if (operation.responses) {
		Object.entries(operation.responses).forEach(([code, response]) => {
			const resolved = parser.resolve<SwaggerResponse>(
				response as ReferenceLike,
			) as SwaggerResponse;
			if (!resolved.content) return;

			Object.entries(resolved.content).forEach(([mediaType, mediaObj]) => {
				const example = extractMediaTypeExample(mediaObj, parser, mediaType);
				if (example !== undefined) {
					tags.push(
						`@responseExample ${code} ${mediaType} ${JSON.stringify(example)}`,
					);
				}
			});
		});
	}

	return tags;
}

function extractExampleValue(
	exampleObj: OpenApiValue,
	preferSerialized: boolean,
): {
	found: boolean;
	value: OpenApiValue;
	kind?: "data" | "value" | "serialized" | "external";
} {
	if (!exampleObj || typeof exampleObj !== "object")
		return { found: false, value: null };

	const rec = exampleObj as Record<string, OpenApiValue>;
	const orderedKeys: {
		key: "dataValue" | "value" | "serializedValue" | "externalValue";
		kind: "data" | "value" | "serialized" | "external";
	}[] = preferSerialized
		? [
				{ key: "serializedValue", kind: "serialized" },
				{ key: "externalValue", kind: "external" },
				{ key: "dataValue", kind: "data" },
				{ key: "value", kind: "value" },
			]
		: [
				{ key: "dataValue", kind: "data" },
				{ key: "value", kind: "value" },
				{ key: "serializedValue", kind: "serialized" },
				{ key: "externalValue", kind: "external" },
			];

	for (const { key, kind } of orderedKeys) {
		if (Object.hasOwn(rec, key)) {
			return { found: true, value: rec[key], kind };
		}
	}

	return { found: false, value: null };
}

function wrapExampleValue(picked: {
	value: OpenApiValue;
	kind?: "data" | "value" | "serialized" | "external";
}): OpenApiValue {
	if (picked.kind === "serialized") {
		return { __oasExample: { serializedValue: picked.value } };
	}
	if (picked.kind === "external") {
		return { __oasExample: { externalValue: picked.value } };
	}
	return picked.value;
}

function extractParameterExample(
	param: Parameter,
	parser: SwaggerParser,
): OpenApiValue | undefined {
	if (param.example !== undefined) return param.example;

	const firstParamExample = param.examples
		? Object.values(param.examples)[0]
		: undefined;
	if (firstParamExample !== undefined) {
		const resolved = parser.resolve(firstParamExample as ReferenceLike);
		const picked = extractExampleValue(resolved, true);
		if (picked.found) return wrapExampleValue(picked);
	}

	if (
		param.schema &&
		typeof param.schema === "object" &&
		!("$ref" in param.schema)
	) {
		const schema = param.schema as Record<string, OpenApiValue>;
		if (schema.example !== undefined) return schema.example;
		const schemaExamples = schema.examples as OpenApiValue[] | undefined;
		if (schemaExamples?.[0] !== undefined) {
			return schemaExamples[0];
		}
	}

	const mediaType = param.content ? Object.keys(param.content)[0] : undefined;
	const mediaObj = mediaType ? param.content?.[mediaType] : undefined;
	return mediaObj && mediaType
		? extractMediaTypeExample(mediaObj, parser, mediaType)
		: undefined;
}

function extractMediaTypeExample(
	mediaObj: MediaTypeObject | ReferenceLike,
	parser: SwaggerParser,
	mediaType: string,
): OpenApiValue | undefined {
	const resolved = parser.resolve<MediaTypeObject>(
		mediaObj as ReferenceLike,
	) as MediaTypeObject;

	if (resolved.example !== undefined) return resolved.example;

	const firstExample = resolved.examples
		? Object.values(resolved.examples)[0]
		: undefined;
	if (firstExample !== undefined) {
		const resolvedExample = parser.resolve(firstExample as ReferenceLike);
		const preferSerialized = shouldPreferSerializedExample(mediaType);
		const picked = extractExampleValue(resolvedExample, preferSerialized);
		if (picked.found) return wrapExampleValue(picked);
	}

	return undefined;
}

function extractRequestBodyExamples(
	requestBody: RequestBody,
	parser: SwaggerParser,
): {
	mediaType: string;
	value: OpenApiValue;
}[] {
	const entries: {
		mediaType: string;
		value: OpenApiValue;
	}[] = [];

	const content = requestBody.content ?? {};
	Object.entries(content).forEach(([mediaType, mediaObj]) => {
		const example = extractMediaTypeExample(mediaObj, parser, mediaType);
		if (example !== undefined) {
			entries.push({
				mediaType,
				value: example,
			});
		}
	});

	return entries;
}

function buildOperationMetaTags(
	operation: PathInfo,
	parser: SwaggerParser,
): string[] {
	const tags: string[] = [];

	if (operation.tags && operation.tags.length > 0) {
		const joined = operation.tags
			.map((t) => String(t).trim())
			.filter(Boolean)
			.join(", ");
		tags.push(`@tags ${joined}`);
	}

	if (operation.externalDocs?.url) {
		const desc = sanitizeComment(operation.externalDocs.description);
		tags.push(`@see ${operation.externalDocs.url}${desc ? ` ${desc}` : ""}`);
	}

	const rawOperation = getRawOperation(operation, parser);

	if (rawOperation && Object.hasOwn(rawOperation, "servers")) {
		tags.push(`@server ${JSON.stringify(rawOperation.servers)}`);
	}

	if (rawOperation && Object.hasOwn(rawOperation, "security")) {
		tags.push(`@security ${JSON.stringify(rawOperation.security)}`);
	}

	const querystringParam = (operation.parameters ?? []).find(
		(p) => (p as { in?: string }).in === "querystring",
	);

	if (querystringParam) {
		const contentType = querystringParam.content
			? Object.keys(querystringParam.content)[0]
			: undefined;
		const encoding = contentType
			? querystringParam.content?.[contentType]?.encoding
			: undefined;

		const meta: Record<string, OpenApiValue> = {
			name: querystringParam.name,
			...(contentType ? { contentType } : {}),
			...(encoding ? { encoding } : {}),
			...(typeof querystringParam.required === "boolean"
				? { required: querystringParam.required }
				: {}),
			...(querystringParam.description
				? { description: sanitizeComment(querystringParam.description) }
				: {}),
		};

		tags.push(`@querystring ${JSON.stringify(meta)}`);
	}

	Object.entries(operation).forEach(([key, value]) => {
		if (!key.startsWith("x-") || value === undefined) return;
		tags.push(`@${key} ${JSON.stringify(value)}`);
	});

	return tags;
}

function getRawOperation(
	operation: PathInfo,
	parser: SwaggerParser,
): Record<string, OpenApiValue> | undefined {
	const pathItem = parser.spec.paths?.[operation.path];
	if (!pathItem) return undefined;

	const methodKey = operation.method.toLowerCase();
	const direct = (pathItem as Record<string, OpenApiValue>)[methodKey];
	if (direct) return direct as Record<string, OpenApiValue>;

	const additional = ((pathItem as Record<string, OpenApiValue>)
		.additionalOperations ?? {}) as Record<string, OpenApiValue>;

	const matchKey = Object.keys(additional).find(
		(k) => k.toLowerCase() === methodKey,
	);
	return matchKey
		? (additional[matchKey] as Record<string, OpenApiValue>)
		: undefined;
}
