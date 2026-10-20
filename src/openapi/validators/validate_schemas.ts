/**
 * JSON Schema 2020-12 and OpenAPI 3.x Schema Object, Discriminator, XML, and Reference Object validation.
 *
 * @module openapi/validators/validate_schemas
 */
import type { OpenApiValue, ReferenceLike } from "../../core/types/index.js";
import {
	isAbsoluteIri,
	isUriReference,
	SpecValidationError,
	validateExternalDocsObject,
} from "./validate_info.js";

/** Coarse classification of an OpenAPI schema's primary JSON type. */
export type SchemaTypeKind = "primitive" | "array" | "object" | "unknown";

/**
 * Classifies an OpenAPI schema into `"primitive"`, `"array"`, `"object"`, or `"unknown"`.
 *
 * @param schema - Candidate schema value.
 * @returns Coarse schema type classification.
 */
export function getSchemaTypeKind(schema: OpenApiValue): SchemaTypeKind {
	if (!schema || typeof schema !== "object") return "unknown";
	if ("$ref" in (schema as object) || "$dynamicRef" in (schema as object))
		return "unknown";

	const rawType = (schema as { type?: string | string[] }).type;
	const normalizeType = (value: OpenApiValue): SchemaTypeKind => {
		if (typeof value !== "string") return "unknown";
		if (value === "array") return "array";
		if (value === "object") return "object";
		if (["string", "number", "integer", "boolean", "null"].includes(value))
			return "primitive";
		return "unknown";
	};

	if (typeof rawType === "string") {
		return normalizeType(rawType);
	}

	if (Array.isArray(rawType)) {
		const filtered = rawType.filter((t: OpenApiValue) => t !== "null");
		if (filtered.length === 1) {
			return normalizeType(filtered[0]);
		}
	}

	return "unknown";
}

const XML_NODE_TYPES = new Set([
	"element",
	"attribute",
	"text",
	"cdata",
	"none",
]);

function isPropertyRequired(
	schema: Record<string, OpenApiValue>,
	propName: string,
	seen: WeakSet<object> = new WeakSet<object>(),
): boolean {
	if (seen.has(schema)) return false;
	seen.add(schema);

	const required = schema.required;
	if (Array.isArray(required) && required.includes(propName)) return true;

	if (Array.isArray(schema.allOf)) {
		return (schema.allOf as OpenApiValue[]).some((sub) => {
			if (!sub || typeof sub !== "object") return false;
			if ("$ref" in (sub as object) || "$dynamicRef" in (sub as object))
				return false;
			return isPropertyRequired(
				sub as Record<string, OpenApiValue>,
				propName,
				seen,
			);
		});
	}

	return false;
}

function validateDiscriminatorObject(
	schema: Record<string, OpenApiValue>,
	location: string,
): void {
	const discriminator = schema.discriminator;
	if (discriminator === undefined || discriminator === null) return;

	if (typeof discriminator === "string") {
		if (location.startsWith("definitions.")) return;
		throw new SpecValidationError(
			`Discriminator at '${location}' must be an object.`,
		);
	}

	if (typeof discriminator !== "object" || Array.isArray(discriminator)) {
		throw new SpecValidationError(
			`Discriminator at '${location}' must be an object.`,
		);
	}

	const propName = (discriminator as { propertyName?: string }).propertyName;
	if (typeof propName !== "string" || propName.trim().length === 0) {
		throw new SpecValidationError(
			`Discriminator at '${location}' must define a non-empty string 'propertyName'.`,
		);
	}

	const hasComposite =
		Array.isArray(schema.oneOf) ||
		Array.isArray(schema.anyOf) ||
		Array.isArray(schema.allOf);

	if (!hasComposite) {
		throw new SpecValidationError(
			`Discriminator at '${location}' is only valid alongside oneOf/anyOf/allOf.`,
		);
	}

	const mapping = (discriminator as { mapping?: Record<string, string> })
		.mapping;
	if (
		mapping !== undefined &&
		(typeof mapping !== "object" || Array.isArray(mapping))
	) {
		throw new SpecValidationError(
			`Discriminator mapping at '${location}' must be an object.`,
		);
	}

	if (mapping && typeof mapping === "object") {
		Object.entries(mapping as Record<string, OpenApiValue>).forEach(
			([key, value]) => {
				if (typeof value !== "string") {
					throw new SpecValidationError(
						`Discriminator mapping value for '${key}' at '${location}' must be a string.`,
					);
				}
			},
		);
	}

	const defaultMapping = (discriminator as { defaultMapping?: string })
		.defaultMapping;
	if (defaultMapping !== undefined && typeof defaultMapping !== "string") {
		throw new SpecValidationError(
			`Discriminator defaultMapping at '${location}' must be a string.`,
		);
	}

	const required = isPropertyRequired(schema, propName);
	if (!required && defaultMapping === undefined) {
		throw new SpecValidationError(
			`Discriminator property '${propName}' is optional at '${location}'. A 'defaultMapping' is required.`,
		);
	}
}

function validateXmlObject(
	schema: Record<string, OpenApiValue>,
	location: string,
): void {
	const xml = schema.xml;
	if (xml === undefined || xml === null) return;

	if (typeof xml !== "object" || Array.isArray(xml)) {
		throw new SpecValidationError(
			`XML Object at '${location}' must be an object.`,
		);
	}

	const xmlObj = xml as {
		nodeType?: OpenApiValue;
		name?: OpenApiValue;
		namespace?: OpenApiValue;
		prefix?: OpenApiValue;
		attribute?: OpenApiValue;
		wrapped?: OpenApiValue;
	};

	if (xmlObj.nodeType !== undefined) {
		if (
			typeof xmlObj.nodeType !== "string" ||
			!XML_NODE_TYPES.has(xmlObj.nodeType)
		) {
			throw new SpecValidationError(
				`XML Object at '${location}' has invalid 'nodeType'.`,
			);
		}
		if (xmlObj.attribute !== undefined) {
			throw new SpecValidationError(
				`XML Object at '${location}' MUST NOT define 'attribute' when 'nodeType' is present.`,
			);
		}
		if (xmlObj.wrapped !== undefined) {
			throw new SpecValidationError(
				`XML Object at '${location}' MUST NOT define 'wrapped' when 'nodeType' is present.`,
			);
		}
	}

	if (xmlObj.name !== undefined && typeof xmlObj.name !== "string") {
		throw new SpecValidationError(
			`XML Object at '${location}' has non-string 'name'.`,
		);
	}

	if (xmlObj.prefix !== undefined && typeof xmlObj.prefix !== "string") {
		throw new SpecValidationError(
			`XML Object at '${location}' has non-string 'prefix'.`,
		);
	}

	if (xmlObj.namespace !== undefined) {
		if (
			typeof xmlObj.namespace !== "string" ||
			!isAbsoluteIri(xmlObj.namespace)
		) {
			throw new SpecValidationError(
				`XML Object at '${location}' must define a non-relative IRI for 'namespace'.`,
			);
		}
	}

	if (xmlObj.attribute !== undefined && typeof xmlObj.attribute !== "boolean") {
		throw new SpecValidationError(
			`XML Object at '${location}' has non-boolean 'attribute'.`,
		);
	}

	if (xmlObj.wrapped !== undefined && typeof xmlObj.wrapped !== "boolean") {
		throw new SpecValidationError(
			`XML Object at '${location}' has non-boolean 'wrapped'.`,
		);
	}

	if (xmlObj.wrapped === true) {
		const schemaType = getSchemaTypeKind(schema);
		if (schemaType !== "array" && schemaType !== "unknown") {
			throw new SpecValidationError(
				`XML Object at '${location}' defines 'wrapped' but the schema is not an array.`,
			);
		}
	}
}

/**
 * Recursively validates a Schema Object (`$schema`, `$id`, `$anchor`, `$dynamicAnchor`, `$ref`, `$dynamicRef`, `externalDocs`, `discriminator`, `xml`, and child subschemas).
 *
 * @param schema - Candidate schema value.
 * @param location - Diagnostic location path.
 * @param seen - Visited object set to guard against circular schema references.
 * @throws {SpecValidationError} When any schema keyword or nested object is invalid.
 */
export function validateSchemaExternalDocs(
	schema: OpenApiValue,
	location: string,
	seen: WeakSet<object> = new WeakSet<object>(),
): void {
	if (schema === null || schema === undefined) return;
	if (typeof schema !== "object") return;

	const obj = schema as Record<string, OpenApiValue>;
	if (seen.has(obj)) return;
	seen.add(obj);

	if ("$schema" in obj) {
		const value = obj.$schema;
		if (typeof value !== "string" || !isUriReference(value)) {
			throw new SpecValidationError(
				`Schema Object at '${location}' has invalid '$schema'. It must be a valid URI reference.`,
			);
		}
	}

	if ("$id" in obj) {
		const value = obj.$id;
		if (typeof value !== "string" || !isUriReference(value)) {
			throw new SpecValidationError(
				`Schema Object at '${location}' has invalid '$id'. It must be a valid URI reference.`,
			);
		}
	}

	if ("$anchor" in obj) {
		const value = obj.$anchor;
		if (typeof value !== "string" || value.trim().length === 0) {
			throw new SpecValidationError(
				`Schema Object at '${location}' has invalid '$anchor'.`,
			);
		}
	}

	if ("$dynamicAnchor" in obj) {
		const value = obj.$dynamicAnchor;
		if (typeof value !== "string" || value.trim().length === 0) {
			throw new SpecValidationError(
				`Schema Object at '${location}' has invalid '$dynamicAnchor'.`,
			);
		}
	}

	if ("$ref" in obj) {
		const value = obj.$ref;
		if (typeof value !== "string" || !isUriReference(value)) {
			throw new SpecValidationError(
				`Schema Object at '${location}' has invalid '$ref'. It must be a valid URI reference.`,
			);
		}
	}

	if ("$dynamicRef" in obj) {
		const value = obj.$dynamicRef;
		if (typeof value !== "string" || !isUriReference(value)) {
			throw new SpecValidationError(
				`Schema Object at '${location}' has invalid '$dynamicRef'. It must be a valid URI reference.`,
			);
		}
	}

	if ("externalDocs" in obj) {
		validateExternalDocsObject(
			(obj as { externalDocs?: OpenApiValue }).externalDocs,
			`${location}.externalDocs`,
		);
	}

	if ("discriminator" in obj) {
		validateDiscriminatorObject(obj, `${location}.discriminator`);
	}

	if ("xml" in obj) {
		validateXmlObject(obj, `${location}.xml`);
	}

	if ("$ref" in obj || "$dynamicRef" in obj) {
		return;
	}

	const visit = (child: OpenApiValue, childPath: string) => {
		validateSchemaExternalDocs(child, childPath, seen);
	};

	if (Array.isArray(obj.allOf))
		(obj.allOf as OpenApiValue[]).forEach((s: OpenApiValue, i: number) => {
			visit(s, `${location}.allOf[${i}]`);
		});
	if (Array.isArray(obj.anyOf))
		(obj.anyOf as OpenApiValue[]).forEach((s: OpenApiValue, i: number) => {
			visit(s, `${location}.anyOf[${i}]`);
		});
	if (Array.isArray(obj.oneOf))
		(obj.oneOf as OpenApiValue[]).forEach((s: OpenApiValue, i: number) => {
			visit(s, `${location}.oneOf[${i}]`);
		});

	if (obj.not) visit(obj.not, `${location}.not`);
	if (obj.if) visit(obj.if, `${location}.if`);
	if (obj.then) visit(obj.then, `${location}.then`);
	if (obj.else) visit(obj.else, `${location}.else`);

	if (obj.items) {
		if (Array.isArray(obj.items)) {
			(obj.items as OpenApiValue[]).forEach((s: OpenApiValue, i: number) => {
				visit(s, `${location}.items[${i}]`);
			});
		} else {
			visit(obj.items, `${location}.items`);
		}
	}

	if (Array.isArray(obj.prefixItems)) {
		(obj.prefixItems as OpenApiValue[]).forEach(
			(s: OpenApiValue, i: number) => {
				visit(s, `${location}.prefixItems[${i}]`);
			},
		);
	}

	if (obj.properties && typeof obj.properties === "object") {
		Object.entries(obj.properties as Record<string, OpenApiValue>).forEach(
			([key, value]) => {
				visit(value, `${location}.properties.${key}`);
			},
		);
	}

	if (obj.patternProperties && typeof obj.patternProperties === "object") {
		Object.entries(
			obj.patternProperties as Record<string, OpenApiValue>,
		).forEach(([key, value]) => {
			visit(value, `${location}.patternProperties.${key}`);
		});
	}

	if (
		obj.additionalProperties &&
		typeof obj.additionalProperties === "object"
	) {
		visit(obj.additionalProperties, `${location}.additionalProperties`);
	}

	if (obj.dependentSchemas && typeof obj.dependentSchemas === "object") {
		Object.entries(
			obj.dependentSchemas as Record<string, OpenApiValue>,
		).forEach(([key, value]) => {
			visit(value, `${location}.dependentSchemas.${key}`);
		});
	}

	if (obj.contentSchema) {
		visit(obj.contentSchema, `${location}.contentSchema`);
	}
}

/**
 * Checks whether an OpenAPI value is a `$ref` or `$dynamicRef` reference object.
 *
 * @param obj - Value to check.
 * @returns `true` if `obj` contains `$ref` or `$dynamicRef`.
 */
export function isRefLike(obj: OpenApiValue): obj is ReferenceLike {
	return (
		typeof obj === "object" &&
		obj !== null &&
		("$ref" in obj || "$dynamicRef" in obj)
	);
}

/**
 * Validates a Reference Object (`$ref` / `$dynamicRef` exclusivity, URI syntax, and `summary`/`description` types).
 *
 * @param refObj - Candidate reference object.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When the reference object is invalid.
 */
export function validateReferenceObject(
	refObj: OpenApiValue,
	location: string,
): void {
	const obj = refObj as Record<string, OpenApiValue>;
	const hasRef = typeof obj.$ref === "string";
	const hasDynamicRef = typeof obj.$dynamicRef === "string";

	if (hasRef && hasDynamicRef) {
		throw new SpecValidationError(
			`Reference Object at '${location}' must not define both '$ref' and '$dynamicRef'.`,
		);
	}

	if (hasRef && !isUriReference(obj.$ref as string)) {
		throw new SpecValidationError(
			`Reference Object at '${location}' has invalid '$ref' URI. Value: "${String(obj.$ref)}"`,
		);
	}

	if (hasDynamicRef && !isUriReference(obj.$dynamicRef as string)) {
		throw new SpecValidationError(
			`Reference Object at '${location}' has invalid '$dynamicRef' URI. Value: "${String(obj.$dynamicRef)}"`,
		);
	}

	if (obj.summary !== undefined && typeof obj.summary !== "string") {
		throw new SpecValidationError(
			`Reference Object at '${location}' has non-string 'summary'. Value: "${String(obj.summary)}"`,
		);
	}

	if (obj.description !== undefined && typeof obj.description !== "string") {
		throw new SpecValidationError(
			`Reference Object at '${location}' has non-string 'description'. Value: "${String(obj.description)}"`,
		);
	}
}
