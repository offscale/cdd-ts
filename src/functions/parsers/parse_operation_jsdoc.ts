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
	if (param.required && !existing.required) {
		existing.required = true;
	}
	if (param.description && !existing.description) {
		existing.description = param.description;
	}
	if (param.contentType && !existing.contentType) {
		existing.contentType = param.contentType;
	}
	if (param.encoding && !existing.encoding) {
		existing.encoding = param.encoding;
	}
}

/**
 * Extracts structured OpenAPI JSDoc metadata from a function, method, or handler AST node.
 *
 * @param node - AST node to inspect for JSDoc comments.
 * @returns Extracted operation JSDoc metadata.
 */
export function extractDocMeta(node: Node): ExtractedOperationDocMeta {
	const docs = getJsDocs(node);

	if (!docs.length) return {};

	const primary = docs[0];

	const rawComment = normalizeDocComment(primary.getComment());

	const lines = rawComment

		.split(/\r?\n/)

		.map((line) => line.trim())
		.filter(Boolean);

	const summary = lines.length > 0 ? lines[0] : undefined;

	const description = lines.length > 1 ? lines.slice(1).join("\n") : undefined;

	const tags = primary.getTags();
	const deprecated =
		tags.some((tag) => tag.getTagName() === "deprecated") ||
		rawComment.toLowerCase().includes("@deprecated");

	const parsedTags = tags

		.filter((tag) => tag.getTagName() === "tag" || tag.getTagName() === "tags")

		.map((tag) => parseTagInput(normalizeDocComment(tag.getComment())))
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

		if (tagName === "operationId") {
			const raw = normalizeDocComment(tag.getComment()).trim();

			if (raw) {
				const [value] = raw.split(/\s+/).filter(Boolean);

				if (value) operationId = value;
			}

			return;
		}

		if (tagName === "response") {
			const raw = normalizeDocComment(tag.getComment()).trim();

			const parsed = parseResponseDocMeta(raw);

			if (parsed) responseHints.push(parsed);

			return;
		}

		if (tagName === "responseSummary") {
			const raw = normalizeDocComment(tag.getComment()).trim();

			const parsed = parseResponseSummary(raw);

			if (parsed) responseSummaries[parsed.status] = parsed.summary;

			return;
		}

		if (tagName === "paramExample") {
			const rawTagText = normalizeDocComment(tag.getComment()).trim();

			if (!rawTagText) return;

			const parts = rawTagText.split(/\s+/).filter(Boolean);

			const name = parts.shift();

			if (!name || parts.length === 0) return;

			const valueText = parts.join(" ").trim();

			if (!valueText) return;

			paramExamples[name] = parseDocValue(valueText);

			return;
		}

		if (tagName === "paramSchema") {
			const rawTagText = normalizeDocComment(tag.getComment()).trim();

			if (!rawTagText) return;

			const parts = rawTagText.split(/\s+/).filter(Boolean);

			const name = parts.shift();

			if (!name || parts.length === 0) return;

			const valueText = parts.join(" ").trim();

			if (!valueText) return;

			const parsed = parseDocValue(valueText);

			const normalized = normalizeParamSchemaOverride(parsed);

			if (normalized !== undefined) paramSchemas[name] = normalized;

			return;
		}

		if (tagName === "requestExample") {
			const rawTagText = normalizeDocComment(tag.getComment()).trim();

			if (!rawTagText) return;

			const parts = rawTagText.split(/\s+/).filter(Boolean);

			if (parts.length === 0) return;

			let mediaType: string | undefined;

			if (parts[0].includes("/")) {
				mediaType = parts.shift();
			}

			const valueText = parts.join(" ").trim();

			if (!valueText) return;

			requestExamples[mediaType ?? "*"] = parseDocValue(valueText);

			return;
		}

		if (tagName === "responseExample") {
			const rawTagText = normalizeDocComment(tag.getComment()).trim();

			if (!rawTagText) return;

			const parts = rawTagText.split(/\s+/).filter(Boolean);

			const status = parts.shift();

			if (!status || parts.length === 0) return;

			let mediaType: string | undefined;

			if (parts[0].includes("/")) {
				mediaType = parts.shift();
			}

			const valueText = parts.join(" ").trim();

			if (!valueText) return;

			if (!responseExamples[status]) responseExamples[status] = {};

			responseExamples[status][mediaType ?? "*"] = parseDocValue(valueText);

			return;
		}

		if (tagName === "param") {
			const parsed = parseParamDoc(tag);

			if (parsed) {
				paramDocs[parsed.name] = parsed.description;
			}

			return;
		}

		if (!tagName.startsWith("x-")) return;

		const raw = normalizeDocComment(tag.getComment()).trim();

		if (!raw) {
			extensions[tagName] = true;

			return;
		}

		try {
			extensions[tagName] = JSON.parse(raw);
		} catch {
			extensions[tagName] = raw;
		}
	});

	if (Object.keys(responseSummaries).length > 0) {
		const responseIndex = new Map(
			responseHints.map((entry) => [entry.status, entry]),
		);

		Object.entries(responseSummaries).forEach(([status, summary]) => {
			const existing = responseIndex.get(status);

			if (existing) {
				existing.summary = existing.summary ?? summary;

				return;
			}

			responseHints.push({ status, summary });
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

	const raw = normalizeDocComment(qsTag.getComment()).trim();

	if (!raw) return undefined;

	if (raw.startsWith("{")) {
		try {
			const parsed = JSON.parse(raw) as QuerystringMeta;

			if (
				parsed &&
				typeof parsed === "object" &&
				typeof parsed.name === "string" &&
				parsed.name.trim()
			) {
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
		} catch {
			// Ignore malformed JSON to avoid crashing scans
		}

		return undefined;
	}

	const parts = raw.split(/\s+/).filter(Boolean);

	const name = parts.shift();

	if (!name) return undefined;

	let contentType: string | undefined;
	let required: boolean | undefined;

	const descriptionParts: string[] = [];

	parts.forEach((part) => {
		const lower = part.toLowerCase();

		if (lower === "required") {
			required = true;

			return;
		}

		if (lower === "optional") {
			required = false;

			return;
		}

		if (!contentType && part.includes("/")) {
			contentType = part;

			return;
		}

		descriptionParts.push(part);
	});

	const description =
		descriptionParts.length > 0 ? descriptionParts.join(" ") : undefined;

	return {
		name,

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
		name: querystring.name,
		in: "querystring",

		...(querystring.required !== undefined
			? { required: querystring.required }
			: {}),

		...(querystring.description
			? { description: querystring.description }
			: {}),

		...(querystring.contentType
			? { contentType: querystring.contentType }
			: {}),

		...(querystring.encoding ? { encoding: querystring.encoding } : {}),
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
		if (param.description) continue;

		const direct = paramDocs[param.name];

		const normalized = paramDocs[param.name.replace(/[{}]/g, "")];

		const description = direct ?? normalized;

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
		if (param.example !== undefined) continue;

		const direct = paramExamples[param.name];

		const normalized = paramExamples[param.name.replace(/[{}]/g, "")];

		const example = direct ?? normalized;

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

		const direct = paramSchemas[param.name];

		const normalized = paramSchemas[param.name.replace(/[{}]/g, "")];

		const schema = direct ?? normalized;

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
	if (
		!requestBody ||
		!requestExamples ||
		Object.keys(requestExamples).length === 0
	)
		return;

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

		if (examples && Object.keys(examples).length > 0) {
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

		if (hint.summary) {
			existing.summary = hint.summary;
		}

		if (hint.description) {
			existing.description = hint.description;
		}

		if (hint.contentTypes && hint.contentTypes.length > 0) {
			if (existing.contentTypes.length === 0) {
				existing.contentTypes = [...hint.contentTypes];
			} else {
				const contentTypes = new Set(existing.contentTypes);

				hint.contentTypes.forEach((entry) => contentTypes.add(entry));

				existing.contentTypes = Array.from(contentTypes);
			}
		}
	});

	return ordered.map((status) => responseMap.get(status) as CodeScanResponse);
}

function parseResponseDocMeta(raw: string): ResponseDocMeta | undefined {
	if (!raw) return undefined;

	const parts = raw.split(/\s+/).filter(Boolean);

	const status = parts.shift();

	if (!status) return undefined;

	let contentTypes: string[] | undefined;

	if (parts.length > 0 && parts[0].includes("/")) {
		const mediaRaw = parts.shift() as string;

		contentTypes = mediaRaw

			.split(",")

			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	const description = parts.join(" ").trim();

	return {
		status,

		...(contentTypes && contentTypes.length > 0 ? { contentTypes } : {}),

		...(description ? { description } : {}),
	};
}

function parseResponseSummary(
	raw: string,
): { status: string; summary: string } | undefined {
	if (!raw) return undefined;

	const parts = raw.split(/\s+/).filter(Boolean);

	const status = parts.shift();

	if (!status) return undefined;

	const summary = parts.join(" ").trim();

	if (!summary) return undefined;

	return { status, summary };
}

function parseParamDoc(
	tag: JSDocTag,
): { name: string; description: string } | undefined {
	if (Node.isJSDocParameterTag(tag)) {
		const name = tag.getName();

		const description = normalizeDocComment(tag.getComment()).trim();

		if (name && description) {
			return { name, description };
		}

		return undefined;
	}

	const rawText = tag

		.getText()
		.replace(/^\s*\*?\s*@param\s+/i, "")
		.trim();
	let name: string | undefined;

	let description = "";

	if (rawText) {
		const cleaned = rawText.replace(/\r?\n\s*\*\s?/g, " ").trim();

		const match = cleaned.match(/^(?:\{[^}]+\}\s*)?(\S+)\s*([\s\S]*)$/);

		if (match) {
			name = match[1];

			description = (match[2] || "").trim();
		}
	}

	if (!name) {
		const fallback = normalizeDocComment(tag.getComment());

		const parts = fallback.split(/\s+/).filter(Boolean);

		if (parts.length === 0) return undefined;

		name = parts.shift();

		if (name?.startsWith("{")) {
			name = parts.shift();
		}

		description = parts.join(" ").trim();
	}

	if (!name || !description) return undefined;

	return { name, description };
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

	if (!seeTag) return undefined;

	let raw = normalizeDocComment(seeTag.getComment()).trim();

	if (!raw || raw.startsWith("://")) {
		const text = seeTag.getText();

		const line = text.split(/\r?\n/)[0] ?? "";

		const cleaned = line.replace(/^\s*\*?\s*@see\s+/i, "").trim();

		if (cleaned) {
			raw = cleaned;
		}
	}

	if (!raw) return undefined;

	const parts = raw.split(/\s+/);

	const url = parts.shift();

	if (!url) return undefined;

	const descriptionStr = parts.join(" ").trim();

	return descriptionStr ? { url, description: descriptionStr } : { url };
}

function extractServers(tags: JSDocTag[]): ServerObject[] {
	const serverTags = tags.filter((tag) => tag.getTagName() === "server");

	const servers: ServerObject[] = [];

	serverTags.forEach((tag) => {
		const raw = normalizeDocComment(tag.getComment()).trim();

		if (!raw) return;

		const jsonServers = parseServerJson(raw);

		if (jsonServers) {
			servers.push(...jsonServers);

			return;
		}

		const parts = raw.split(/\s+/);

		const url = parts.shift();

		if (!url) return;

		const description = parts.join(" ").trim();

		servers.push(description ? { url, description } : { url });
	});

	return servers;
}

function extractSecurity(tags: JSDocTag[]): Record<string, string[]>[] {
	const securityTags = tags.filter((tag) => tag.getTagName() === "security");

	const requirements: Record<string, string[]>[] = [];

	securityTags.forEach((tag) => {
		const raw = normalizeDocComment(tag.getComment()).trim();

		if (!raw) return;

		if (raw.startsWith("{") || raw.startsWith("[")) {
			const parsed = parseSecurityJson(raw);

			if (parsed.length > 0) {
				requirements.push(...parsed);
			}

			return;
		}

		const [scheme, ...rest] = raw.split(/\s+/);

		if (!scheme) return;

		const scopes = rest

			.join(" ")
			.split(/[,\s]+/)

			.map((scope) => scope.trim())
			.filter(Boolean);

		requirements.push({ [scheme]: scopes });
	});

	return requirements;
}

function parseSecurityJson(raw: string): Record<string, string[]>[] {
	try {
		const parsed = JSON.parse(raw) as OpenApiValue;

		if (Array.isArray(parsed)) {
			return parsed.filter(
				(entry: OpenApiValue): entry is Record<string, string[]> =>
					!!entry && typeof entry === "object",
			);
		}

		if (parsed && typeof parsed === "object") {
			return [parsed as Record<string, string[]>];
		}
	} catch {
		return [];
	}

	return [];
}

function getJsDocs(node: Node): JSDoc[] {
	let current: Node | undefined = node;

	for (let depth = 0; current && depth < 4; depth += 1) {
		const withDocs = current as Node & {
			getJsDocs?: () => JSDoc[];
		};

		const docs = withDocs.getJsDocs ? withDocs.getJsDocs() : [];

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
	const trimmed = raw.trim();

	if (!trimmed) return { names: [], objects: [] };

	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		const parsed = parseJsonMaybe(trimmed);

		return normalizeTagJson(parsed);
	}

	return { names: parseTagList(trimmed), objects: [] };
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

	if (Array.isArray(parsed)) {
		parsed.forEach((entry: OpenApiValue) => pushTag(entry));
	} else {
		pushTag(parsed);
	}

	return { names, objects };
}

function parseServerJson(raw: string): ServerObject[] | null {
	const trimmed = raw.trim();

	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;

	const parsed = parseJsonMaybe(trimmed);

	if (!parsed) return [];

	const entries = Array.isArray(parsed) ? parsed : [parsed];

	const servers: ServerObject[] = [];

	entries.forEach((entry: OpenApiValue) => {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;

		const candidate = entry as ServerObject;

		if (typeof candidate.url !== "string" || candidate.url.trim().length === 0)
			return;

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

function normalizeDocComment(comment: OpenApiValue): string {
	if (!comment) return "";

	if (typeof comment === "string") return comment;

	if (Array.isArray(comment))
		return comment
			.map((part: OpenApiValue) => normalizeDocComment(part))
			.join("");

	if (Node.isNode(comment)) return comment.getText();

	return String(comment);
}

const EXAMPLE_WRAPPER_KEY = "__oasExample";

type ExampleCarrier = {
	[EXAMPLE_WRAPPER_KEY]: ExampleObject;
};

function isExampleCarrier(value: OpenApiValue): value is ExampleCarrier {
	if (!value || typeof value !== "object") return false;

	if (!(EXAMPLE_WRAPPER_KEY in (value as Record<string, OpenApiValue>)))
		return false;

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

	return (value as ExampleCarrier)[EXAMPLE_WRAPPER_KEY];
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

	if (!trimmed) return undefined;

	const primitiveTypes = new Set([
		"string",
		"number",
		"integer",
		"boolean",
		"object",
		"array",
		"null",
	]);

	if (primitiveTypes.has(trimmed)) {
		return { type: trimmed as "string" };
	}

	if (
		trimmed.startsWith("#") ||
		trimmed.startsWith("./") ||
		trimmed.startsWith("../") ||
		/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
	) {
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
	if (!expression) return undefined;

	if (Node.isNumericLiteral(expression)) return expression.getText();

	if (
		Node.isStringLiteral(expression) ||
		Node.isNoSubstitutionTemplateLiteral(expression)
	) {
		return expression.getLiteralText();
	}

	return undefined;
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
	if (!expression) return undefined;

	if (
		Node.isStringLiteral(expression) ||
		Node.isNoSubstitutionTemplateLiteral(expression)
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
export function isReservedHeaderParam(name?: string): boolean {
	if (!name) return false;

	return RESERVED_HEADER_NAMES.has(name.toLowerCase());
}

/**
 * Infers request and response schemas from Express handler parameter type annotations (`Request<...>`, `Response<...>`).
 *
 * @param handler - Express route handler AST node.
 * @returns Inferred `ExpressSchemaHints`.
 */
export function inferExpressSchemaHints(handler: Node): ExpressSchemaHints {
	const fnNode = handler as Node;

	if (
		!fnNode ||
		typeof (
			fnNode as OpenApiValue as {
				getParameters(): ParameterDeclaration[];
			}
		).getParameters !== "function"
	)
		return {};

	const params = (
		fnNode as OpenApiValue as {
			getParameters(): ParameterDeclaration[];
		}
	).getParameters();

	const reqParam = params[0];

	const resParam = params[1];
	let requestSchema: SwaggerDefinition | boolean | undefined;
	let responseSchema: SwaggerDefinition | boolean | undefined;

	if (reqParam) {
		const reqTypeNode = reqParam.getTypeNode();

		const extracted = extractSchemasFromRequestType(reqTypeNode);

		if (extracted.requestSchema !== undefined) {
			requestSchema = extracted.requestSchema;
		}

		if (extracted.responseSchema !== undefined) {
			responseSchema = extracted.responseSchema;
		}
	}

	if (resParam) {
		const resTypeNode = resParam.getTypeNode();

		const inferred = extractSchemaFromResponseType(resTypeNode);

		if (inferred !== undefined) {
			responseSchema = inferred;
		}
	}

	const result: {
		requestSchema?: SwaggerDefinition | boolean;
		responseSchema?: SwaggerDefinition | boolean;
	} = {};

	if (requestSchema !== undefined) result.requestSchema = requestSchema;

	if (responseSchema !== undefined) result.responseSchema = responseSchema;

	return result;
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
	const returnTypeNode =
		"getReturnTypeNode" in handler &&
		typeof (
			handler as OpenApiValue as {
				getReturnTypeNode: () => TypeNode | undefined;
			}
		).getReturnTypeNode === "function"
			? (
					handler as OpenApiValue as {
						getReturnTypeNode: () => TypeNode | undefined;
					}
				).getReturnTypeNode()
			: undefined;

	if (!returnTypeNode) return undefined;

	const unwrapped = unwrapContainerTypeNode(returnTypeNode);

	if (isVoidTypeNode(unwrapped)) return undefined;

	if (isResponseTypeName(getTypeNodeName(unwrapped))) return undefined;

	return inferSchemaFromTypeNode(unwrapped);
}

function extractSchemasFromRequestType(typeNode?: TypeNode): {
	requestSchema?: SwaggerDefinition | boolean;
	responseSchema?: SwaggerDefinition | boolean;
} {
	if (!typeNode || !Node.isTypeReference(typeNode)) return {};

	if (!isRequestTypeName(getTypeNodeName(typeNode))) return {};

	const args = typeNode.getTypeArguments();

	const responseArg = args[1];

	const requestArg = args[2];

	const result: {
		requestSchema?: SwaggerDefinition | boolean;
		responseSchema?: SwaggerDefinition | boolean;
	} = {};

	if (requestArg) {
		const infReq = inferSchemaFromTypeNode(requestArg);

		if (infReq !== undefined) result.requestSchema = infReq;
	}

	if (responseArg) {
		const infRes = inferSchemaFromTypeNode(responseArg);

		if (infRes !== undefined) result.responseSchema = infRes;
	}

	return result;
}

function extractSchemaFromResponseType(
	typeNode?: TypeNode,
): SwaggerDefinition | boolean | undefined {
	if (!typeNode || !Node.isTypeReference(typeNode)) return undefined;

	if (!isResponseTypeName(getTypeNodeName(typeNode))) return undefined;

	const arg = typeNode.getTypeArguments()[0];

	return inferSchemaFromTypeNode(arg);
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
		const typeName = getTypeNodeName(unwrapped);

		const primitiveSchema = schemaForPrimitiveReference(typeName);

		if (primitiveSchema) return primitiveSchema;
	}

	const schema = schemaFromTypeNode(unwrapped);

	return isEmptySchema(schema as SwaggerDefinition) ? undefined : schema;
}

function unwrapContainerTypeNode(typeNode: TypeNode): TypeNode {
	if (!Node.isTypeReference(typeNode)) return typeNode;

	const typeName = getTypeNodeName(typeNode);

	if (
		typeName === "Promise" ||
		typeName === "PromiseLike" ||
		typeName === "Observable"
	) {
		const arg = typeNode.getTypeArguments()[0];

		if (arg) {
			return unwrapContainerTypeNode(arg);
		}
	}

	return typeNode;
}

function getTypeNodeName(typeNode: TypeNode): string {
	if (!Node.isTypeReference(typeNode)) return "";

	return typeNode.getTypeName().getText();
}

function schemaForPrimitiveReference(
	typeName: string,
): SwaggerDefinition | undefined {
	switch (typeName) {
		case "String":
			return { type: "string" };

		case "Number":
			return { type: "number" };

		case "Boolean":
			return { type: "boolean" };

		case "Object":
			return { type: "object" };

		default:
			return undefined;
	}
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

function isEmptySchema(schema: SwaggerDefinition): boolean {
	return Object.keys(schema).length === 0;
}
