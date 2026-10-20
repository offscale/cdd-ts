/**
 * OpenAPI Response Object, Link Object, Callback expression, Example Object, MediaType Object, Encoding Object, and RequestBody validation.
 *
 * @module openapi/validators/validate_responses_links
 */
import type { OpenApiValue, ServerObject } from "../../core/types/index.js";
import { isUriReference, SpecValidationError } from "./validate_info.js";
import {
	PARAM_STYLE_BY_IN,
	validateHeaderObject,
	validateHeadersMap,
} from "./validate_parameters_headers.js";
import {
	isRefLike,
	validateReferenceObject,
	validateSchemaExternalDocs,
} from "./validate_schemas.js";
import { validateServers } from "./validate_servers_tags.js";

const RUNTIME_HEADER_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function isValidJsonPointer(pointer: string): boolean {
	if (pointer === "") return true;
	if (!pointer.startsWith("/")) return false;
	return /^\/([^~/]|~[01])*(\/([^~/]|~[01])*)*$/.test(pointer);
}

function isValidRuntimeExpression(expression: string): boolean {
	if (!expression || typeof expression !== "string") return false;
	if (
		expression === "$url" ||
		expression === "$method" ||
		expression === "$statusCode"
	)
		return true;

	const isRequest = expression.startsWith("$request.");
	const isResponse = expression.startsWith("$response.");
	if (!isRequest && !isResponse) return false;

	const source = expression.substring(isRequest ? 9 : 10);
	if (source.startsWith("header.")) {
		const token = source.substring(7);
		return RUNTIME_HEADER_TOKEN.test(token);
	}

	if (isRequest) {
		if (source.startsWith("query.")) {
			return source.substring(6).length > 0;
		}
		if (source.startsWith("path.")) {
			return source.substring(5).length > 0;
		}
	}

	if (source === "body") return true;
	if (source.startsWith("body#")) {
		const pointer = source.substring(5);
		return isValidJsonPointer(pointer);
	}

	return false;
}

/** Mode controlling whether a runtime expression string without braces must still start with `$`. */
export type RuntimeExpressionMode = "required" | "optional";

/**
 * Validates a runtime expression or template containing `{...}` runtime expressions.
 *
 * @param expression - Candidate runtime expression or template string.
 * @param location - Diagnostic location path.
 * @param _mode - Whether a bare string without braces must still be a runtime expression.
 * @param label - Human-readable label for error reporting.
 * @throws {SpecValidationError} When the expression syntax is invalid.
 */
export function validateRuntimeExpressionTemplate(
	expression: string,
	location: string,
	_mode: RuntimeExpressionMode,
	label = "Runtime expression",
): void {
	if (typeof expression !== "string" || expression.length === 0) {
		throw new SpecValidationError(
			`${label} at '${location}' must be a non-empty string.`,
		);
	}

	const hasOpen = expression.includes("{");
	const hasClose = expression.includes("}");

	if (hasOpen || hasClose) {
		const matches = [...expression.matchAll(/\{([^}]+)\}/g)];
		if (matches.length === 0) {
			throw new SpecValidationError(
				`${label} at '${location}' contains unmatched braces and cannot be evaluated.`,
			);
		}

		for (const match of matches) {
			const inner = (match[1] as string).trim();
			if (!isValidRuntimeExpression(inner)) {
				throw new SpecValidationError(
					`${label} at '${location}' contains invalid runtime expression '{${inner}}'.`,
				);
			}
		}

		const stripped = expression.replace(/\{[^}]*\}/g, "");
		if (stripped.includes("{") || stripped.includes("}")) {
			throw new SpecValidationError(
				`${label} at '${location}' contains unmatched braces and cannot be evaluated.`,
			);
		}
		return;
	}

	if (!isValidRuntimeExpression(expression)) {
		throw new SpecValidationError(
			`${label} at '${location}' must be a valid runtime expression. Value: "${expression}"`,
		);
	}
}

/**
 * Validates a Callback Object key expression.
 *
 * @param expression - Callback URL runtime expression key.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When the callback expression is invalid.
 */
export function validateCallbackExpression(
	expression: string,
	location: string,
): void {
	validateRuntimeExpressionTemplate(
		expression,
		location,
		"required",
		"Callback expression",
	);
}

/**
 * Validates OAS 3.2 Example Object field exclusivity (`value`, `dataValue`, `serializedValue`, `externalValue`).
 *
 * @param exampleObj - Candidate Example Object.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When mutually exclusive example fields are combined or mistyped.
 */
export function validateExampleObject(
	exampleObj: OpenApiValue,
	location: string,
): void {
	if (!exampleObj || typeof exampleObj !== "object") return;

	if (isRefLike(exampleObj)) {
		validateReferenceObject(exampleObj, location);
		return;
	}

	const example = exampleObj as {
		value?: OpenApiValue;
		dataValue?: OpenApiValue;
		serializedValue?: OpenApiValue;
		externalValue?: string;
	};

	const hasValue = example.value !== undefined;
	const hasDataValue = example.dataValue !== undefined;
	const hasSerialized = example.serializedValue !== undefined;
	const hasExternal = example.externalValue !== undefined;

	if (hasValue && hasDataValue) {
		throw new SpecValidationError(
			`Example Object at '${location}' cannot define both 'value' and 'dataValue'. These fields are mutually exclusive.`,
		);
	}
	if (hasValue && hasSerialized) {
		throw new SpecValidationError(
			`Example Object at '${location}' cannot define both 'value' and 'serializedValue'. These fields are mutually exclusive.`,
		);
	}
	if (hasValue && hasExternal) {
		throw new SpecValidationError(
			`Example Object at '${location}' cannot define both 'value' and 'externalValue'. These fields are mutually exclusive.`,
		);
	}
	if (hasSerialized && hasExternal) {
		throw new SpecValidationError(
			`Example Object at '${location}' cannot define both 'serializedValue' and 'externalValue'. These fields are mutually exclusive.`,
		);
	}
	if (hasSerialized && typeof example.serializedValue !== "string") {
		throw new SpecValidationError(
			`Example Object at '${location}' has a non-string 'serializedValue'. It MUST be a string.`,
		);
	}
	if (hasExternal && typeof example.externalValue !== "string") {
		throw new SpecValidationError(
			`Example Object at '${location}' has a non-string 'externalValue'. It MUST be a string.`,
		);
	}
}

function normalizeMediaType(value: string | undefined): string {
	if (!value) return "";
	return (value.split(";")[0] as string).trim().toLowerCase();
}

function isMultipartMediaType(mediaType: string | undefined): boolean {
	return normalizeMediaType(mediaType).startsWith("multipart/");
}

const SEQUENTIAL_MEDIA_TYPES = new Set([
	"application/json-seq",
	"application/geo+json-seq",
	"application/jsonl",
	"application/jsonlines",
	"application/x-ndjson",
	"application/ndjson",
	"application/x-jsonlines",
	"text/event-stream",
	"multipart/mixed",
]);

const SEQUENTIAL_MEDIA_SUFFIXES = new Set([
	"+json-seq",
	"+jsonl",
	"+ndjson",
	"/json-seq",
	"/jsonl",
	"/ndjson",
	"/x-ndjson",
]);

function isSequentialMediaType(mediaType: string): boolean {
	const normalized = normalizeMediaType(mediaType);
	if (normalized.startsWith("multipart/")) return true;
	if (SEQUENTIAL_MEDIA_TYPES.has(normalized)) return true;
	for (const suffix of SEQUENTIAL_MEDIA_SUFFIXES) {
		if (normalized.endsWith(suffix)) return true;
	}
	return false;
}

function isCustomSequentialJsonMediaType(mediaType: string): boolean {
	const normalized = normalizeMediaType(mediaType);
	if (normalized === "application/json" || normalized === "*/*") return false;
	return normalized.includes("json");
}

function isFormUrlEncodedMediaType(mediaType: string | undefined): boolean {
	return normalizeMediaType(mediaType) === "application/x-www-form-urlencoded";
}

function validateEncodingObject(
	encodingObj: OpenApiValue,
	location: string,
): void {
	if (
		!encodingObj ||
		typeof encodingObj !== "object" ||
		Array.isArray(encodingObj)
	) {
		throw new SpecValidationError(
			`Encoding Object at '${location}' must be an object.`,
		);
	}

	const encoding = encodingObj as {
		contentType?: string;
		headers?: Record<string, OpenApiValue>;
		style?: string;
		explode?: boolean;
		allowReserved?: boolean;
		encoding?: Record<string, OpenApiValue>;
		prefixEncoding?: string[];
		itemEncoding?: Record<string, OpenApiValue>;
	};

	if (
		encoding.contentType !== undefined &&
		typeof encoding.contentType !== "string"
	) {
		throw new SpecValidationError(
			`Encoding Object at '${location}' has non-string 'contentType'.`,
		);
	}

	if (encoding.style !== undefined && typeof encoding.style !== "string") {
		throw new SpecValidationError(
			`Encoding Object at '${location}' has non-string 'style'.`,
		);
	}

	if (encoding.style !== undefined) {
		const allowedStyles = PARAM_STYLE_BY_IN.query;
		if (!allowedStyles?.has(encoding.style as string)) {
			throw new SpecValidationError(
				`Encoding Object at '${location}' has invalid 'style' value '${encoding.style}'.`,
			);
		}
	}

	if (encoding.explode !== undefined && typeof encoding.explode !== "boolean") {
		throw new SpecValidationError(
			`Encoding Object at '${location}' has non-boolean 'explode'.`,
		);
	}

	if (
		encoding.allowReserved !== undefined &&
		typeof encoding.allowReserved !== "boolean"
	) {
		throw new SpecValidationError(
			`Encoding Object at '${location}' has non-boolean 'allowReserved'.`,
		);
	}

	if (encoding.headers !== undefined) {
		if (
			typeof encoding.headers !== "object" ||
			Array.isArray(encoding.headers)
		) {
			throw new SpecValidationError(
				`Encoding Object at '${location}' has invalid 'headers' map.`,
			);
		}

		Object.entries(encoding.headers as Record<string, OpenApiValue>).forEach(
			([headerName, headerObj]) => {
				if (headerName.toLowerCase() === "content-type") {
					throw new SpecValidationError(
						`Encoding Object at '${location}' MUST NOT define 'Content-Type' in headers. Use 'contentType' instead.`,
					);
				}
				validateHeaderObject(
					headerObj,
					`${location}.headers.${headerName}`,
					true,
				);
			},
		);
	}

	const hasEncoding = encoding.encoding !== undefined;
	const hasPrefixEncoding = encoding.prefixEncoding !== undefined;
	const hasItemEncoding = encoding.itemEncoding !== undefined;

	if (hasEncoding && (hasPrefixEncoding || hasItemEncoding)) {
		throw new SpecValidationError(
			`Encoding Object at '${location}' defines 'encoding' alongside 'prefixEncoding' or 'itemEncoding'. These fields are mutually exclusive.`,
		);
	}

	if (encoding.encoding !== undefined) {
		if (
			typeof encoding.encoding !== "object" ||
			Array.isArray(encoding.encoding)
		) {
			throw new SpecValidationError(
				`Encoding Object at '${location}' has invalid nested 'encoding' map.`,
			);
		}
		Object.entries(encoding.encoding as Record<string, OpenApiValue>).forEach(
			([key, value]) => {
				validateEncodingObject(value, `${location}.encoding.${key}`);
			},
		);
	}

	if (encoding.prefixEncoding !== undefined) {
		if (!Array.isArray(encoding.prefixEncoding)) {
			throw new SpecValidationError(
				`Encoding Object at '${location}' has invalid 'prefixEncoding'. It must be an array.`,
			);
		}
		(encoding.prefixEncoding as OpenApiValue[]).forEach((value, index) => {
			validateEncodingObject(value, `${location}.prefixEncoding[${index}]`);
		});
	}

	if (encoding.itemEncoding !== undefined) {
		validateEncodingObject(encoding.itemEncoding, `${location}.itemEncoding`);
	}
}

/**
 * Validates a Media Type Object (`schema`, `itemSchema`, `example`/`examples`, `encoding`/`prefixEncoding`/`itemEncoding`).
 *
 * @param mediaObj - Candidate Media Type Object.
 * @param location - Diagnostic location path.
 * @param mediaType - Optional MIME type key for context-sensitive encoding/itemSchema checks.
 * @throws {SpecValidationError} When the Media Type Object violates OAS 3.x constraints.
 */
export function validateMediaTypeObject(
	mediaObj: OpenApiValue,
	location: string,
	mediaType?: string,
): void {
	if (!mediaObj || typeof mediaObj !== "object") return;

	if (isRefLike(mediaObj)) {
		validateReferenceObject(mediaObj, location);
		return;
	}

	const media = mediaObj as {
		example?: OpenApiValue;
		examples?: OpenApiValue;
		encoding?: OpenApiValue;
		prefixEncoding?: string[];
		itemEncoding?: Record<string, OpenApiValue>;
		schema?: Record<string, OpenApiValue> | boolean;
		itemSchema?: Record<string, OpenApiValue> | boolean;
	};

	if (media.example !== undefined && media.examples !== undefined) {
		throw new SpecValidationError(
			`Media Type Object at '${location}' contains both 'example' and 'examples'. These fields are mutually exclusive.`,
		);
	}

	const hasEncoding = media.encoding !== undefined;
	const hasPrefixEncoding = media.prefixEncoding !== undefined;
	const hasItemEncoding = media.itemEncoding !== undefined;

	if (hasEncoding && (hasPrefixEncoding || hasItemEncoding)) {
		throw new SpecValidationError(
			`Media Type Object at '${location}' defines 'encoding' alongside 'prefixEncoding' or 'itemEncoding'. These fields are mutually exclusive.`,
		);
	}

	if (hasEncoding || hasPrefixEncoding || hasItemEncoding) {
		const isMultipart = isMultipartMediaType(mediaType);
		const isForm = isFormUrlEncodedMediaType(mediaType);

		if (hasEncoding && !isMultipart && !isForm) {
			throw new SpecValidationError(
				`Media Type Object at '${location}' uses 'encoding' but media type "${mediaType}" does not support it.`,
			);
		}

		if ((hasPrefixEncoding || hasItemEncoding) && !isMultipart) {
			throw new SpecValidationError(
				`Media Type Object at '${location}' uses positional encoding but media type "${mediaType}" is not multipart.`,
			);
		}
	}

	if (media.examples && typeof media.examples === "object") {
		Object.entries(media.examples as Record<string, OpenApiValue>).forEach(
			([name, example]) => {
				validateExampleObject(example, `${location}.examples.${name}`);
			},
		);
	}

	if (media.encoding !== undefined) {
		if (typeof media.encoding !== "object" || Array.isArray(media.encoding)) {
			throw new SpecValidationError(
				`Media Type Object at '${location}' has invalid 'encoding' map.`,
			);
		}
		Object.entries(media.encoding as Record<string, OpenApiValue>).forEach(
			([key, value]) => {
				validateEncodingObject(value, `${location}.encoding.${key}`);
			},
		);
	}

	if (media.prefixEncoding !== undefined) {
		if (!Array.isArray(media.prefixEncoding)) {
			throw new SpecValidationError(
				`Media Type Object at '${location}' has invalid 'prefixEncoding'. It must be an array.`,
			);
		}
		(media.prefixEncoding as OpenApiValue[]).forEach((value, index) => {
			validateEncodingObject(value, `${location}.prefixEncoding[${index}]`);
		});
	}

	if (media.itemEncoding !== undefined) {
		validateEncodingObject(media.itemEncoding, `${location}.itemEncoding`);
	}

	if (media.schema !== undefined) {
		validateSchemaExternalDocs(media.schema, `${location}.schema`);
	}

	if (media.itemSchema !== undefined) {
		const allowsItemSchema =
			mediaType &&
			(isSequentialMediaType(mediaType) ||
				isCustomSequentialJsonMediaType(mediaType));

		if (mediaType && !allowsItemSchema) {
			throw new SpecValidationError(
				`Media Type Object at '${location}' defines 'itemSchema' but media type "${mediaType}" is not sequential.`,
			);
		}

		validateSchemaExternalDocs(media.itemSchema, `${location}.itemSchema`);
	}
}

/**
 * Validates a `content` map of MIME types to Media Type Objects.
 *
 * @param content - Map of media types to Media Type Objects.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When any entry in `content` is invalid.
 */
export function validateContentMap(
	content: Record<string, OpenApiValue>,
	location: string,
): void {
	for (const [mediaType, mediaObj] of Object.entries(content)) {
		validateMediaTypeObject(mediaObj, `${location}.${mediaType}`, mediaType);
	}
}

/**
 * Validates an OpenAPI Link Object.
 *
 * @param linkObj - Candidate Link Object.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When `operationId`/`operationRef` or runtime expressions are invalid.
 */
export function validateLinkObject(
	linkObj: OpenApiValue,
	location: string,
): void {
	if (!linkObj || typeof linkObj !== "object") return;

	if (isRefLike(linkObj)) {
		validateReferenceObject(linkObj, location);
		return;
	}

	const link = linkObj as {
		operationId?: string;
		operationRef?: string;
		parameters?: Record<string, string>;
		requestBody?: OpenApiValue;
		server?: Record<string, OpenApiValue>;
	};

	const hasOperationId =
		typeof link.operationId === "string" && link.operationId.length > 0;
	const hasOperationRef =
		typeof link.operationRef === "string" && link.operationRef.length > 0;

	if (hasOperationId && hasOperationRef) {
		throw new SpecValidationError(
			`Link Object at '${location}' defines both 'operationId' and 'operationRef'. These fields are mutually exclusive.`,
		);
	}

	if (!hasOperationId && !hasOperationRef) {
		throw new SpecValidationError(
			`Link Object at '${location}' must define either 'operationId' or 'operationRef'.`,
		);
	}

	if (
		hasOperationRef &&
		typeof link.operationRef === "string" &&
		!isUriReference(link.operationRef)
	) {
		throw new SpecValidationError(
			`Link Object at '${location}' has invalid 'operationRef'. It must be a valid URI reference.`,
		);
	}

	if (link.parameters !== undefined) {
		if (
			typeof link.parameters !== "object" ||
			Array.isArray(link.parameters) ||
			link.parameters === null
		) {
			throw new SpecValidationError(
				`Link Object at '${location}' has invalid 'parameters'. It must be an object map.`,
			);
		}

		Object.entries(link.parameters as Record<string, OpenApiValue>).forEach(
			([name, value]) => {
				if (typeof value === "string") {
					validateRuntimeExpressionTemplate(
						value,
						`${location}.parameters.${name}`,
						"optional",
					);
				}
			},
		);
	}

	if (typeof link.requestBody === "string") {
		validateRuntimeExpressionTemplate(
			link.requestBody,
			`${location}.requestBody`,
			"optional",
		);
	}

	if (link.server !== undefined) {
		validateServers([link.server as ServerObject], `${location}.server`);
	}
}

/**
 * Validates a map of Link Objects.
 *
 * @param links - Map of link names to Link Objects.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When any link definition is invalid.
 */
export function validateLinksMap(
	links: Record<string, OpenApiValue>,
	location: string,
): void {
	for (const [linkName, linkObj] of Object.entries(links)) {
		validateLinkObject(linkObj, `${location}.${linkName}`);
	}
}

/**
 * Validates a RequestBody Object (`content` presence and Media Type entries).
 *
 * @param requestBody - Candidate RequestBody Object.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When `content` is missing or invalid.
 */
export function validateRequestBody(
	requestBody: OpenApiValue,
	location: string,
): void {
	if (!requestBody || typeof requestBody !== "object") return;

	if (isRefLike(requestBody)) {
		validateReferenceObject(requestBody, location);
		return;
	}

	const body = requestBody as { content?: Record<string, OpenApiValue> };
	if (body.content === undefined) {
		throw new SpecValidationError(
			`RequestBody Object at '${location}' must define 'content'.`,
		);
	}

	if (typeof body.content !== "object" || Array.isArray(body.content)) {
		throw new SpecValidationError(
			`RequestBody Object at '${location}' has invalid 'content'. It must be an object.`,
		);
	}

	validateContentMap(body.content, `${location}.content`);
}

/**
 * Validates a single Response Object (`description`, `headers`, `content`, `links`).
 *
 * @param responseObj - Candidate Response Object.
 * @param location - Diagnostic location path.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When the Response Object is invalid.
 */
export function validateResponseObject(
	responseObj: OpenApiValue,
	location: string,
	isOpenApi3: boolean,
): void {
	if (!responseObj || typeof responseObj !== "object") return;

	if (isRefLike(responseObj)) {
		validateReferenceObject(responseObj, location);
		return;
	}

	const response = responseObj as {
		description?: string;
		headers?: Record<string, OpenApiValue>;
		content?: Record<string, OpenApiValue>;
		links?: Record<string, OpenApiValue>;
	};

	if (response.description === undefined) {
		throw new SpecValidationError(
			`Response Object at '${location}' must define a 'description' field.`,
		);
	}

	if (typeof response.description !== "string") {
		throw new SpecValidationError(
			`Response Object at '${location}' has non-string 'description'.`,
		);
	}

	if (response.headers) {
		validateHeadersMap(response.headers, `${location}.headers`, isOpenApi3);
	}
	if (response.content) {
		validateContentMap(response.content, `${location}.content`);
	}
	if (response.links) {
		validateLinksMap(response.links, `${location}.links`);
	}
}

function isValidResponseCode(status: string): boolean {
	const normalized = String(status).toUpperCase();
	if (normalized === "DEFAULT") return true;
	if (/^[1-5]\d{2}$/.test(normalized)) return true;
	if (/^[1-5]XX$/.test(normalized)) return true;
	return false;
}

/**
 * Validates an operation's `responses` map (status code syntax and non-empty map).
 *
 * @param responses - Responses map on an operation.
 * @param location - Diagnostic location path.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When `responses` is empty or contains invalid status codes.
 */
export function validateResponses(
	responses: Record<string, OpenApiValue>,
	location: string,
	isOpenApi3: boolean,
): void {
	if (Object.keys(responses).length === 0) {
		throw new SpecValidationError(
			`Responses Object at '${location}' must define at least one response code.`,
		);
	}

	for (const [status, responseObj] of Object.entries(responses)) {
		if (!isValidResponseCode(status)) {
			throw new SpecValidationError(
				`Responses Object at '${location}' has invalid status code '${status}'.`,
			);
		}
		validateResponseObject(responseObj, `${location}.${status}`, isOpenApi3);
	}
}

/**
 * Validates `components.responses` entries.
 *
 * @param responses - Component responses map.
 * @param location - Diagnostic location path.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When any component response is invalid.
 */
export function validateComponentResponses(
	responses: Record<string, OpenApiValue>,
	location: string,
	isOpenApi3: boolean,
): void {
	for (const [name, responseObj] of Object.entries(responses)) {
		validateResponseObject(responseObj, `${location}.${name}`, isOpenApi3);
	}
}
