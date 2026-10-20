/**
 * Parses JSDoc tags and comments from TypeScript AST nodes into OpenAPI/JSON Schema validation constraints.
 *
 * @module classes/parse_jsdoc_constraints
 */
import type { JSDoc, Node } from "ts-morph";
import type { OpenApiValue, SwaggerDefinition } from "../core/types/index.js";

const NUMERIC_TAG_MAP: Record<string, keyof SwaggerDefinition> = {
	minimum: "minimum",
	min: "minimum",
	maximum: "maximum",
	max: "maximum",
	minlength: "minLength",
	maxlength: "maxLength",
	multipleof: "multipleOf",
	minitems: "minItems",
	maxitems: "maxItems",
	minproperties: "minProperties",
	maxproperties: "maxProperties",
	mincontains: "minContains",
	maxcontains: "maxContains",
};

const BOOLEAN_TAG_MAP: Record<string, keyof SwaggerDefinition> = {
	uniqueitems: "uniqueItems",
	readonly: "readOnly",
	writeonly: "writeOnly",
	nullable: "nullable",
};

const STRING_TAG_MAP: Record<string, keyof SwaggerDefinition> = {
	pattern: "pattern",
	format: "format",
	title: "title",
	contentmediatype: "contentMediaType",
	contentencoding: "contentEncoding",
	schemadialect: "$schema",
	schemaid: "$id",
	schemaanchor: "$anchor",
	schemadynamicanchor: "$dynamicAnchor",
};

const SCHEMA_OR_BOOLEAN_TAG_MAP: Record<string, string> = {
	propertynames: "propertyNames",
	additionalproperties: "additionalProperties",
	contains: "contains",
	contentschema: "contentSchema",
	unevaluatedproperties: "unevaluatedProperties",
	unevaluateditems: "unevaluatedItems",
	if: "if",
	then: "then",
	else: "else",
	not: "not",
};

const RECORD_TAG_MAP: Record<string, string> = {
	patternproperties: "patternProperties",
	dependentschemas: "dependentSchemas",
	dependentrequired: "dependentRequired",
	xml: "xml",
	discriminator: "discriminator",
};

/**
 * Extracts JSDoc comments and validation constraint tags from an AST node and applies them to `schema`.
 *
 * @param schema - Target OpenAPI schema definition to enrich.
 * @param node - TypeScript AST node potentially containing JSDoc comments.
 */
export function applyDocs(schema: SwaggerDefinition, node: Node): void {
	const nodeWithDocs = node as Node & { getJsDocs: () => JSDoc[] };
	const jsDocs = nodeWithDocs.getJsDocs();
	const primaryDoc = jsDocs[0];
	if (!primaryDoc) return;

	const exampleValues: OpenApiValue[] = [];
	const description = primaryDoc.getDescription().trim();

	if (description) schema.description = description;

	const schemaRec = schema as Record<string, OpenApiValue>;

	for (const tag of primaryDoc.getTags()) {
		const tagName = tag.getTagName();
		const text = (tag.getCommentText() ?? "").trim();
		const normalized = tagName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

		if (tagName === "deprecated") {
			schema.deprecated = true;
			continue;
		}

		if (tagName === "see") {
			const rawText = tag
				.getText()
				.replace(/^@see[\s*]*/i, "")
				.trim();
			if (rawText) {
				const [rawUrl, ...rest] = rawText.split(" - ");
				const url = (rawUrl as string).trim();
				const desc = rest.length > 0 ? rest.join(" - ").trim() : undefined;
				schema.externalDocs = desc ? { url, description: desc } : { url };
			}
			continue;
		}

		if (tagName === "example" && text) {
			exampleValues.push(parseDocValue(text));
			continue;
		}

		if (tagName === "default" && text) {
			schema.default = parseDocValue(text);
			continue;
		}

		if (tagName.startsWith("x-")) {
			schema[tagName] = text ? parseDocValue(text) : true;
			continue;
		}

		const rawValue = text ? parseDocValue(text) : true;

		const numericProp = NUMERIC_TAG_MAP[normalized];
		if (numericProp) {
			const value = asNumber(rawValue);
			if (value !== undefined) schemaRec[numericProp] = value;
			continue;
		}

		if (
			normalized === "exclusiveminimum" ||
			normalized === "exclusivemaximum"
		) {
			const targetProp =
				normalized === "exclusiveminimum"
					? "exclusiveMinimum"
					: "exclusiveMaximum";
			const value = asNumber(rawValue);
			schemaRec[targetProp] = value !== undefined ? value : Boolean(rawValue);
			continue;
		}

		const boolProp = BOOLEAN_TAG_MAP[normalized];
		if (boolProp) {
			schemaRec[boolProp] = asBoolean(rawValue);
			continue;
		}

		const stringProp = STRING_TAG_MAP[normalized];
		if (stringProp) {
			if (typeof rawValue === "string") schemaRec[stringProp] = rawValue;
			continue;
		}

		const schemaOrBoolProp = SCHEMA_OR_BOOLEAN_TAG_MAP[normalized];
		if (schemaOrBoolProp) {
			const requiresText =
				normalized === "if" ||
				normalized === "then" ||
				normalized === "else" ||
				normalized === "not";
			if (
				(!requiresText || text) &&
				(typeof rawValue === "object" || typeof rawValue === "boolean")
			) {
				schemaRec[schemaOrBoolProp] = rawValue;
			}
			continue;
		}

		const recordProp = RECORD_TAG_MAP[normalized];
		if (recordProp) {
			if (
				typeof rawValue === "object" &&
				rawValue !== null &&
				!Array.isArray(rawValue)
			) {
				schemaRec[recordProp] = rawValue;
			}
			continue;
		}

		if (normalized === "const" && text) {
			schema.const = rawValue;
		} else if (normalized === "oneof" && text && Array.isArray(rawValue)) {
			schema.oneOf = rawValue as (SwaggerDefinition | boolean)[];
			delete schema.anyOf;
		} else if (normalized === "anyof" && text && Array.isArray(rawValue)) {
			schema.anyOf = rawValue as (SwaggerDefinition | boolean)[];
			delete schema.oneOf;
		}
	}

	if (exampleValues.length === 1) {
		schema.example = exampleValues[0];
	} else if (exampleValues.length > 1) {
		schema.examples = exampleValues;
	}
}

function asNumber(value: OpenApiValue): number | undefined {
	if (typeof value === "number" && !Number.isNaN(value)) return value;
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return undefined;
}

function asBoolean(value: OpenApiValue): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		if (value.toLowerCase() === "true") return true;
		if (value.toLowerCase() === "false") return false;
	}
	return Boolean(value);
}

function parseDocValue(value: string): OpenApiValue {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}
