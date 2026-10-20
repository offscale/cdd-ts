/**
 * JSDoc metadata, parameter tag, example, server, security, and type-node schema extraction helpers for AST code scanning.
 *
 * @module functions/parsers/parse_operation_jsdoc
 */
import type {
	Expression,
	JSDoc,
	JSDocTag,
	ParameterDeclaration,
	TypeNode,
} from "ts-morph";
import { Node, SyntaxKind } from "ts-morph";
import { schemaFromTypeNode } from "../../classes/parse.js";
import type {
	ExampleObject,
	ExternalDocumentationObject,
	OpenApiValue,
	ServerObject,
	SwaggerDefinition,
	TagObject,
} from "../../core/types/index.js";
import type {
	CodeScanParam,
	CodeScanRequestBody,
	CodeScanResponse,
} from "../parse.js";

const RESERVED_HEADER_NAMES = new Set([
	"accept",
	"content-type",
	"authorization",
]);

const PRIMITIVE_REF_MAP: Record<string, SwaggerDefinition> = {
	String: { type: "string" },
	Number: { type: "number" },
	Boolean: { type: "boolean" },
	Object: { type: "object" },
};

const PRIMITIVE_SCHEMA_TYPES = new Set([
	"string",
	"number",
	"integer",
	"boolean",
	"object",
	"array",
	"null",
]);

/** Parsed `@querystring` JSDoc tag metadata. */
export interface QuerystringMeta {
	/** Parameter name. */
	name: string;
	/** Optional media type. */
	contentType?: string;
	/** Optional encoding map. */
	encoding?: Record<string, OpenApiValue>;
	/** Whether the querystring parameter is required. */
	required?: boolean;
	/** Human-readable description. */
	description?: string;
}

/** Parsed `@response` / `@responseSummary` JSDoc tag metadata. */
export interface ResponseDocMeta {
	/** HTTP status code string. */
	status: string;
	/** Optional response summary. */
	summary?: string;
	/** Optional response description. */
	description?: string;
	/** Optional response media types. */
	contentTypes?: string[];
}

/** Complete operation JSDoc metadata extracted from an AST node. */
export interface ExtractedOperationDocMeta {
	/** Short summary from the first JSDoc line. */
	summary?: string;
	/** Detailed description from subsequent JSDoc lines. */
	description?: string;
	/** True when `@deprecated` is present. */
	deprecated?: boolean;
	/** Tag names from `@tag` / `@tags`. */
	tags?: string[];
	/** Structured tag objects from JSON `@tag` / `@tags`. */
	tagObjects?: TagObject[];
	/** External documentation from `@see`. */
	externalDocs?: ExternalDocumentationObject;
	/** Operation server overrides from `@server`. */
	servers?: ServerObject[];
	/** Operation security requirements from `@security`. */
	security?: Record<string, string[]>[];
	/** Vendor extensions from `@x-*` tags. */
	extensions?: Record<string, OpenApiValue>;
	/** Querystring parameter metadata from `@querystring`. */
	querystring?: QuerystringMeta;
	/** Explicit operationId from `@operationId`. */
	operationId?: string;
	/** Response hints from `@response` / `@responseSummary`. */
	responses?: ResponseDocMeta[];
	/** Parameter descriptions keyed by parameter name from `@param`. */
	paramDocs?: Record<string, string>;
	/** Parameter example values keyed by parameter name from `@paramExample`. */
	paramExamples?: Record<string, OpenApiValue>;
	/** Parameter schema overrides keyed by parameter name from `@paramSchema`. */
	paramSchemas?: Record<string, SwaggerDefinition | boolean>;
	/** Request body examples keyed by media type from `@requestExample`. */
	requestExamples?: Record<string, OpenApiValue>;
	/** Response examples keyed by status code and media type from `@responseExample`. */
	responseExamples?: Record<string, Record<string, OpenApiValue>>;
}

/** Inferred request and response schemas from Express handler parameter annotations. */
export interface ExpressSchemaHints {
	/** Inferred request body schema. */
	requestSchema?: SwaggerDefinition | boolean;
	/** Inferred response body schema. */
	responseSchema?: SwaggerDefinition | boolean;
}

/**
 * Adds or merges a `CodeScanParam` into `paramMap` keyed by `in:name`.
 *
 * @param paramMap - Map of accumulated operation parameters.
 * @param param - Parameter descriptor to add or merge.
 */
export function addParam(
	paramMap: Map<string, CodeScanParam>,
	param: CodeScanParam,
): void {
	const key = `${param.in}:${param.name}`;
	const existing = paramMap.get(key);
	if (!existing) {
		paramMap.set(key, param);
		return;
	}
	if (param.required) existing.required = true;
}

function getRawTagPayload(tag: JSDocTag): string {
	const [firstLine] = tag.getText().split(String.fromCharCode(10));
	const bs = String.fromCharCode(92);
	return (firstLine as string)
		.replace(
			new RegExp(`^${bs}s*${bs}*?${bs}s*@${tag.getTagName()}${bs}s*`, "i"),
			"",
		)
		.trim();
}

/**
 * Extracts structured OpenAPI JSDoc metadata from a function, method, or handler AST node.
 *
 * @param node - AST node to inspect for JSDoc comments.
 * @returns Extracted operation JSDoc metadata.
 */
export function extractDocMeta(node: Node): ExtractedOperationDocMeta {
	const nl = String.fromCharCode(10);
	const docs = getJsDocs(node);
	const primary = docs[0];
	if (!primary) return {};

	const rawComment = primary.getDescription().trim();
	const lines = rawComment
		.split(nl)
		.map((line) => line.trim())
		.filter(Boolean);

	const summary = lines[0];
	const description = lines.length > 1 ? lines.slice(1).join(nl) : undefined;

	const tags = primary.getTags();
	const deprecated =
		tags.some((tag) => tag.getTagName() === "deprecated") ||
		rawComment.toLowerCase().includes("@deprecated");

	const parsedTags = tags
		.filter((tag) => tag.getTagName() === "tag" || tag.getTagName() === "tags")
		.map((tag) => parseTagInput(getRawTagPayload(tag)))
		.reduce(
			(acc, next) => {
				acc.names.push(...next.names);
				acc.objects.push(...next.objects);
				return acc;
			},
			{ names: [] as string[], objects: [] as TagObject[] },
		);

	const tagNames = Array.from(new Set(parsedTags.names));
	const tagObjects = parsedTags.objects;

	const externalDocs = extractExternalDocs(tags);
	const servers = extractServers(tags);
	const security = extractSecurity(tags);
	const querystring = extractQuerystringParam(tags);

	const extensions: Record<string, OpenApiValue> = {};
	const responseHints: ResponseDocMeta[] = [];
	const responseSummaries: Record<string, string> = {};
	const paramDocs: Record<string, string> = {};
	const paramExamples: Record<string, OpenApiValue> = {};
	const paramSchemas: Record<string, SwaggerDefinition | boolean> = {};
	const requestExamples: Record<string, OpenApiValue> = {};
	const responseExamples: Record<string, Record<string, OpenApiValue>> = {};
	let operationId: string | undefined;

	tags.forEach((tag) => {
		const tagName = tag.getTagName();

		if (tagName === "param") {
			const paramTag = tag as JSDocTag & { getName: () => string };
			const desc = (paramTag.getCommentText() ?? "").trim();
			paramDocs[paramTag.getName()] = desc;
			return;
		}

		const rawTagText = getRawTagPayload(tag);

		if (tagName.startsWith("x-")) {
			extensions[tagName] = rawTagText ? parseDocValue(rawTagText) : true;
			return;
		}

		if (tagName === "operationId") {
			operationId = rawTagText.split(/\s+/)[0];
			return;
		}

		if (tagName === "response") {
			responseHints.push(parseResponseDocMeta(rawTagText));
			return;
		}

		if (tagName === "responseSummary") {
			const [status, ...rest] = rawTagText.split(/\s+/);
			responseSummaries[status as string] = rest.join(" ").trim();
			return;
		}

		if (tagName === "paramExample") {
			const [name, ...rest] = rawTagText.split(/\s+/);
			paramExamples[name as string] = parseDocValue(rest.join(" ").trim());
			return;
		}

		if (tagName === "paramSchema") {
			const [name, ...rest] = rawTagText.split(/\s+/);
			const normalized = normalizeParamSchemaOverride(
				parseDocValue(rest.join(" ").trim()),
			);
			if (normalized !== undefined) paramSchemas[name as string] = normalized;
			return;
		}

		if (tagName === "requestExample") {
			const parts = rawTagText.split(/\s+/).filter(Boolean);
			const mediaType = parts[0]?.includes("/")
				? (parts.shift() as string)
				: "*";
			requestExamples[mediaType] = parseDocValue(parts.join(" ").trim());
			return;
		}

		if (tagName === "responseExample") {
			const [status, ...rest] = rawTagText.split(/\s+/).filter(Boolean);
			const mediaType = rest[0]?.includes("/") ? (rest.shift() as string) : "*";
			const statusKey = status as string;
			const statusMap = responseExamples[statusKey] ?? {};
			responseExamples[statusKey] = statusMap;
			statusMap[mediaType] = parseDocValue(rest.join(" ").trim());
		}
	});

	if (Object.keys(responseSummaries).length > 0) {
		const responseIndex = new Map(
			responseHints.map((entry) => [entry.status, entry]),
		);

		Object.entries(responseSummaries).forEach(([status, sum]) => {
			const existing = responseIndex.get(status);
			if (existing) {
				existing.summary = sum;
			} else {
				responseHints.push({ status, summary: sum });
			}
		});
	}

	return {
		...(summary ? { summary } : {}),
		...(description ? { description } : {}),
		...(deprecated ? { deprecated } : {}),
		...(tagNames.length > 0 ? { tags: tagNames } : {}),
		...(tagObjects.length > 0 ? { tagObjects } : {}),
		...(externalDocs ? { externalDocs } : {}),
		...(servers.length > 0 ? { servers } : {}),
		...(security.length > 0 ? { security } : {}),
		...(querystring ? { querystring } : {}),
		...(Object.keys(extensions).length > 0 ? { extensions } : {}),
		...(operationId ? { operationId } : {}),
		...(responseHints.length > 0 ? { responses: responseHints } : {}),
		...(Object.keys(paramDocs).length > 0 ? { paramDocs } : {}),
		...(Object.keys(paramExamples).length > 0 ? { paramExamples } : {}),
		...(Object.keys(paramSchemas).length > 0 ? { paramSchemas } : {}),
		...(Object.keys(requestExamples).length > 0 ? { requestExamples } : {}),
		...(Object.keys(responseExamples).length > 0 ? { responseExamples } : {}),
	};
}

function extractQuerystringParam(
	tags: JSDocTag[],
): QuerystringMeta | undefined {
	const qsTag = tags.find((tag) => tag.getTagName() === "querystring");
	if (!qsTag) return undefined;

	const raw = getRawTagPayload(qsTag);

	if (raw.startsWith("{")) {
		const parsed = parseJsonMaybe(raw) as QuerystringMeta | undefined;
		if (!parsed || typeof parsed.name !== "string" || !parsed.name.trim()) {
			return undefined;
		}
		const encoding =
			parsed.encoding &&
			typeof parsed.encoding === "object" &&
			!Array.isArray(parsed.encoding)
				? parsed.encoding
				: undefined;

		return {
			name: parsed.name.trim(),
			...(parsed.contentType
				? { contentType: String(parsed.contentType) }
				: {}),
			...(encoding ? { encoding } : {}),
			...(typeof parsed.required === "boolean"
				? { required: parsed.required }
				: {}),
			...(parsed.description
				? { description: String(parsed.description) }
				: {}),
		};
	}

	const [name, ...parts] = raw.split(/\s+/).filter(Boolean);
	let contentType: string | undefined;
	let required: boolean | undefined;
	const descriptionParts: string[] = [];

	parts.forEach((part) => {
		const lower = part.toLowerCase();
		if (lower === "required" || lower === "optional") {
			required = lower === "required";
		} else if (!contentType && part.includes("/")) {
			contentType = part;
		} else {
			descriptionParts.push(part);
		}
	});

	const description =
		descriptionParts.length > 0 ? descriptionParts.join(" ") : undefined;

	return {
		name: name as string,
		...(contentType ? { contentType } : {}),
		...(required !== undefined ? { required } : {}),
		...(description ? { description } : {}),
	};
}

/**
 * Applies extracted `@querystring` JSDoc metadata to `paramMap`.
 *
 * @param docMeta - Extracted operation JSDoc metadata.
 * @param paramMap - Parameter map to update.
 */
export function applyQuerystringMeta(
	docMeta: ExtractedOperationDocMeta,
	paramMap: Map<string, CodeScanParam>,
): void {
	const querystring = docMeta.querystring;
	if (!querystring) return;

	addParam(paramMap, {
		...querystring,
		in: "querystring",
	});
}

/**
 * Applies `@param` JSDoc descriptions to matching parameters in `paramMap`.
 *
 * @param paramMap - Parameter map to update.
 * @param paramDocs - Map of parameter names to descriptions.
 */
export function applyParamDocs(
	paramMap: Map<string, CodeScanParam>,
	paramDocs?: Record<string, string>,
): void {
	if (!paramDocs) return;

	for (const param of paramMap.values()) {
		const description = paramDocs[param.name];
		if (description) {
			param.description = description;
		}
	}
}

/**
 * Applies `@paramExample` JSDoc values to matching parameters in `paramMap`.
 *
 * @param paramMap - Parameter map to update.
 * @param paramExamples - Map of parameter names to example values.
 */
export function applyParamExamples(
	paramMap: Map<string, CodeScanParam>,
	paramExamples?: Record<string, OpenApiValue>,
): void {
	if (!paramExamples) return;

	for (const param of paramMap.values()) {
		const example = paramExamples[param.name];
		if (example !== undefined) {
			param.example = example;
		}
	}
}

/**
 * Applies `@paramSchema` JSDoc overrides to matching parameters in `paramMap`.
 *
 * @param paramMap - Parameter map to update.
 * @param paramSchemas - Map of parameter names to schema overrides.
 */
export function applyParamSchemas(
	paramMap: Map<string, CodeScanParam>,
	paramSchemas?: Record<string, SwaggerDefinition | boolean>,
): void {
	if (!paramSchemas) return;

	for (const param of paramMap.values()) {
		if (param.in === "querystring") continue;
		const schema = paramSchemas[param.name];
		if (schema !== undefined) {
			param.schema = schema;
		}
	}
}

/**
 * Applies `@requestExample` JSDoc values onto a `CodeScanRequestBody`.
 *
 * @param requestBody - Request body descriptor to update.
 * @param requestExamples - Map of media types to example values.
 */
export function applyRequestExamples(
	requestBody: CodeScanRequestBody | undefined,
	requestExamples?: Record<string, OpenApiValue>,
): void {
	if (!requestBody || !requestExamples) return;
	requestBody.examples = { ...requestExamples };
}

/**
 * Applies `@responseExample` JSDoc values onto `CodeScanResponse` entries.
 *
 * @param responses - Response descriptors to update.
 * @param responseExamples - Map of status codes and media types to example values.
 */
export function applyResponseExamples(
	responses: CodeScanResponse[],
	responseExamples?: Record<string, Record<string, OpenApiValue>>,
): void {
	if (!responseExamples) return;

	responses.forEach((response) => {
		const examples = responseExamples[response.status];
		if (examples) {
			response.examples = { ...examples };
		}
	});
}

/**
 * Merges `@response` / `@responseSummary` JSDoc hints with inferred operation responses.
 *
 * @param responses - Base inferred responses.
 * @param hints - Optional JSDoc response hints.
 * @returns Merged array of `CodeScanResponse` entries.
 */
export function mergeResponseHints(
	responses: CodeScanResponse[],
	hints?: ResponseDocMeta[],
): CodeScanResponse[] {
	if (!hints || hints.length === 0) return responses;

	const responseMap = new Map<string, CodeScanResponse>();
	const ordered: string[] = [];

	responses.forEach((response) => {
		responseMap.set(response.status, { ...response });
		ordered.push(response.status);
	});

	hints.forEach((hint) => {
		const existing = responseMap.get(hint.status);

		if (!existing) {
			responseMap.set(hint.status, {
				status: hint.status,
				...(hint.summary ? { summary: hint.summary } : {}),
				...(hint.description ? { description: hint.description } : {}),
				contentTypes: hint.contentTypes ?? [],
			});
			ordered.push(hint.status);
			return;
		}

		if (hint.summary) existing.summary = hint.summary;
		if (hint.description) existing.description = hint.description;

		if (hint.contentTypes) {
			const contentTypes = new Set([
				...existing.contentTypes,
				...hint.contentTypes,
			]);
			existing.contentTypes = Array.from(contentTypes);
		}
	});

	return ordered.map((status) => responseMap.get(status) as CodeScanResponse);
}

function parseResponseDocMeta(raw: string): ResponseDocMeta {
	const [status, ...parts] = raw.split(/\s+/).filter(Boolean);

	let contentTypes: string[] | undefined;
	if (parts[0]?.includes("/")) {
		const mediaRaw = parts.shift() as string;
		contentTypes = mediaRaw
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	const description = parts.join(" ").trim();

	return {
		status: status as string,
		...(contentTypes ? { contentTypes } : {}),
		...(description ? { description } : {}),
	};
}

/**
 * Removes internal JSDoc helper fields before spreading metadata onto a `CodeScanOperation`.
 *
 * @param docMeta - Full extracted JSDoc metadata.
 * @returns Operation metadata with internal fields omitted.
 */
export function stripInternalDocMeta(
	docMeta: ExtractedOperationDocMeta,
): Omit<
	ExtractedOperationDocMeta,
	| "querystring"
	| "responses"
	| "paramDocs"
	| "paramExamples"
	| "paramSchemas"
	| "requestExamples"
	| "responseExamples"
	| "operationId"
> {
	const {
		querystring: _ignored,
		responses: _responses,
		paramDocs: _paramDocs,
		paramExamples: _paramExamples,
		paramSchemas: _paramSchemas,
		requestExamples: _requestExamples,
		responseExamples: _responseExamples,
		operationId: _operationId,
		...rest
	} = docMeta;

	return rest;
}

function extractExternalDocs(
	tags: JSDocTag[],
): ExternalDocumentationObject | undefined {
	const seeTag = tags.find((tag) => tag.getTagName() === "see");
	const raw = seeTag ? getRawTagPayload(seeTag) : "";
	if (!raw) return undefined;

	const [url, ...rest] = raw.split(/\s+/);
	const descriptionStr = rest.join(" ").trim();
	return descriptionStr
		? { url: url as string, description: descriptionStr }
		: { url: url as string };
}

function extractServers(tags: JSDocTag[]): ServerObject[] {
	const serverTags = tags.filter((tag) => tag.getTagName() === "server");
	const servers: ServerObject[] = [];

	serverTags.forEach((tag) => {
		const raw = getRawTagPayload(tag);

		const jsonServers = parseServerJson(raw);
		if (jsonServers) {
			servers.push(...jsonServers);
			return;
		}

		const [url, ...rest] = raw.split(/\s+/);
		const description = rest.join(" ").trim();
		servers.push(
			description
				? { url: url as string, description }
				: { url: url as string },
		);
	});

	return servers;
}

function extractSecurity(tags: JSDocTag[]): Record<string, string[]>[] {
	const securityTags = tags.filter((tag) => tag.getTagName() === "security");
	const requirements: Record<string, string[]>[] = [];

	securityTags.forEach((tag) => {
		const raw = getRawTagPayload(tag);

		if (raw.startsWith("{") || raw.startsWith("[")) {
			const parsed = parseJsonMaybe(raw);
			const entries = Array.isArray(parsed) ? parsed : [parsed];
			entries.forEach((entry) => {
				if (entry && typeof entry === "object") {
					requirements.push(entry as Record<string, string[]>);
				}
			});
			return;
		}

		const [scheme, ...rest] = raw.split(/\s+/);
		const scopes = rest
			.join(" ")
			.split(/[,\s]+/)
			.map((scope) => scope.trim())
			.filter(Boolean);
		requirements.push({ [scheme as string]: scopes });
	});

	return requirements;
}

function getJsDocs(node: Node): JSDoc[] {
	let current: Node | undefined = node;

	for (let depth = 0; current && depth < 5; depth += 1) {
		const withDocs = current as Node & {
			getJsDocs?: () => JSDoc[];
		};
		const docs = withDocs.getJsDocs?.() ?? [];
		if (docs.length > 0) return docs;
		current = current.getParent();
	}

	return [];
}

function parseTagList(comment: string): string[] {
	return comment
		.split(",")
		.flatMap((part) => part.trim().split(/\s+/))
		.map((part) => part.trim())
		.filter(Boolean);
}

function parseTagInput(raw: string): { names: string[]; objects: TagObject[] } {
	if (raw.startsWith("{") || raw.startsWith("[")) {
		const parsed = parseJsonMaybe(raw);
		return normalizeTagJson(parsed);
	}

	return { names: parseTagList(raw), objects: [] };
}

function normalizeTagJson(parsed: OpenApiValue): {
	names: string[];
	objects: TagObject[];
} {
	const names: string[] = [];
	const objects: TagObject[] = [];

	const pushTag = (entry: OpenApiValue) => {
		if (typeof entry === "string") {
			if (entry.trim()) names.push(entry.trim());
			return;
		}
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
		const tag = entry as TagObject;
		if (typeof tag.name !== "string" || !tag.name.trim()) return;
		const normalized = { ...tag, name: tag.name.trim() };
		names.push(normalized.name);
		objects.push(normalized);
	};

	const list = Array.isArray(parsed) ? parsed : [parsed];
	list.forEach(pushTag);

	return { names, objects };
}

function parseServerJson(raw: string): ServerObject[] | null {
	if (!raw.startsWith("{") && !raw.startsWith("[")) return null;

	const parsed = parseJsonMaybe(raw);
	if (!parsed) return [];

	const entries = Array.isArray(parsed) ? parsed : [parsed];
	const servers: ServerObject[] = [];

	entries.forEach((entry: OpenApiValue) => {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
		const candidate = entry as ServerObject;
		if (typeof candidate.url !== "string" || !candidate.url.trim()) return;
		servers.push({ ...candidate, url: candidate.url.trim() });
	});

	return servers;
}

function parseJsonMaybe(raw: string): OpenApiValue | undefined {
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

const EXAMPLE_WRAPPER_KEY = "__oasExample";

type ExampleCarrier = {
	[EXAMPLE_WRAPPER_KEY]: ExampleObject;
};

function isExampleCarrier(value: OpenApiValue): value is ExampleCarrier {
	if (!value || typeof value !== "object") return false;
	const wrapped = (value as Record<string, OpenApiValue>)[EXAMPLE_WRAPPER_KEY];
	return !!wrapped && typeof wrapped === "object" && !Array.isArray(wrapped);
}

/**
 * Unwraps an internal `__oasExample` carrier object into an `ExampleObject` if present.
 *
 * @param value - Candidate value that may wrap an `ExampleObject`.
 * @returns Unwrapped `ExampleObject` or `undefined`.
 */
export function unwrapExampleCarrier(
	value: OpenApiValue,
): ExampleObject | undefined {
	if (!isExampleCarrier(value)) return undefined;
	return value[EXAMPLE_WRAPPER_KEY];
}

function parseDocValue(value: string): OpenApiValue {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function normalizeParamSchemaOverride(
	value: OpenApiValue,
): SwaggerDefinition | boolean | undefined {
	if (typeof value === "boolean") return value;
	if (value && typeof value === "object" && !Array.isArray(value))
		return value as SwaggerDefinition;
	if (typeof value !== "string") return undefined;

	const trimmed = value.trim();
	if (PRIMITIVE_SCHEMA_TYPES.has(trimmed)) {
		return { type: trimmed as "string" };
	}

	if (trimmed.includes("/") || trimmed.includes(":")) {
		return { $ref: trimmed };
	}

	if (/^[A-Za-z0-9_.-]+$/.test(trimmed)) {
		return { $ref: `#/components/schemas/${trimmed}` };
	}

	return undefined;
}

/**
 * Extracts literal string or numeric text from an AST `Expression`.
 *
 * @param expression - Optional AST expression.
 * @returns Literal string value or `undefined`.
 */
export function extractLiteralText(
	expression?: Expression,
): string | undefined {
	if (expression && Node.isNumericLiteral(expression)) {
		return expression.getText();
	}
	return extractStringLiteral(expression);
}

/**
 * Extracts a string literal value from a `StringLiteral` or `NoSubstitutionTemplateLiteral` AST node.
 *
 * @param expression - Optional AST expression.
 * @returns Unquoted string literal or `undefined`.
 */
export function extractStringLiteral(
	expression?: Expression,
): string | undefined {
	if (
		expression &&
		(Node.isStringLiteral(expression) ||
			Node.isNoSubstitutionTemplateLiteral(expression))
	) {
		return expression.getLiteralText();
	}
	return undefined;
}

/**
 * Removes surrounding single or double quotes from `value`.
 *
 * @param value - String to unquote.
 * @returns Unquoted string.
 */
export function trimQuotes(value: string): string {
	return value.replace(/^['"]|['"]$/g, "");
}

/**
 * Checks whether `name` is a reserved HTTP header (`Accept`, `Content-Type`, `Authorization`).
 *
 * @param name - Candidate header name.
 * @returns `true` if `name` is a reserved header.
 */
export function isReservedHeaderParam(name: string): boolean {
	return RESERVED_HEADER_NAMES.has(name.toLowerCase());
}

/**
 * Infers request and response schemas from Express handler parameter type annotations (`Request<...>`, `Response<...>`).
 *
 * @param handler - Express route handler AST node.
 * @returns Inferred `ExpressSchemaHints`.
 */
export function inferExpressSchemaHints(handler: Node): ExpressSchemaHints {
	const fnNode = handler as Node & {
		getParameters: () => ParameterDeclaration[];
	};
	const params = fnNode.getParameters();
	const reqParam = params[0];
	const resParam = params[1];
	let requestSchema: SwaggerDefinition | boolean | undefined;
	let responseSchema: SwaggerDefinition | boolean | undefined;

	if (reqParam) {
		const extracted = extractSchemasFromRequestType(reqParam.getTypeNode());
		requestSchema = extracted.requestSchema;
		responseSchema = extracted.responseSchema;
	}

	if (resParam) {
		const inferred = extractSchemaFromResponseType(resParam.getTypeNode());
		if (inferred !== undefined) {
			responseSchema = inferred;
		}
	}

	return {
		...(requestSchema !== undefined ? { requestSchema } : {}),
		...(responseSchema !== undefined ? { responseSchema } : {}),
	};
}

/**
 * Infers an OpenAPI response schema from a function or method return type annotation.
 *
 * @param handler - Function or method AST node.
 * @returns Inferred `SwaggerDefinition`, boolean schema, or `undefined`.
 */
export function inferReturnSchemaFromSignature(
	handler: Node,
): SwaggerDefinition | boolean | undefined {
	const handlerWithReturn = handler as Node & {
		getReturnTypeNode: () => TypeNode | undefined;
	};
	const returnTypeNode = handlerWithReturn.getReturnTypeNode();
	if (!returnTypeNode) return undefined;

	const unwrapped = unwrapContainerTypeNode(returnTypeNode);
	if (
		isVoidTypeNode(unwrapped) ||
		isResponseTypeName(getTypeNodeName(unwrapped))
	) {
		return undefined;
	}

	return inferSchemaFromTypeNode(unwrapped);
}

function extractSchemasFromRequestType(typeNode?: TypeNode): {
	requestSchema?: SwaggerDefinition | boolean;
	responseSchema?: SwaggerDefinition | boolean;
} {
	if (!typeNode || !Node.isTypeReference(typeNode)) return {};
	if (!isRequestTypeName(getTypeNodeName(typeNode))) return {};

	const args = typeNode.getTypeArguments();
	const infReq = inferSchemaFromTypeNode(args[2]);
	const infRes = inferSchemaFromTypeNode(args[1]);

	return {
		...(infReq !== undefined ? { requestSchema: infReq } : {}),
		...(infRes !== undefined ? { responseSchema: infRes } : {}),
	};
}

function extractSchemaFromResponseType(
	typeNode?: TypeNode,
): SwaggerDefinition | boolean | undefined {
	if (!typeNode || !Node.isTypeReference(typeNode)) return undefined;
	if (!isResponseTypeName(getTypeNodeName(typeNode))) return undefined;
	return inferSchemaFromTypeNode(typeNode.getTypeArguments()[0]);
}

/**
 * Converts a `ts-morph` `TypeNode` (unwrapping `Promise`/`Observable`) into an OpenAPI schema.
 *
 * @param typeNode - Optional TypeScript AST `TypeNode`.
 * @returns Inferred `SwaggerDefinition`, boolean schema, or `undefined`.
 */
export function inferSchemaFromTypeNode(
	typeNode?: TypeNode,
): SwaggerDefinition | boolean | undefined {
	if (!typeNode) return undefined;

	const unwrapped = unwrapContainerTypeNode(typeNode);
	if (isVoidTypeNode(unwrapped)) return undefined;

	if (Node.isTypeReference(unwrapped)) {
		const primitiveSchema = PRIMITIVE_REF_MAP[getTypeNodeName(unwrapped)];
		if (primitiveSchema) return primitiveSchema;
	}

	const schema = schemaFromTypeNode(unwrapped);
	return Object.keys(schema).length === 0 ? undefined : schema;
}

function unwrapContainerTypeNode(typeNode: TypeNode): TypeNode {
	if (!Node.isTypeReference(typeNode)) return typeNode;

	const typeName = getTypeNodeName(typeNode);
	if (
		typeName === "Promise" ||
		typeName === "PromiseLike" ||
		typeName === "Observable"
	) {
		return unwrapContainerTypeNode(typeNode.getTypeArguments()[0] as TypeNode);
	}

	return typeNode;
}

function getTypeNodeName(typeNode: TypeNode): string {
	return Node.isTypeReference(typeNode) ? typeNode.getTypeName().getText() : "";
}

function isVoidTypeNode(typeNode: TypeNode): boolean {
	return (
		typeNode.getKind() === SyntaxKind.VoidKeyword ||
		typeNode.getKind() === SyntaxKind.NeverKeyword
	);
}

function isRequestTypeName(typeName: string): boolean {
	return typeName === "Request" || typeName.endsWith(".Request");
}

function isResponseTypeName(typeName: string): boolean {
	return typeName === "Response" || typeName.endsWith(".Response");
}
