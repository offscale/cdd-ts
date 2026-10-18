/**
 * Implements the Arazzo 1.1.0 query selector, criterion evaluation, payload replacement,
 * and workflow/step topological DAG sorting engine.
 *
 * @module core/arazzo-engine
 */
import {
	type ArazzoRuntimeContext,
	decodeJsonPointerToken,
	evaluateJsonPointer,
	evaluatePayloadExpressions,
	evaluateRuntimeExpression,
} from "./runtime-expressions.js";
import {
	type ArazzoCriterionObject,
	type ArazzoExpressionDialect,
	type ArazzoExpressionTypeObject,
	type ArazzoPayloadReplacementObject,
	type ArazzoSelectorObject,
	type ArazzoStepObject,
	type ArazzoWorkflowObject,
	isArazzoExpressionTypeObject,
	isArazzoSelectorObject,
	type OpenApiValue,
} from "./types/index.js";

/**
 * Lightweight XML element node used by the built-in XPath evaluator and replacer.
 */
export interface SimpleXmlNode {
	/** Element tag name. */
	tag: string;
	/** Element attribute map. */
	attributes: Record<string, string>;
	/** Child element nodes. */
	children: SimpleXmlNode[];
	/** Direct text content inside this element. */
	text: string;
}

/**
 * Parses a well-formed XML fragment into a lightweight `SimpleXmlNode` tree.
 *
 * @param xml - Raw XML string.
 * @returns Root `SimpleXmlNode` or `undefined` if no element tags exist.
 */
export function parseSimpleXml(xml: string): SimpleXmlNode | undefined {
	const stack: SimpleXmlNode[] = [];
	let root: SimpleXmlNode | undefined;
	const tokenRegex =
		/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([A-Za-z0-9_:-]+)\s*>|<([A-Za-z0-9_:-]+)([^>]*?)(\/?)>|([^<]+)/g;

	for (const match of xml.matchAll(tokenRegex)) {
		const cdataText = match[1];
		const closingTag = match[2];
		const openingTag = match[3];
		const rawAttrs = match[4];
		const selfClosing = match[5];
		const plainText = match[6];

		if (cdataText !== undefined) {
			const top = stack[stack.length - 1];
			if (top) top.text += cdataText;
			continue;
		}

		if (plainText !== undefined) {
			const trimmed = plainText.trim();
			const top = stack[stack.length - 1];
			if (top && trimmed.length > 0) {
				top.text += trimmed;
			}
			continue;
		}

		if (closingTag !== undefined) {
			stack.pop();
			continue;
		}

		if (openingTag !== undefined) {
			const attributes: Record<string, string> = {};
			if (rawAttrs) {
				const attrRegex = /([A-Za-z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
				for (const attrMatch of rawAttrs.matchAll(attrRegex)) {
					const attrName = attrMatch[1] as string;
					const attrVal = (attrMatch[2] ?? attrMatch[3]) as string;
					attributes[attrName] = attrVal;
				}
			}

			const node: SimpleXmlNode = {
				tag: openingTag,
				attributes,
				children: [],
				text: "",
			};

			const parent = stack[stack.length - 1];
			if (parent) {
				parent.children.push(node);
			} else {
				root ??= node;
			}

			if (selfClosing !== "/") {
				stack.push(node);
			}
		}
	}

	return root;
}

/**
 * Serializes a `SimpleXmlNode` tree back into an XML string.
 *
 * @param node - Root XML node.
 * @returns Serialized XML string.
 */
export function serializeSimpleXml(node: SimpleXmlNode): string {
	const attrs = Object.entries(node.attributes)
		.map(([k, v]) => ` ${k}="${v}"`)
		.join("");
	if (node.children.length === 0 && node.text.length === 0) {
		return `<${node.tag}${attrs}/>`;
	}
	const childrenXml = node.children.map(serializeSimpleXml).join("");
	return `<${node.tag}${attrs}>${node.text}${childrenXml}</${node.tag}>`;
}

/**
 * Checks whether an XML element tag matches a requested local or prefixed name.
 *
 * @param tag - Actual tag name on the XML element.
 * @param target - Target tag name from XPath.
 * @returns `true` if matching.
 */
function xmlTagMatches(tag: string, target: string): boolean {
	if (target === "*") return true;
	const localTag = tag.split(":").pop() as string;
	const localTarget = target.split(":").pop() as string;
	return tag === target || localTag === localTarget;
}

/**
 * Collects all descendant XML nodes (including the node itself) in document order.
 *
 * @param node - Starting XML node.
 * @returns Flat array of descendant nodes.
 */
function collectXmlDescendants(node: SimpleXmlNode): SimpleXmlNode[] {
	const out: SimpleXmlNode[] = [node];
	for (const child of node.children) {
		out.push(...collectXmlDescendants(child));
	}
	return out;
}

/**
 * Evaluates an XPath 1.0 / 2.0 / 3.1 expression against an XML string or object.
 *
 * @param data - XML string or object representation.
 * @param xpath - XPath expression (e.g. `"/pet/id"`, `"//item[@active='true']/name"`, `"count(//item)"`).
 * @returns Matched value(s) or `undefined`.
 */
export function evaluateXPath(data: OpenApiValue, xpath: string): OpenApiValue {
	const trimmed = xpath.trim();
	if (!trimmed) return undefined;

	if (trimmed.startsWith("count(") && trimmed.endsWith(")")) {
		const inner = trimmed.slice(6, -1).trim();
		const res = evaluateXPath(data, inner);
		if (res === undefined) return 0;
		return Array.isArray(res) ? res.length : 1;
	}

	if (typeof data !== "string") {
		if (data !== null && typeof data === "object") {
			const pointerCandidate = trimmed
				.replace(/^\/\//, "/")
				.replace(/\/text\(\)$/, "");
			return evaluateJsonPointer(data, pointerCandidate);
		}
		return undefined;
	}

	const root = parseSimpleXml(data);
	if (!root) return undefined;

	const isDescendantStart = trimmed.startsWith("//");
	const cleanPath = isDescendantStart
		? trimmed.slice(2)
		: trimmed.startsWith("/")
			? trimmed.slice(1)
			: trimmed;

	const rawSegments = cleanPath.split("/").filter((s) => s.length > 0);
	let currentNodes: SimpleXmlNode[] = isDescendantStart
		? collectXmlDescendants(root)
		: [root];

	for (let i = 0; i < rawSegments.length; i++) {
		const seg = rawSegments[i] as string;
		if (seg === "text()") {
			const texts = currentNodes.map((n) => n.text);
			return texts.length === 1 ? texts[0] : texts;
		}
		if (seg.startsWith("@")) {
			const attrName = seg.slice(1);
			const vals = currentNodes
				.map((n) => n.attributes[attrName])
				.filter((v): v is string => v !== undefined);
			if (vals.length === 0) return undefined;
			return vals.length === 1 ? vals[0] : vals;
		}

		const bracketIdx = seg.indexOf("[");
		const tagName = bracketIdx >= 0 ? seg.slice(0, bracketIdx) : seg;
		const predicate =
			bracketIdx >= 0 && seg.endsWith("]")
				? seg.slice(bracketIdx + 1, -1).trim()
				: undefined;

		let candidates: SimpleXmlNode[] = [];
		if (i === 0 && !isDescendantStart) {
			candidates = xmlTagMatches(root.tag, tagName) ? [root] : [];
		} else {
			for (const node of currentNodes) {
				for (const child of node.children) {
					if (xmlTagMatches(child.tag, tagName)) {
						candidates.push(child);
					}
				}
			}
		}

		if (predicate) {
			if (/^\d+$/.test(predicate)) {
				const idx = Number.parseInt(predicate, 10) - 1;
				const picked = candidates[idx];
				candidates = picked ? [picked] : [];
			} else if (predicate.startsWith("@")) {
				const eqIdx = predicate.indexOf("=");
				if (eqIdx < 0) {
					const attrKey = predicate.slice(1).trim();
					candidates = candidates.filter((c) => attrKey in c.attributes);
				} else {
					const attrKey = predicate.slice(1, eqIdx).trim();
					const expected = predicate
						.slice(eqIdx + 1)
						.trim()
						.replace(/^['"]|['"]$/g, "");
					candidates = candidates.filter(
						(c) => c.attributes[attrKey] === expected,
					);
				}
			}
		}

		currentNodes = candidates;
		if (currentNodes.length === 0) return undefined;
	}

	const extracted = currentNodes.map((n) =>
		n.children.length === 0 ? n.text : serializeSimpleXml(n),
	);
	return extracted.length === 1 ? extracted[0] : extracted;
}

/**
 * Evaluates a JSONPath filter expression (e.g. `@.price < 10`, `@.active == true`, `@.tag`) against a candidate item.
 *
 * @param item - Candidate array element or object value.
 * @param filterExpr - Filter expression inside `[?(...)]`.
 * @returns `true` if the candidate satisfies the filter.
 */
function evaluateJsonPathFilter(
	item: OpenApiValue,
	filterExpr: string,
): boolean {
	if (item === null || typeof item !== "object" || Array.isArray(item)) {
		return false;
	}
	const record = item as Record<string, OpenApiValue>;
	const opMatch = /^@\.([A-Za-z0-9_.-]+)\s*(==|!=|<=|>=|<|>)\s*(.+)$/.exec(
		filterExpr.trim(),
	);
	if (!opMatch) {
		if (filterExpr.trim().startsWith("@.")) {
			const prop = filterExpr.trim().slice(2);
			return Boolean(record[prop]);
		}
		return false;
	}

	const propPath = opMatch[1] as string;
	const operator = opMatch[2] as string;
	const rawRhs = (opMatch[3] as string).trim();

	let lhs: OpenApiValue = record;
	for (const part of propPath.split(".")) {
		if (lhs !== null && typeof lhs === "object" && !Array.isArray(lhs)) {
			lhs = (lhs as Record<string, OpenApiValue>)[part];
		} else {
			lhs = undefined;
		}
	}

	const rhs = parseLiteralValue(rawRhs);
	return compareValues(lhs, operator, rhs);
}

/**
 * Recursively collects all values matching a property name (`$..prop`).
 *
 * @param node - Target JSON value.
 * @param key - Property name to search for (`"*"` for all values).
 * @returns Array of matched values.
 */
function collectRecursiveDescent(
	node: OpenApiValue,
	key: string,
): OpenApiValue[] {
	const results: OpenApiValue[] = [];
	if (node === null || typeof node !== "object") {
		return results;
	}
	if (Array.isArray(node)) {
		for (const item of node as OpenApiValue[]) {
			results.push(...collectRecursiveDescent(item, key));
		}
		return results;
	}
	const obj = node as Record<string, OpenApiValue>;
	for (const [k, v] of Object.entries(obj)) {
		if (key === "*" || k === key) {
			results.push(v);
		}
		results.push(...collectRecursiveDescent(v, key));
	}
	return results;
}

/**
 * Evaluates a JSONPath expression (RFC 9535 & `draft-goessner-dispatch-jsonpath-00`) against a JSON value.
 *
 * @param data - Target JSON object or array.
 * @param jsonPath - JSONPath expression starting with `$` or `@`.
 * @returns Resolved single value, array of matched values, or `undefined`.
 */
export function evaluateJsonPath(
	data: OpenApiValue,
	jsonPath: string,
): OpenApiValue {
	const trimmed = jsonPath.trim();
	if (trimmed === "$" || trimmed === "@") return data;

	if (trimmed.startsWith("/")) {
		return evaluateJsonPointer(data, trimmed);
	}

	const clean =
		trimmed.startsWith("$") || trimmed.startsWith("@")
			? trimmed.slice(1)
			: trimmed;

	if (clean.startsWith("..")) {
		const restKey = clean.slice(2).trim();
		const matches = collectRecursiveDescent(data, restKey);
		if (matches.length === 0) return undefined;
		return matches.length === 1 ? matches[0] : matches;
	}

	const tokens: string[] = [];
	const tokenRegex = /\.([A-Za-z0-9_*-]+)|\[([^\]]+)\]/g;
	const normalized =
		clean.startsWith(".") || clean.startsWith("[") ? clean : `.${clean}`;

	for (const match of normalized.matchAll(tokenRegex)) {
		const token = (match[1] ?? match[2]) as string;
		tokens.push(token);
	}

	let currentList: OpenApiValue[] = [data];
	let isMultiMatch = false;

	for (const rawToken of tokens) {
		const token = rawToken.trim().replace(/^['"]|['"]$/g, "");
		const nextList: OpenApiValue[] = [];

		for (const curr of currentList) {
			if (curr === null || typeof curr !== "object") continue;

			if (token === "*") {
				isMultiMatch = true;
				if (Array.isArray(curr)) {
					nextList.push(...curr);
				} else {
					nextList.push(...Object.values(curr as Record<string, OpenApiValue>));
				}
			} else if (token.startsWith("?(") && token.endsWith(")")) {
				isMultiMatch = true;
				const filterInner = token.slice(2, -1);
				if (Array.isArray(curr)) {
					for (const item of curr as OpenApiValue[]) {
						if (evaluateJsonPathFilter(item, filterInner)) {
							nextList.push(item);
						}
					}
				}
			} else if (Array.isArray(curr)) {
				if (/^-?\d+$/.test(token)) {
					const idx = Number.parseInt(token, 10);
					const resolvedIdx = idx < 0 ? curr.length + idx : idx;
					if (resolvedIdx >= 0 && resolvedIdx < curr.length) {
						nextList.push(curr[resolvedIdx]);
					}
				}
			} else if (token in (curr as Record<string, OpenApiValue>)) {
				nextList.push((curr as Record<string, OpenApiValue>)[token]);
			}
		}

		currentList = nextList;
		if (currentList.length === 0) return undefined;
	}

	return isMultiMatch ? currentList : currentList[0];
}

/**
 * Evaluates a selector expression against a target value using the specified dialect (`jsonpointer`, `jsonpath`, or `xpath`).
 *
 * @param data - Target JSON or XML data.
 * @param selector - Selector expression string.
 * @param dialect - Optional dialect string or `ArazzoExpressionTypeObject`.
 * @returns Extracted value or `undefined`.
 */
export function evaluateSelector(
	data: OpenApiValue,
	selector: string,
	dialect?: ArazzoExpressionDialect | ArazzoExpressionTypeObject,
): OpenApiValue {
	const resolvedType: ArazzoExpressionDialect = isArazzoExpressionTypeObject(
		dialect,
	)
		? dialect.type
		: dialect
			? dialect
			: selector.startsWith("$")
				? "jsonpath"
				: selector.startsWith("//") || typeof data === "string"
					? "xpath"
					: "jsonpointer";

	if (resolvedType === "jsonpointer") {
		return evaluateJsonPointer(data, selector);
	}
	if (resolvedType === "xpath") {
		return evaluateXPath(data, selector);
	}
	return evaluateJsonPath(data, selector);
}

/**
 * Evaluates an Arazzo 1.1.0 structured `ArazzoSelectorObject` against a `RuntimeContext`.
 *
 * @param selectorObj - Structured selector object (`{ context, selector, type }`).
 * @param context - Active workflow runtime context.
 * @returns Resolved value or `undefined`.
 */
export function evaluateArazzoSelectorObject(
	selectorObj: ArazzoSelectorObject,
	context: ArazzoRuntimeContext,
): OpenApiValue {
	const baseData = evaluateRuntimeExpression(selectorObj.context, context);
	return evaluateSelector(baseData, selectorObj.selector, selectorObj.type);
}

/**
 * Evaluates either a runtime expression string, a literal value, or an `ArazzoSelectorObject`.
 *
 * @param valueOrSelector - Value, runtime expression string, or `ArazzoSelectorObject`.
 * @param context - Active workflow runtime context.
 * @returns Resolved value.
 */
export function evaluateValueOrSelector(
	valueOrSelector: OpenApiValue | ArazzoSelectorObject,
	context: ArazzoRuntimeContext,
): OpenApiValue {
	if (isArazzoSelectorObject(valueOrSelector)) {
		return evaluateArazzoSelectorObject(valueOrSelector, context);
	}
	return evaluatePayloadExpressions(valueOrSelector, context);
}

/**
 * Parses a literal operand token from a simple criterion condition (`'str'`, `"str"`, `true`, `false`, `null`, number).
 *
 * @param token - Raw operand token.
 * @returns Parsed primitive value.
 */
function parseLiteralValue(token: string): OpenApiValue {
	const trimmed = token.trim();
	if (
		(trimmed.startsWith("'") && trimmed.endsWith("'")) ||
		(trimmed.startsWith('"') && trimmed.endsWith('"'))
	) {
		return trimmed.slice(1, -1);
	}
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (trimmed === "null") return null;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}
	return trimmed;
}

/**
 * Resolves a single operand inside a `simple` criterion condition against the context and optional target data.
 *
 * @param token - Raw operand string.
 * @param context - Workflow runtime context.
 * @param contextValue - Resolved `criterion.context` value, if any.
 * @returns Resolved operand value.
 */
function resolveSimpleOperand(
	token: string,
	context: ArazzoRuntimeContext,
	contextValue: OpenApiValue,
): OpenApiValue {
	const trimmed = token.trim();
	if (trimmed === "$") {
		return contextValue;
	}
	if (trimmed.startsWith("$.") || trimmed.startsWith("$[")) {
		return evaluateJsonPath(contextValue, trimmed);
	}
	if (trimmed.startsWith("$")) {
		return evaluateRuntimeExpression(trimmed, context);
	}
	if (trimmed.startsWith("/")) {
		return evaluateJsonPointer(contextValue, trimmed);
	}
	return parseLiteralValue(trimmed);
}

/**
 * Compares two values using a relational or equality operator.
 *
 * @param lhs - Left-hand side value.
 * @param operator - Comparison operator (`==`, `!=`, `<`, `<=`, `>`, `>=`).
 * @param rhs - Right-hand side value.
 * @returns Boolean comparison result.
 */
function compareValues(
	lhs: OpenApiValue,
	operator: string,
	rhs: OpenApiValue,
): boolean {
	switch (operator) {
		case "==":
			return lhs === rhs || String(lhs) === String(rhs);
		case "!=":
			return lhs !== rhs && String(lhs) !== String(rhs);
		case "<":
			return Number(lhs) < Number(rhs);
		case "<=":
			return Number(lhs) <= Number(rhs);
		case ">":
			return Number(lhs) > Number(rhs);
		default:
			return Number(lhs) >= Number(rhs);
	}
}

/**
 * Evaluates a `simple` criterion condition expression supporting `&&`, `||`, `!`, parentheses, and comparisons.
 *
 * @param condition - Simple condition expression string.
 * @param context - Active workflow runtime context.
 * @param contextValue - Evaluated `criterion.context` value.
 * @returns `true` if condition holds.
 */
export function evaluateSimpleCondition(
	condition: string,
	context: ArazzoRuntimeContext,
	contextValue: OpenApiValue,
): boolean {
	let expr = condition.trim();
	while (expr.startsWith("(") && expr.endsWith(")")) {
		let depth = 0;
		let wrapsAll = true;
		for (let i = 0; i < expr.length - 1; i++) {
			if (expr[i] === "(") depth++;
			else if (expr[i] === ")") depth--;
			if (depth === 0) {
				wrapsAll = false;
				break;
			}
		}
		if (wrapsAll) {
			expr = expr.slice(1, -1).trim();
		} else {
			break;
		}
	}

	const splitByLogical = (
		input: string,
		op: "||" | "&&",
	): string[] | undefined => {
		const parts: string[] = [];
		let depth = 0;
		let inSingle = false;
		let inDouble = false;
		let lastIdx = 0;

		for (let i = 0; i < input.length; i++) {
			const ch = input[i];
			if (ch === "'" && !inDouble) inSingle = !inSingle;
			else if (ch === '"' && !inSingle) inDouble = !inDouble;
			else if (!inSingle && !inDouble) {
				if (ch === "(") depth++;
				else if (ch === ")") depth--;
				else if (depth === 0 && input.slice(i, i + 2) === op) {
					parts.push(input.slice(lastIdx, i));
					lastIdx = i + 2;
					i++;
				}
			}
		}
		if (parts.length > 0) {
			parts.push(input.slice(lastIdx));
			return parts;
		}
		return undefined;
	};

	const orParts = splitByLogical(expr, "||");
	if (orParts) {
		return orParts.some((p) =>
			evaluateSimpleCondition(p, context, contextValue),
		);
	}

	const andParts = splitByLogical(expr, "&&");
	if (andParts) {
		return andParts.every((p) =>
			evaluateSimpleCondition(p, context, contextValue),
		);
	}

	if (expr.startsWith("!")) {
		return !evaluateSimpleCondition(expr.slice(1), context, contextValue);
	}

	const cmpMatch = /^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/.exec(expr);
	if (cmpMatch) {
		const lhs = resolveSimpleOperand(
			cmpMatch[1] as string,
			context,
			contextValue,
		);
		const op = cmpMatch[2] as string;
		const rhs = resolveSimpleOperand(
			cmpMatch[3] as string,
			context,
			contextValue,
		);
		return compareValues(lhs, op, rhs);
	}

	const singleVal = resolveSimpleOperand(expr, context, contextValue);
	return Boolean(singleVal);
}

/**
 * Evaluates a single `ArazzoCriterionObject` against a `RuntimeContext`.
 *
 * @param criterion - Criterion definition (`context`, `condition`, `type`).
 * @param context - Active workflow runtime context.
 * @returns `true` if the criterion assertion passes.
 */
export function evaluateCriterion(
	criterion: ArazzoCriterionObject,
	context: ArazzoRuntimeContext,
): boolean {
	const contextValue: OpenApiValue = criterion.context
		? evaluateRuntimeExpression(criterion.context, context)
		: context.response?.body;

	const rawType = criterion.type ?? "simple";
	const dialect = isArazzoExpressionTypeObject(rawType)
		? rawType.type
		: rawType;

	if (dialect === "regex") {
		const targetStr =
			contextValue === undefined || contextValue === null
				? ""
				: typeof contextValue === "string"
					? contextValue
					: JSON.stringify(contextValue);
		const regex = new RegExp(criterion.condition);
		return regex.test(targetStr);
	}

	if (dialect === "jsonpath" || dialect === "jsonpointer") {
		const selected = evaluateSelector(
			contextValue,
			criterion.condition,
			dialect,
		);
		if (Array.isArray(selected)) {
			return selected.length > 0;
		}
		return selected !== undefined && selected !== null && selected !== false;
	}

	if (dialect === "xpath") {
		const selected = evaluateXPath(contextValue, criterion.condition);
		if (Array.isArray(selected)) {
			return selected.length > 0;
		}
		if (typeof selected === "number") {
			return selected > 0;
		}
		return Boolean(selected);
	}

	return evaluateSimpleCondition(criterion.condition, context, contextValue);
}

/**
 * Evaluates an array of `ArazzoCriterionObject`s (all must pass).
 *
 * @param criteria - List of criteria to evaluate.
 * @param context - Active workflow runtime context.
 * @returns `true` if every criterion evaluates to `true`.
 */
export function evaluateCriteriaList(
	criteria: ArazzoCriterionObject[] | undefined,
	context: ArazzoRuntimeContext,
): boolean {
	if (!criteria || criteria.length === 0) return true;
	return criteria.every((c) => evaluateCriterion(c, context));
}

/**
 * Sets a value at an RFC 6901 JSON Pointer location inside a cloned object/array.
 *
 * @param targetObj - Mutable clone of payload object or array.
 * @param pointer - RFC 6901 JSON Pointer (e.g. `"/user/name"`, `"/items/0/id"`).
 * @param newValue - Value to assign.
 * @returns Updated payload.
 */
function setByJsonPointer(
	targetObj: OpenApiValue,
	pointer: string,
	newValue: OpenApiValue,
): OpenApiValue {
	const clean = pointer.startsWith("#") ? pointer.slice(1) : pointer;
	if (clean === "" || clean === "/") return newValue;
	if (!clean.startsWith("/")) return targetObj;

	const tokens = clean.split("/").slice(1).map(decodeJsonPointerToken);
	if (targetObj === null || typeof targetObj !== "object") {
		return targetObj;
	}

	let curr: OpenApiValue = targetObj;
	for (let i = 0; i < tokens.length - 1; i++) {
		const tok = tokens[i] as string;
		if (Array.isArray(curr)) {
			const idx = Number.parseInt(tok, 10);
			curr = curr[idx];
		} else {
			const rec = curr as Record<string, OpenApiValue>;
			if (
				rec[tok] === undefined ||
				rec[tok] === null ||
				typeof rec[tok] !== "object"
			) {
				rec[tok] = {};
			}
			curr = rec[tok];
		}
	}

	const lastTok = tokens[tokens.length - 1] as string;
	if (Array.isArray(curr)) {
		const idx = Number.parseInt(lastTok, 10);
		if (!Number.isNaN(idx) && idx >= 0) {
			curr[idx] = newValue;
		}
	} else {
		(curr as Record<string, OpenApiValue>)[lastTok] = newValue;
	}

	return targetObj;
}

/**
 * Converts a simple JSONPath (`$.a.b[0].c`) into an RFC 6901 JSON Pointer (`/a/b/0/c`).
 *
 * @param jsonPath - JSONPath target string.
 * @returns Equivalent JSON Pointer string.
 */
function jsonPathToPointer(jsonPath: string): string {
	const clean = jsonPath.trim().replace(/^\$/, "");
	const segments: string[] = [];
	const regex = /\.([A-Za-z0-9_-]+)|\[(\d+|'[^']+'|"[^"]+")\]/g;
	const norm =
		clean.startsWith(".") || clean.startsWith("[") ? clean : `.${clean}`;
	for (const match of norm.matchAll(regex)) {
		const seg = ((match[1] ?? match[2]) as string).replace(/^['"]|['"]$/g, "");
		segments.push(seg.replace(/~/g, "~0").replace(/\//g, "~1"));
	}
	return `/${segments.join("/")}`;
}

/**
 * Sets a value inside an XML string using a simple XPath target expression.
 *
 * @param xml - Input XML string.
 * @param xpath - Target XPath expression (e.g. `"/pet/name"` or `"/pet/@id"`).
 * @param value - Replacement value.
 * @returns Updated XML string.
 */
function setByXPath(xml: string, xpath: string, value: OpenApiValue): string {
	const root = parseSimpleXml(xml);
	if (!root) return xml;

	const clean = xpath.trim().replace(/^\/+/, "");
	const segments = clean.split("/").filter((s) => s.length > 0);
	if (segments.length === 0) return xml;

	let curr: SimpleXmlNode | undefined = root;
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i] as string;
		if (!curr) break;
		if (seg.startsWith("@")) {
			curr.attributes[seg.slice(1)] = String(value ?? "");
			return serializeSimpleXml(root);
		}
		if (i === 0 && xmlTagMatches(curr.tag, seg)) {
			continue;
		}
		curr = curr.children.find((c) => xmlTagMatches(c.tag, seg));
	}

	if (curr) {
		curr.text = String(value ?? "");
	}

	return serializeSimpleXml(root);
}

/**
 * Applies Arazzo 1.1.0 `PayloadReplacementObject`s to a base request body payload without mutating the original template.
 *
 * @param payload - Base request body payload.
 * @param replacements - List of payload replacements to apply.
 * @param context - Active workflow runtime context.
 * @returns Cloned payload with all replacements applied.
 */
export function applyPayloadReplacements(
	payload: OpenApiValue,
	replacements: ArazzoPayloadReplacementObject[] | undefined,
	context: ArazzoRuntimeContext,
): OpenApiValue {
	const evaluatedBase = evaluatePayloadExpressions(payload, context);
	if (!replacements || replacements.length === 0) {
		return evaluatedBase;
	}

	let working: OpenApiValue =
		evaluatedBase !== null && typeof evaluatedBase === "object"
			? (JSON.parse(JSON.stringify(evaluatedBase)) as OpenApiValue)
			: evaluatedBase;

	for (const rep of replacements) {
		const resolvedValue = evaluateValueOrSelector(rep.value, context);
		const rawDialect = rep.targetSelectorType;
		const dialect: ArazzoExpressionDialect = isArazzoExpressionTypeObject(
			rawDialect,
		)
			? rawDialect.type
			: rawDialect
				? rawDialect
				: rep.target.startsWith("$")
					? "jsonpath"
					: typeof working === "string"
						? "xpath"
						: "jsonpointer";

		if (dialect === "xpath" && typeof working === "string") {
			working = setByXPath(working, rep.target, resolvedValue);
		} else if (dialect === "jsonpath") {
			const pointer = jsonPathToPointer(rep.target);
			working = setByJsonPointer(working, pointer, resolvedValue);
		} else {
			working = setByJsonPointer(working, rep.target, resolvedValue);
		}
	}

	return working;
}

/**
 * Topologically sorts a list of `ArazzoWorkflowObject`s based on their `dependsOn` declarations.
 * Preserves declaration order for independent workflows and throws an Error on dependency cycles.
 *
 * @param workflows - List of workflows from an Arazzo specification.
 * @returns Ordered array of `workflowId`s.
 * @throws {Error} When a cyclic `dependsOn` graph is detected.
 */
export function topologicalSortWorkflows(
	workflows: ArazzoWorkflowObject[],
): string[] {
	const localIds = new Set(workflows.map((w) => w.workflowId));
	const byId = new Map(workflows.map((w) => [w.workflowId, w]));
	const visited = new Set<string>();
	const visiting = new Set<string>();
	const order: string[] = [];

	const visit = (wfId: string, chain: string[]): void => {
		if (visited.has(wfId)) return;
		if (visiting.has(wfId)) {
			throw new Error(
				`Cyclic workflow dependency detected: ${[...chain, wfId].join(" -> ")}`,
			);
		}
		visiting.add(wfId);
		const wf = byId.get(wfId);
		if (wf?.dependsOn) {
			for (const dep of wf.dependsOn) {
				if (localIds.has(dep)) {
					visit(dep, [...chain, wfId]);
				}
			}
		}
		visiting.delete(wfId);
		visited.add(wfId);
		order.push(wfId);
	};

	for (const wf of workflows) {
		visit(wf.workflowId, []);
	}

	return order;
}

/**
 * Topologically sorts a list of `ArazzoStepObject`s within a workflow based on Arazzo 1.1.0 step-level `dependsOn`.
 * Preserves declaration order for steps without `dependsOn` and throws an Error on cycles or unknown step references.
 *
 * @param steps - List of steps within a workflow.
 * @returns Ordered array of `stepId`s.
 * @throws {Error} When a step references an unknown `dependsOn` stepId or forms a dependency cycle.
 */
export function topologicalSortSteps(steps: ArazzoStepObject[]): string[] {
	const byId = new Map(steps.map((s) => [s.stepId, s]));
	const visited = new Set<string>();
	const visiting = new Set<string>();
	const order: string[] = [];

	const visit = (stepId: string, chain: string[]): void => {
		if (visited.has(stepId)) return;
		if (visiting.has(stepId)) {
			throw new Error(
				`Cyclic step dependency detected: ${[...chain, stepId].join(" -> ")}`,
			);
		}
		const step = byId.get(stepId);
		if (!step) {
			throw new Error(`Step dependency references unknown stepId: ${stepId}`);
		}
		visiting.add(stepId);
		if (step.dependsOn) {
			for (const dep of step.dependsOn) {
				visit(dep, [...chain, stepId]);
			}
		}
		visiting.delete(stepId);
		visited.add(stepId);
		order.push(stepId);
	};

	for (const step of steps) {
		visit(step.stepId, []);
	}

	return order;
}
