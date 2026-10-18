/**
 * Implements the OpenAPI 3.x and Arazzo 1.1.0 Runtime Expression evaluator.
 * Used for dynamically deriving values for Links, Callbacks, Arazzo workflow steps,
 * parameters, request bodies, criteria, and outputs.
 *
 * @see https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.2.0.md#runtime-expressions
 * @see https://spec.openapis.org/arazzo/v1.1.0#runtime-expressions
 *
 * @module core/runtime-expressions
 */
import type { ArazzoComponentsObject, OpenApiValue } from "./types/index.js";

/**
 * Request state within a `RuntimeContext`.
 */
export interface RuntimeRequestContext {
	/** Case-insensitive HTTP request headers. */
	headers: Record<string, string | string[] | undefined>;
	/** Case-sensitive query parameters. */
	query: Record<string, string | string[] | undefined>;
	/** Extracted URL path parameters. */
	path: Record<string, string | undefined>;
	/** Optional parsed request payload. */
	body?: OpenApiValue;
}

/**
 * Response state within a `RuntimeContext`.
 */
export interface RuntimeResponseContext {
	/** Case-insensitive HTTP response headers. */
	headers: Record<string, string | string[] | undefined>;
	/** Optional parsed response payload. */
	body?: OpenApiValue;
}

/**
 * Event-driven AsyncAPI message state within a `RuntimeContext` (Arazzo 1.1.0 `$message`).
 */
export interface RuntimeMessageContext {
	/** Case-insensitive message headers. */
	headers: Record<string, string | string[] | undefined>;
	/** Optional parsed message payload. */
	payload?: OpenApiValue;
}

/**
 * Recorded execution state of a single workflow step (`$steps.<stepId>`).
 */
export interface RuntimeStepRecord {
	/** Evaluated step outputs map (`$steps.<stepId>.outputs.<name>`). */
	outputs: Record<string, OpenApiValue>;
	/** Optional HTTP request context recorded for this step. */
	request?: RuntimeRequestContext | undefined;
	/** Optional HTTP response context recorded for this step. */
	response?: RuntimeResponseContext | undefined;
	/** Optional AsyncAPI message context recorded for this step. */
	message?: RuntimeMessageContext | undefined;
	/** Optional HTTP status code recorded for this step. */
	statusCode?: number | undefined;
}

/**
 * Recorded state of a workflow within an Arazzo execution session (`$workflows.<workflowId>`).
 */
export interface RuntimeWorkflowRecord {
	/** Workflow input values (`$workflows.<workflowId>.inputs.<name>`). */
	inputs?: Record<string, OpenApiValue> | undefined;
	/** Workflow output values (`$workflows.<workflowId>.outputs.<name>`). */
	outputs?: Record<string, OpenApiValue> | undefined;
}

/**
 * Source description entry within an Arazzo execution context (`$sourceDescriptions.<name>`).
 */
export interface RuntimeSourceDescriptionRecord {
	/** Resolved URL of the source description (`$sourceDescriptions.<name>.url`). */
	url: string;
	/** Optional map of sub-workflow records exposed by an external Arazzo source description (`$sourceDescriptions.<name>.workflows.<id>`). */
	workflows?: Record<string, RuntimeWorkflowRecord> | undefined;
}

/**
 * Context required to evaluate an OpenAPI or Arazzo 1.1.0 runtime expression.
 * Represents the state of the HTTP/AsyncAPI interaction and surrounding workflow execution.
 */
export interface RuntimeContext {
	/** Full request URL (`$url`). */
	url: string;
	/** HTTP request method (`$method`). */
	method: string;
	/** HTTP response status code (`$statusCode`). */
	statusCode: number;
	/** Outgoing HTTP request context (`$request`). */
	request: RuntimeRequestContext;
	/** Optional incoming HTTP response context (`$response`). */
	response?: RuntimeResponseContext | undefined;
	/** Optional AsyncAPI message context (`$message`, Arazzo 1.1.0). */
	message?: RuntimeMessageContext | undefined;
	/** Optional active workflow inputs (`$inputs`). */
	inputs?: Record<string, OpenApiValue> | undefined;
	/** Optional active workflow outputs (`$outputs`). */
	outputs?: Record<string, OpenApiValue> | undefined;
	/** Optional map of completed/active step states (`$steps`). */
	steps?: Record<string, RuntimeStepRecord> | undefined;
	/** Optional map of workflow states (`$workflows`). */
	workflows?: Record<string, RuntimeWorkflowRecord> | undefined;
	/** Optional map of source description records (`$sourceDescriptions`). */
	sourceDescriptions?:
		| Record<string, RuntimeSourceDescriptionRecord>
		| undefined;
	/** Optional reusable Arazzo components (`$components`). */
	components?: ArazzoComponentsObject | undefined;
	/** Optional canonical URI of the active document (`$self`, Arazzo 1.1.0). */
	self?: string | undefined;
}

/**
 * Alias for `RuntimeContext` emphasizing full Arazzo 1.1.0 workflow variables.
 */
export type ArazzoRuntimeContext = RuntimeContext;

/**
 * Decodes a single RFC 6901 JSON Pointer reference token.
 *
 * @param token - Encoded reference token.
 * @returns Decoded token with `~1` -> `/` and `~0` -> `~`.
 */
export function decodeJsonPointerToken(token: string): string {
	let decoded = token;
	try {
		decoded = decodeURIComponent(token);
	} catch {
		decoded = token;
	}
	return decoded.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Resolves a JSON Pointer (RFC 6901) against a target object.
 * Used internally for processing `$request.body#/foo` style expressions.
 *
 * @param data - The target object (body).
 * @param pointer - The JSON pointer string (e.g., `"/user/0/id"`).
 * @returns The resolved value or `undefined` if not found.
 */
export function evaluateJsonPointer(
	data: OpenApiValue,
	pointer: string,
): OpenApiValue {
	if (pointer === "" || pointer === "#") return data;

	const cleanPointer = pointer.startsWith("#") ? pointer.substring(1) : pointer;

	if (!cleanPointer.startsWith("/")) return undefined;

	const tokens = cleanPointer.split("/").slice(1).map(decodeJsonPointerToken);

	let current: OpenApiValue = data;

	for (const token of tokens) {
		if (current === null || typeof current !== "object") {
			return undefined;
		}

		if (Array.isArray(current)) {
			if (!/^\d+$/.test(token)) return undefined;

			const index = Number.parseInt(token, 10);

			if (index >= current.length) {
				return undefined;
			}

			current = (current as OpenApiValue[])[index];
		} else {
			if (!(token in (current as Record<string, OpenApiValue>))) {
				return undefined;
			}

			current = (current as Record<string, OpenApiValue>)[token];
		}
	}

	return current;
}

/**
 * Extracts a header value case-insensitively (RFC 7230).
 *
 * @param headers - Header map.
 * @param key - Header name to look up.
 * @returns The first matching header value or `undefined`.
 */
function getHeader(
	headers: Record<string, string | string[] | undefined>,
	key: string,
): string | undefined {
	const lowerKey = key.toLowerCase();

	const foundKey = Object.keys(headers).find(
		(k) => k.toLowerCase() === lowerKey,
	);

	if (!foundKey) return undefined;

	const val = headers[foundKey];

	return Array.isArray(val) ? val[0] : val;
}

/**
 * Extracts a query parameter case-sensitively.
 *
 * @param query - Query parameter map.
 * @param key - Query parameter name.
 * @returns The first matching query parameter value or `undefined`.
 */
function getQuery(
	query: Record<string, string | string[] | undefined>,
	key: string,
): string | undefined {
	const val = query[key];

	return Array.isArray(val) ? val[0] : val;
}

/**
 * Navigates a dot-separated path with optional `#/json/pointer` suffix against a record.
 *
 * @param root - Target object map.
 * @param pathExpr - Dot path (e.g. `"user.profile#/id"` or `"petId"`).
 * @returns Resolved value or `undefined`.
 */
function resolveDotAndPointerPath(
	root: Record<string, OpenApiValue> | undefined,
	pathExpr: string,
): OpenApiValue {
	if (!root || !pathExpr) return undefined;

	const hashIdx = pathExpr.indexOf("#");
	const dotPart = hashIdx >= 0 ? pathExpr.slice(0, hashIdx) : pathExpr;
	const pointerPart = hashIdx >= 0 ? pathExpr.slice(hashIdx + 1) : undefined;

	const segments = dotPart.split(".").filter((s) => s.length > 0);
	let current: OpenApiValue = root;

	for (const seg of segments) {
		if (current === null || typeof current !== "object") {
			return undefined;
		}
		if (Array.isArray(current)) {
			if (!/^\d+$/.test(seg)) return undefined;
			const idx = Number.parseInt(seg, 10);
			current = (current as OpenApiValue[])[idx];
		} else {
			current = (current as Record<string, OpenApiValue>)[seg];
		}
	}

	if (pointerPart !== undefined) {
		return evaluateJsonPointer(current, pointerPart);
	}

	return current;
}

/**
 * Resolves `$request.*` sub-expressions.
 *
 * @param part - Expression suffix after `"$request."`.
 * @param req - Request context.
 * @returns Resolved request value or `undefined`.
 */
function resolveRequestPart(
	part: string,
	req: RuntimeRequestContext,
): OpenApiValue {
	if (part.startsWith("header.")) {
		return getHeader(req.headers, part.substring(7));
	}
	if (part.startsWith("query.")) {
		return getQuery(req.query, part.substring(6));
	}
	if (part.startsWith("path.")) {
		return req.path[part.substring(5)];
	}
	if (part === "body") return req.body;
	if (part.startsWith("body#")) {
		return evaluateJsonPointer(req.body, part.substring(5));
	}
	if (part.startsWith("body.")) {
		return resolveDotAndPointerPath(
			req.body && typeof req.body === "object"
				? (req.body as Record<string, OpenApiValue>)
				: undefined,
			part.substring(5),
		);
	}
	return undefined;
}

/**
 * Resolves `$response.*` sub-expressions.
 *
 * @param part - Expression suffix after `"$response."`.
 * @param res - Optional response context.
 * @returns Resolved response value or `undefined`.
 */
function resolveResponsePart(
	part: string,
	res: RuntimeResponseContext | undefined,
): OpenApiValue {
	if (!res) return undefined;
	if (part.startsWith("header.")) {
		return getHeader(res.headers, part.substring(7));
	}
	if (part === "body") return res.body;
	if (part.startsWith("body#")) {
		return evaluateJsonPointer(res.body, part.substring(5));
	}
	if (part.startsWith("body.")) {
		return resolveDotAndPointerPath(
			res.body && typeof res.body === "object"
				? (res.body as Record<string, OpenApiValue>)
				: undefined,
			part.substring(5),
		);
	}
	return undefined;
}

/**
 * Resolves `$message.*` sub-expressions (Arazzo 1.1.0 AsyncAPI).
 *
 * @param part - Expression suffix after `"$message."`.
 * @param msg - Optional message context.
 * @returns Resolved message value or `undefined`.
 */
function resolveMessagePart(
	part: string,
	msg: RuntimeMessageContext | undefined,
): OpenApiValue {
	if (!msg) return undefined;
	if (part.startsWith("header.")) {
		return getHeader(msg.headers, part.substring(7));
	}
	if (part.startsWith("header#")) {
		return evaluateJsonPointer(msg.headers, part.substring(7));
	}
	if (part === "payload") return msg.payload;
	if (part.startsWith("payload#")) {
		return evaluateJsonPointer(msg.payload, part.substring(8));
	}
	if (part.startsWith("payload.")) {
		return resolveDotAndPointerPath(
			msg.payload && typeof msg.payload === "object"
				? (msg.payload as Record<string, OpenApiValue>)
				: undefined,
			part.substring(8),
		);
	}
	return undefined;
}

/**
 * Resolves a single, bare runtime expression (e.g. `"$request.body#/id"`, `"$steps.login.outputs.token"`).
 * Preserves the type of the referenced value (e.g. boolean, number, object).
 *
 * @param expr - Bare runtime expression string.
 * @param context - HTTP/workflow interaction context.
 * @returns Resolved OpenAPI value or `undefined`.
 */
export function resolveSingleExpression(
	expr: string,
	context: RuntimeContext,
): OpenApiValue {
	if (expr === "$url") return context.url;
	if (expr === "$method") return context.method;
	if (expr === "$statusCode") return context.statusCode;
	if (expr === "$self") return context.self;

	if (expr === "$request") return context.request as OpenApiValue;
	if (expr.startsWith("$request.")) {
		return resolveRequestPart(expr.substring(9), context.request);
	}

	if (expr === "$response") return context.response as OpenApiValue;
	if (expr.startsWith("$response.")) {
		return resolveResponsePart(expr.substring(10), context.response);
	}

	if (expr === "$message") return context.message as OpenApiValue;
	if (expr.startsWith("$message.")) {
		return resolveMessagePart(expr.substring(9), context.message);
	}

	if (expr === "$inputs") return context.inputs;
	if (expr.startsWith("$inputs.")) {
		return resolveDotAndPointerPath(context.inputs, expr.substring(8));
	}

	if (expr === "$outputs") return context.outputs;
	if (expr.startsWith("$outputs.")) {
		return resolveDotAndPointerPath(context.outputs, expr.substring(9));
	}

	if (expr.startsWith("$steps.")) {
		const rest = expr.substring(7);
		const firstDot = rest.indexOf(".");
		if (firstDot < 0) {
			return context.steps?.[rest] as OpenApiValue;
		}
		const stepId = rest.slice(0, firstDot);
		const stepRecord = context.steps?.[stepId];
		if (!stepRecord) return undefined;
		const sub = rest.slice(firstDot + 1);
		if (sub === "outputs") return stepRecord.outputs;
		if (sub.startsWith("outputs.")) {
			return resolveDotAndPointerPath(stepRecord.outputs, sub.substring(8));
		}
		if (sub === "statusCode") return stepRecord.statusCode;
		if (sub.startsWith("request.") && stepRecord.request) {
			return resolveRequestPart(sub.substring(8), stepRecord.request);
		}
		if (sub.startsWith("response.") && stepRecord.response) {
			return resolveResponsePart(sub.substring(9), stepRecord.response);
		}
		if (sub.startsWith("message.") && stepRecord.message) {
			return resolveMessagePart(sub.substring(8), stepRecord.message);
		}
		return resolveDotAndPointerPath(stepRecord.outputs, sub);
	}

	if (expr.startsWith("$workflows.")) {
		const rest = expr.substring(11);
		const firstDot = rest.indexOf(".");
		if (firstDot < 0) {
			return context.workflows?.[rest] as OpenApiValue;
		}
		const wfId = rest.slice(0, firstDot);
		const wfRecord = context.workflows?.[wfId];
		if (!wfRecord) return undefined;
		const sub = rest.slice(firstDot + 1);
		if (sub === "inputs") return wfRecord.inputs;
		if (sub.startsWith("inputs.")) {
			return resolveDotAndPointerPath(wfRecord.inputs, sub.substring(7));
		}
		if (sub === "outputs") return wfRecord.outputs;
		if (sub.startsWith("outputs.")) {
			return resolveDotAndPointerPath(wfRecord.outputs, sub.substring(8));
		}
		return undefined;
	}

	if (expr.startsWith("$sourceDescriptions.")) {
		const rest = expr.substring(20);
		const firstDot = rest.indexOf(".");
		if (firstDot < 0) {
			return context.sourceDescriptions?.[rest] as OpenApiValue;
		}
		const srcName = rest.slice(0, firstDot);
		const srcRecord = context.sourceDescriptions?.[srcName];
		if (!srcRecord) return undefined;
		const sub = rest.slice(firstDot + 1);
		if (sub === "url") return srcRecord.url;
		if (sub.startsWith("workflows.")) {
			const wfRest = sub.substring(10);
			const wfDot = wfRest.indexOf(".");
			if (wfDot < 0) {
				return srcRecord.workflows?.[wfRest] !== undefined
					? (srcRecord.workflows[wfRest] as OpenApiValue)
					: `$sourceDescriptions.${srcName}.workflows.${wfRest}`;
			}
			const wfId = wfRest.slice(0, wfDot);
			const wfRec = srcRecord.workflows?.[wfId];
			if (!wfRec) return undefined;
			const wfSub = wfRest.slice(wfDot + 1);
			if (wfSub.startsWith("inputs.")) {
				return resolveDotAndPointerPath(wfRec.inputs, wfSub.substring(7));
			}
			if (wfSub.startsWith("outputs.")) {
				return resolveDotAndPointerPath(wfRec.outputs, wfSub.substring(8));
			}
		}
		return undefined;
	}

	if (expr.startsWith("$components.")) {
		const rest = expr.substring(12);
		return resolveDotAndPointerPath(
			context.components as Record<string, OpenApiValue> | undefined,
			rest,
		);
	}

	return undefined;
}

/**
 * Evaluates a runtime expression against a given connection/workflow context.
 *
 * Supports:
 * 1. Direct expressions: `"$request.query.id"` or `"$steps.auth.outputs.token"` -> returns the value (preserving type).
 * 2. Embedded string expressions: `"https://example.com/{$request.path.id}"` -> returns interpolated string.
 *
 * @param expression - The expression string defined in the OpenAPI Link, Callback, or Arazzo Workflow.
 * @param context - The runtime data (request info, response info, workflow state).
 * @returns The evaluated result.
 */
export function evaluateRuntimeExpression(
	expression: string,
	context: RuntimeContext,
): OpenApiValue {
	const hasBraces = expression.includes("{") && expression.includes("}");

	if (expression.startsWith("$") && !hasBraces) {
		return resolveSingleExpression(expression, context);
	}

	if (!expression.includes("{")) {
		return expression;
	}

	return expression.replace(/\{([^}]+)\}/g, (_, innerExpr: string) => {
		const trimmed = innerExpr.trim();
		const val = resolveSingleExpression(trimmed, context);
		return val !== undefined ? String(val) : "";
	});
}

/**
 * Recursively evaluates runtime expressions within an arbitrary payload value (strings, arrays, objects).
 *
 * @param value - Payload value (primitive, array, or object) potentially containing runtime expressions.
 * @param context - Active `RuntimeContext`.
 * @returns Deeply evaluated payload copy.
 */
export function evaluatePayloadExpressions(
	value: OpenApiValue,
	context: RuntimeContext,
): OpenApiValue {
	if (typeof value === "string") {
		return evaluateRuntimeExpression(value, context);
	}
	if (Array.isArray(value)) {
		return (value as OpenApiValue[]).map((item: OpenApiValue) =>
			evaluatePayloadExpressions(item, context),
		);
	}
	if (value !== null && typeof value === "object") {
		const result: Record<string, OpenApiValue> = {};
		for (const [k, v] of Object.entries(
			value as Record<string, OpenApiValue>,
		)) {
			result[k] = evaluatePayloadExpressions(v, context);
		}
		return result;
	}
	return value;
}
