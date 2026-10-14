/**
 * Validates OpenAPI Components, Schemas, Discriminators, XML, Security Schemes, Examples, Media Types, Encodings, Headers, Links, RequestBodies, and Responses.
 *
 * @module openapi/validators/validate_components
 */
import type {
	OpenApiValue,
	Parameter,
	ReferenceLike,
	ServerObject,
	SwaggerSpec,
} from "../../core/types/index.js";
import { isUrl } from "../../functions/utils.js";
import {
	isAbsoluteIri,
	isUriReference,
	SpecValidationError,
	validateExternalDocsObject,
} from "./validate_info.js";
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
 * @param mode - Whether a bare string without braces must still be a runtime expression.
 * @param label - Human-readable label for error reporting.
 * @throws {SpecValidationError} When the expression syntax is invalid.
 */
export function validateRuntimeExpressionTemplate(
	expression: string,
	location: string,
	mode: RuntimeExpressionMode,
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
			const inner = match[1]?.trim() ?? "";
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

	if (mode === "required" || expression.startsWith("$")) {
		if (!isValidRuntimeExpression(expression)) {
			throw new SpecValidationError(
				`${label} at '${location}' must be a valid runtime expression.`,
			);
		}
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

type SchemaTypeKind = "primitive" | "array" | "object" | "unknown";

function getSchemaTypeKind(schema: OpenApiValue): SchemaTypeKind {
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

const PARAM_STYLE_BY_IN: Record<string, Set<string>> = {
	path: new Set(["matrix", "label", "simple"]),
	query: new Set(["form", "spaceDelimited", "pipeDelimited", "deepObject"]),
	header: new Set(["simple"]),
	cookie: new Set(["form", "cookie"]),
	querystring: new Set([]),
};

const XML_NODE_TYPES = new Set([
	"element",
	"attribute",
	"text",
	"cdata",
	"none",
]);

/**
 * Reserved HTTP header names that are ignored when declared as `in: "header"` parameters.
 */
export const RESERVED_HEADER_NAMES: Set<string> = new Set([
	"accept",
	"content-type",
	"authorization",
]);

function isPropertyRequired(
	schema: OpenApiValue,
	propName: string,
	seen: WeakSet<object> = new WeakSet<object>(),
): boolean {
	if (!schema || typeof schema !== "object") return false;
	const obj = schema as Record<string, OpenApiValue>;
	if (seen.has(obj)) return false;
	seen.add(obj);

	const required = obj.required;
	if (Array.isArray(required) && required.includes(propName)) return true;

	if (Array.isArray(obj.allOf)) {
		return (obj.allOf as OpenApiValue[]).some((sub) => {
			if (!sub || typeof sub !== "object") return false;
			if ("$ref" in (sub as object) || "$dynamicRef" in (sub as object))
				return false;
			return isPropertyRequired(sub, propName, seen);
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

	const visit = (child: OpenApiValue, childPath: string) =>
		validateSchemaExternalDocs(child, childPath, seen);

	if (Array.isArray(obj.allOf))
		(obj.allOf as OpenApiValue[]).forEach((s: OpenApiValue, i: number) =>
			visit(s, `${location}.allOf[${i}]`),
		);
	if (Array.isArray(obj.anyOf))
		(obj.anyOf as OpenApiValue[]).forEach((s: OpenApiValue, i: number) =>
			visit(s, `${location}.anyOf[${i}]`),
		);
	if (Array.isArray(obj.oneOf))
		(obj.oneOf as OpenApiValue[]).forEach((s: OpenApiValue, i: number) =>
			visit(s, `${location}.oneOf[${i}]`),
		);

	if (obj.not) visit(obj.not, `${location}.not`);
	if (obj.if) visit(obj.if, `${location}.if`);
	if (obj.then) visit(obj.then, `${location}.then`);
	if (obj.else) visit(obj.else, `${location}.else`);

	if (obj.items) {
		if (Array.isArray(obj.items)) {
			(obj.items as OpenApiValue[]).forEach((s: OpenApiValue, i: number) =>
				visit(s, `${location}.items[${i}]`),
			);
		} else {
			visit(obj.items, `${location}.items`);
		}
	}

	if (Array.isArray(obj.prefixItems)) {
		(obj.prefixItems as OpenApiValue[]).forEach((s: OpenApiValue, i: number) =>
			visit(s, `${location}.prefixItems[${i}]`),
		);
	}

	if (obj.properties && typeof obj.properties === "object") {
		Object.entries(obj.properties as Record<string, OpenApiValue>).forEach(
			([key, value]) => visit(value, `${location}.properties.${key}`),
		);
	}

	if (obj.patternProperties && typeof obj.patternProperties === "object") {
		Object.entries(
			obj.patternProperties as Record<string, OpenApiValue>,
		).forEach(([key, value]) =>
			visit(value, `${location}.patternProperties.${key}`),
		);
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
		).forEach(([key, value]) =>
			visit(value, `${location}.dependentSchemas.${key}`),
		);
	}

	if (obj.contentSchema) {
		visit(obj.contentSchema, `${location}.contentSchema`);
	}
}

/**
 * Validates parameter `in`, `style`, and `explode` combinations for OpenAPI 3.x parameters.
 *
 * @param param - Parameter object to validate.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When the parameter location or style combination is invalid.
 */
export function validateParameterStyle(
	param: Parameter,
	location: string,
): void {
	const allowedLocations = new Set([
		"query",
		"path",
		"header",
		"cookie",
		"querystring",
	]);

	if (!allowedLocations.has(param.in)) {
		throw new SpecValidationError(
			`Parameter '${param.name}' in '${location}' has invalid location '${param.in}' for OpenAPI 3.x.`,
		);
	}

	if (param.style === undefined) return;

	if (typeof param.style !== "string") {
		throw new SpecValidationError(
			`Parameter '${param.name}' in '${location}' has non-string 'style'.`,
		);
	}

	const allowedStyles = PARAM_STYLE_BY_IN[param.in];
	if (!allowedStyles?.has(param.style)) {
		throw new SpecValidationError(
			`Parameter '${param.name}' in '${location}' has invalid style '${param.style}' for location '${param.in}'.`,
		);
	}

	const schemaType = getSchemaTypeKind(param.schema);

	if (
		param.style === "deepObject" &&
		schemaType !== "object" &&
		schemaType !== "unknown"
	) {
		throw new SpecValidationError(
			`Parameter '${param.name}' in '${location}' uses 'deepObject' style but schema is not an object.`,
		);
	}

	if (
		(param.style === "spaceDelimited" || param.style === "pipeDelimited") &&
		schemaType === "primitive"
	) {
		throw new SpecValidationError(
			`Parameter '${param.name}' in '${location}' uses '${param.style}' style but schema is not an array or object.`,
		);
	}

	if (
		(param.style === "spaceDelimited" || param.style === "pipeDelimited") &&
		param.explode === true
	) {
		throw new SpecValidationError(
			`Parameter '${param.name}' in '${location}' uses '${param.style}' style with explode=true, which is not permitted.`,
		);
	}
}

function validateHttpsUrl(
	value: OpenApiValue,
	location: string,
	fieldName: string,
): void {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new SpecValidationError(
			`${fieldName} must be a non-empty string at ${location}.`,
		);
	}

	if (!isUrl(value)) {
		throw new SpecValidationError(
			`${fieldName} must be a valid URL at ${location}. Value: "${value}"`,
		);
	}

	if (typeof URL !== "undefined") {
		try {
			const parsed = new URL(value);
			const proto = (parsed.protocol || "").replace(/:$/, "").toLowerCase();
			if (proto !== "https") {
				throw new SpecValidationError(
					`${fieldName} must use https (TLS required) at ${location}. Value: "${value}"`,
				);
			}
			return;
		} catch (e) {
			if (e instanceof SpecValidationError) throw e;
		}
	}

	if (!value.toLowerCase().startsWith("https://")) {
		throw new SpecValidationError(
			`${fieldName} must use https (TLS required) at ${location}. Value: "${value}"`,
		);
	}
}

function validateOAuthFlow(
	flow: OpenApiValue,
	flowName: string,
	location: string,
): void {
	if (!flow || typeof flow !== "object") {
		throw new SpecValidationError(
			`OAuth2 flow "${flowName}" must be an object at ${location}.`,
		);
	}

	const f = flow as Record<string, OpenApiValue>;
	const requiresAuthorizationUrl =
		flowName === "implicit" || flowName === "authorizationCode";
	const requiresTokenUrl =
		flowName === "password" ||
		flowName === "clientCredentials" ||
		flowName === "authorizationCode" ||
		flowName === "deviceAuthorization";

	if (requiresAuthorizationUrl) {
		validateHttpsUrl(
			f.authorizationUrl,
			`${location}.${flowName}`,
			"authorizationUrl",
		);
	}

	if (requiresTokenUrl) {
		validateHttpsUrl(f.tokenUrl, `${location}.${flowName}`, "tokenUrl");
	}

	if (flowName === "deviceAuthorization") {
		validateHttpsUrl(
			f.deviceAuthorizationUrl,
			`${location}.${flowName}`,
			"deviceAuthorizationUrl",
		);
	}

	if (f.refreshUrl !== undefined) {
		validateHttpsUrl(f.refreshUrl, `${location}.${flowName}`, "refreshUrl");
	}

	if (f.scopes === undefined || typeof f.scopes !== "object") {
		throw new SpecValidationError(
			`OAuth2 flow "${flowName}" must define 'scopes' as an object at ${location}.`,
		);
	}
}

/**
 * Checks whether an OpenAPI value is a `$ref` or `$dynamicRef` reference object.
 *
 * @param obj - Value to check.
 * @returns `true` if `obj` contains `$ref` or `$dynamicRef`.
 */
export function isRefLike(obj: OpenApiValue): obj is ReferenceLike {
	if (!obj || typeof obj !== "object") return false;
	return "$ref" in obj || "$dynamicRef" in obj;
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
	if (!refObj || typeof refObj !== "object") return;
	const obj = refObj as Record<string, OpenApiValue>;
	const hasRef = typeof obj.$ref === "string";
	const hasDynamicRef = typeof obj.$dynamicRef === "string";

	if (!hasRef && !hasDynamicRef) return;

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

/**
 * Validates `components.securitySchemes` definitions in OpenAPI 3.x documents.
 *
 * @param schemes - Map of security scheme definitions.
 * @param location - Diagnostic location path.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When any security scheme is invalid.
 */
export function validateSecuritySchemes(
	schemes: Record<string, OpenApiValue> | undefined,
	location: string,
	isOpenApi3: boolean,
): void {
	if (!schemes || !isOpenApi3) return;

	for (const [name, rawScheme] of Object.entries(schemes)) {
		if (!rawScheme || typeof rawScheme !== "object") continue;

		if (isRefLike(rawScheme)) {
			validateReferenceObject(rawScheme, `${location}.${name}`);
			continue;
		}

		const scheme = rawScheme as Record<string, OpenApiValue>;
		const type = scheme.type;

		if (typeof type !== "string") {
			throw new SpecValidationError(
				`Security scheme "${name}" must define a string 'type' at ${location}.`,
			);
		}

		switch (type) {
			case "apiKey": {
				const keyName = scheme.name;
				const keyIn = scheme.in;
				if (typeof keyName !== "string" || keyName.length === 0) {
					throw new SpecValidationError(
						`apiKey security scheme "${name}" must define non-empty 'name' at ${location}.`,
					);
				}
				if (keyIn !== "query" && keyIn !== "header" && keyIn !== "cookie") {
					throw new SpecValidationError(
						`apiKey security scheme "${name}" must define 'in' as 'query', 'header', or 'cookie' at ${location}.`,
					);
				}
				break;
			}
			case "http": {
				const httpScheme = scheme.scheme;
				if (typeof httpScheme !== "string" || httpScheme.length === 0) {
					throw new SpecValidationError(
						`http security scheme "${name}" must define non-empty 'scheme' at ${location}.`,
					);
				}
				break;
			}
			case "oauth2": {
				const flows = scheme.flows;
				if (!flows || typeof flows !== "object") {
					throw new SpecValidationError(
						`oauth2 security scheme "${name}" must define 'flows' at ${location}.`,
					);
				}
				if (scheme.oauth2MetadataUrl !== undefined) {
					validateHttpsUrl(
						scheme.oauth2MetadataUrl,
						`${location}.${name}`,
						"oauth2MetadataUrl",
					);
				}
				const flowEntries = Object.entries(
					flows as Record<string, OpenApiValue>,
				);
				if (flowEntries.length === 0) {
					throw new SpecValidationError(
						`oauth2 security scheme "${name}" must define at least one flow at ${location}.`,
					);
				}
				for (const [flowName, flowObj] of flowEntries) {
					validateOAuthFlow(flowObj, flowName, `${location}.${name}.flows`);
				}
				break;
			}
			case "openIdConnect": {
				validateHttpsUrl(
					scheme.openIdConnectUrl,
					`${location}.${name}`,
					"openIdConnectUrl",
				);
				break;
			}
			case "mutualTLS": {
				break;
			}
			default: {
				throw new SpecValidationError(
					`Security scheme "${name}" has unsupported type "${type}" at ${location}.`,
				);
			}
		}
	}
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
	return value.split(";")[0].trim().toLowerCase();
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

function isSequentialMediaType(mediaType: string | undefined): boolean {
	const normalized = normalizeMediaType(mediaType);
	if (!normalized) return false;
	if (normalized.startsWith("multipart/")) return true;
	if (SEQUENTIAL_MEDIA_TYPES.has(normalized)) return true;
	for (const suffix of SEQUENTIAL_MEDIA_SUFFIXES) {
		if (normalized.endsWith(suffix)) return true;
	}
	return false;
}

function isCustomSequentialJsonMediaType(
	mediaType: string | undefined,
): boolean {
	const normalized = normalizeMediaType(mediaType);
	if (!normalized) return false;
	if (normalized === "application/json" || normalized === "*/*") return false;
	if (normalized.startsWith("multipart/")) return false;
	return normalized.includes("json") || normalized.endsWith("+json");
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
	content: Record<string, OpenApiValue> | undefined,
	location: string,
): void {
	if (!content) return;
	for (const [mediaType, mediaObj] of Object.entries(content)) {
		validateMediaTypeObject(mediaObj, `${location}.${mediaType}`, mediaType);
	}
}

/**
 * Validates an OpenAPI Header Object.
 *
 * @param headerObj - Candidate Header Object.
 * @param location - Diagnostic location path.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When forbidden fields or invalid schema/content combinations are present.
 */
export function validateHeaderObject(
	headerObj: OpenApiValue,
	location: string,
	isOpenApi3: boolean,
): void {
	if (!headerObj || typeof headerObj !== "object") return;

	if (isRefLike(headerObj)) {
		validateReferenceObject(headerObj, location);
		return;
	}

	const header = headerObj as {
		schema?: Record<string, OpenApiValue> | boolean;
		content?: Record<string, OpenApiValue>;
		name?: OpenApiValue;
		in?: OpenApiValue;
		style?: string;
		allowEmptyValue?: OpenApiValue;
		example?: OpenApiValue;
		examples?: OpenApiValue;
	};

	if (header.name !== undefined) {
		throw new SpecValidationError(
			`Header Object at '${location}' MUST NOT define a 'name' field.`,
		);
	}
	if (header.in !== undefined) {
		throw new SpecValidationError(
			`Header Object at '${location}' MUST NOT define an 'in' field.`,
		);
	}
	if (header.allowEmptyValue !== undefined) {
		throw new SpecValidationError(
			`Header Object at '${location}' MUST NOT define 'allowEmptyValue'.`,
		);
	}
	if (header.style !== undefined && header.style !== "simple") {
		throw new SpecValidationError(
			`Header Object at '${location}' has invalid 'style'. The only allowed value is 'simple'.`,
		);
	}
	if (header.example !== undefined && header.examples !== undefined) {
		throw new SpecValidationError(
			`Header Object at '${location}' contains both 'example' and 'examples'. These fields are mutually exclusive.`,
		);
	}

	if (header.examples && typeof header.examples === "object") {
		Object.entries(header.examples as Record<string, OpenApiValue>).forEach(
			([name, example]) => {
				validateExampleObject(example, `${location}.examples.${name}`);
			},
		);
	}

	if (
		isOpenApi3 &&
		header.schema === undefined &&
		header.content === undefined
	) {
		throw new SpecValidationError(
			`Header Object at '${location}' must define either 'schema' or 'content'.`,
		);
	}

	if (header.schema !== undefined && header.content !== undefined) {
		throw new SpecValidationError(
			`Header Object at '${location}' contains both 'schema' and 'content'. These fields are mutually exclusive.`,
		);
	}

	if (header.schema !== undefined) {
		validateSchemaExternalDocs(header.schema, `${location}.schema`);
	}

	if (header.content && Object.keys(header.content).length !== 1) {
		throw new SpecValidationError(
			`Header Object at '${location}' has an invalid 'content' map. It MUST contain exactly one entry.`,
		);
	}

	if (header.content) {
		validateContentMap(header.content, `${location}.content`);
	}
}

/**
 * Validates a map of Header Objects (ignoring `Content-Type` per OAS 3.2).
 *
 * @param headers - Map of header names to Header Objects.
 * @param location - Diagnostic location path.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When any header definition is invalid.
 */
export function validateHeadersMap(
	headers: Record<string, OpenApiValue> | undefined,
	location: string,
	isOpenApi3: boolean,
): void {
	if (!headers) return;
	for (const [headerName, headerObj] of Object.entries(headers)) {
		if (headerName.toLowerCase() === "content-type") continue;
		validateHeaderObject(headerObj, `${location}.${headerName}`, isOpenApi3);
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
	links: Record<string, OpenApiValue> | undefined,
	location: string,
): void {
	if (!links) return;
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
	responses: Record<string, OpenApiValue> | undefined,
	location: string,
	isOpenApi3: boolean,
): void {
	if (!responses) return;

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
	responses: Record<string, OpenApiValue> | undefined,
	location: string,
	isOpenApi3: boolean,
): void {
	if (!responses) return;
	for (const [name, responseObj] of Object.entries(responses)) {
		validateResponseObject(responseObj, `${location}.${name}`, isOpenApi3);
	}
}

const OPERATION_KEYS = [
	"get",
	"post",
	"put",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
	"query",
];

/**
 * Validates the operations (`responses`, `externalDocs`, `requestBody`) inside a single PathItem Object.
 *
 * @param pathItem - Candidate PathItem Object.
 * @param location - Diagnostic location path.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When any operation on the PathItem is invalid.
 */
export function validatePathItemOperations(
	pathItem: OpenApiValue,
	location: string,
	isOpenApi3: boolean,
): void {
	if (!pathItem || typeof pathItem !== "object") return;

	if (isRefLike(pathItem)) {
		validateReferenceObject(pathItem, location);
		return;
	}

	const pi = pathItem as Record<string, OpenApiValue>;

	for (const method of OPERATION_KEYS) {
		const operation = pi[method] as Record<string, OpenApiValue> | undefined;
		if (operation) {
			if (operation.responses === undefined) {
				throw new SpecValidationError(
					`Operation Object at '${location}.${method}' must define 'responses'.`,
				);
			}
			if (operation.externalDocs) {
				validateExternalDocsObject(
					operation.externalDocs,
					`${location}.${method}.externalDocs`,
				);
			}
			validateRequestBody(
				operation.requestBody,
				`${location}.${method}.requestBody`,
			);
			validateResponses(
				operation.responses as Record<string, OpenApiValue>,
				`${location}.${method}.responses`,
				isOpenApi3,
			);
		}
	}

	if (pi.additionalOperations) {
		for (const [method, opVal] of Object.entries(
			pi.additionalOperations as Record<string, OpenApiValue>,
		)) {
			const operation = opVal as Record<string, OpenApiValue> | undefined;
			if (operation?.responses === undefined) {
				throw new SpecValidationError(
					`Operation Object at '${location}.additionalOperations.${method}' must define 'responses'.`,
				);
			}
			if (operation?.externalDocs) {
				validateExternalDocsObject(
					operation.externalDocs,
					`${location}.additionalOperations.${method}.externalDocs`,
				);
			}
			validateRequestBody(
				operation?.requestBody,
				`${location}.additionalOperations.${method}.requestBody`,
			);
			validateResponses(
				operation?.responses as Record<string, OpenApiValue>,
				`${location}.additionalOperations.${method}.responses`,
				isOpenApi3,
			);
		}
	}
}

/**
 * Validates all PathItem entries in a paths/webhooks/callbacks map.
 *
 * @param paths - Map of path keys to PathItem Objects.
 * @param locationPrefix - Diagnostic prefix (e.g. `"webhooks."`).
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When any PathItem operation is invalid.
 */
export function validateOperationsContent(
	paths: Record<string, OpenApiValue> | undefined,
	locationPrefix: string,
	isOpenApi3: boolean,
): void {
	if (!paths) return;
	for (const [pathKey, pathItem] of Object.entries(paths)) {
		if (!pathItem || typeof pathItem !== "object") continue;
		validatePathItemOperations(
			pathItem,
			`${locationPrefix}${pathKey}`,
			isOpenApi3,
		);
	}
}

/**
 * Validates `components` (parameters, headers, links, examples, mediaTypes, requestBodies, callbacks, pathItems, webhooks, responses, schemas, securitySchemes, and component key syntax) as well as Swagger 2.0 `definitions`.
 *
 * @param spec - Root OpenAPI/Swagger specification.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @throws {SpecValidationError} When any component definition or key is invalid.
 */
export function validateComponentsAndDefinitions(
	spec: SwaggerSpec,
	isOpenApi3: boolean,
): void {
	if (isOpenApi3 && spec.components?.parameters) {
		for (const [name, paramObj] of Object.entries(spec.components.parameters)) {
			const param = paramObj as Record<string, OpenApiValue>;

			if (!param || typeof param !== "object") {
				throw new SpecValidationError(
					`Component parameter '${name}' must be an object or Reference Object.`,
				);
			}

			if (isRefLike(param)) {
				validateReferenceObject(param, `components.parameters.${name}`);
				continue;
			}

			if (typeof param.name !== "string" || param.name.trim().length === 0) {
				throw new SpecValidationError(
					`Component parameter '${name}' must define a non-empty string 'name'.`,
				);
			}

			if (typeof param.in !== "string" || param.in.trim().length === 0) {
				throw new SpecValidationError(
					`Component parameter '${name}' must define a non-empty string 'in'.`,
				);
			}

			if (
				param.in === "header" &&
				typeof param.name === "string" &&
				RESERVED_HEADER_NAMES.has(param.name.toLowerCase())
			) {
				continue;
			}

			if (param.example !== undefined && param.examples !== undefined) {
				throw new SpecValidationError(
					`Component parameter '${name}' contains both 'example' and 'examples'. These fields are mutually exclusive.`,
				);
			}

			if (param.examples && typeof param.examples === "object") {
				Object.entries(param.examples as Record<string, OpenApiValue>).forEach(
					([exampleName, example]) => {
						validateExampleObject(
							example,
							`components.parameters.${name}.examples.${exampleName}`,
						);
					},
				);
			}

			if (param.schema !== undefined) {
				validateSchemaExternalDocs(
					param.schema,
					`components.parameters.${name}.schema`,
				);
			}

			if (param.schema === undefined && param.content === undefined) {
				throw new SpecValidationError(
					`Component parameter '${name}' must define either 'schema' or 'content'.`,
				);
			}

			if (param.schema !== undefined && param.content !== undefined) {
				throw new SpecValidationError(
					`Component parameter '${name}' contains both 'schema' and 'content'. These fields are mutually exclusive.`,
				);
			}

			if (param.content) {
				if (Object.keys(param.content as object).length !== 1) {
					throw new SpecValidationError(
						`Component parameter '${name}' has an invalid 'content' map. It MUST contain exactly one entry.`,
					);
				}
			}

			if (param.allowEmptyValue) {
				if (param.in !== "query") {
					throw new SpecValidationError(
						`Component parameter '${name}' defines 'allowEmptyValue' but location is not 'query'.`,
					);
				}
				if (param.style) {
					throw new SpecValidationError(
						`Component parameter '${name}' defines 'allowEmptyValue' alongside 'style'. This is forbidden.`,
					);
				}
			}

			if (param.in === "querystring") {
				if (
					param.style !== undefined ||
					param.explode !== undefined ||
					param.allowReserved !== undefined
				) {
					throw new SpecValidationError(
						`Component parameter '${name}' has location 'querystring' but defines style/explode/allowReserved, which are forbidden.`,
					);
				}
				if (param.schema !== undefined) {
					throw new SpecValidationError(
						`Component parameter '${name}' has location 'querystring' but defines 'schema'. Querystring parameters MUST use 'content' instead.`,
					);
				}
				if (param.content === undefined) {
					throw new SpecValidationError(
						`Component parameter '${name}' has location 'querystring' but is missing 'content'. Querystring parameters MUST use 'content'.`,
					);
				}
			}

			validateParameterStyle(
				param as Parameter,
				`components.parameters.${name}`,
			);

			if (param.content) {
				validateContentMap(
					param.content as Record<string, OpenApiValue>,
					`components.parameters.${name}.content`,
				);
			}
		}
	}

	if (isOpenApi3 && spec.components) {
		if (spec.components.headers) {
			validateHeadersMap(
				spec.components.headers as Record<string, OpenApiValue>,
				"components.headers",
				isOpenApi3,
			);
		}
		if (spec.components.links) {
			validateLinksMap(
				spec.components.links as Record<string, OpenApiValue>,
				"components.links",
			);
		}
		if (spec.components.examples) {
			for (const [name, exampleObj] of Object.entries(
				spec.components.examples,
			)) {
				validateExampleObject(exampleObj, `components.examples.${name}`);
			}
		}
		if (spec.components.mediaTypes) {
			for (const [name, mediaObj] of Object.entries(
				spec.components.mediaTypes,
			)) {
				validateMediaTypeObject(mediaObj, `components.mediaTypes.${name}`);
			}
		}
		if (spec.components.requestBodies) {
			for (const [name, requestBody] of Object.entries(
				spec.components.requestBodies,
			)) {
				validateRequestBody(requestBody, `components.requestBodies.${name}`);
			}
		}
		if (spec.components.callbacks) {
			for (const [name, callbackObj] of Object.entries(
				spec.components.callbacks as Record<string, OpenApiValue>,
			)) {
				if (!callbackObj || typeof callbackObj !== "object") continue;
				if (isRefLike(callbackObj)) {
					validateReferenceObject(callbackObj, `components.callbacks.${name}`);
					continue;
				}
				Object.entries(callbackObj as Record<string, OpenApiValue>).forEach(
					([expression, callbackPathItem]) => {
						validateCallbackExpression(
							expression,
							`components.callbacks.${name}.${expression}`,
						);
						validatePathItemOperations(
							callbackPathItem,
							`components.callbacks.${name}.${expression}`,
							isOpenApi3,
						);
					},
				);
			}
		}
		if (spec.components.pathItems) {
			validateOperationsContent(
				spec.components.pathItems as Record<string, OpenApiValue>,
				"components.pathItems.",
				isOpenApi3,
			);
		}
		if (spec.components.webhooks) {
			validateOperationsContent(
				spec.components.webhooks as Record<string, OpenApiValue>,
				"components.webhooks.",
				isOpenApi3,
			);
		}
		if (spec.components.responses) {
			validateComponentResponses(
				spec.components.responses as Record<string, OpenApiValue>,
				"components.responses",
				isOpenApi3,
			);
		}

		const componentTypes = [
			"schemas",
			"responses",
			"parameters",
			"examples",
			"requestBodies",
			"headers",
			"securitySchemes",
			"links",
			"callbacks",
			"pathItems",
			"mediaTypes",
			"webhooks",
		];
		const validKeyRegex = /^[a-zA-Z0-9.\-_]+$/;

		for (const type of componentTypes) {
			const componentGroup = (spec.components as Record<string, OpenApiValue>)[
				type
			] as Record<string, OpenApiValue> | undefined;
			if (componentGroup) {
				for (const key of Object.keys(componentGroup)) {
					if (!validKeyRegex.test(key)) {
						throw new SpecValidationError(
							String.raw`Invalid component key "${key}" in "components.${type}". Keys must match regex: ^[a-zA-Z0-9\.\-_]+$`,
						);
					}
				}
			}
		}

		if (spec.components.schemas) {
			Object.entries(spec.components.schemas).forEach(([name, schema]) => {
				validateSchemaExternalDocs(schema, `components.schemas.${name}`);
			});
		}

		if (spec.components.securitySchemes) {
			validateSecuritySchemes(
				spec.components.securitySchemes as Record<string, OpenApiValue>,
				"components.securitySchemes",
				true,
			);
		}
	}

	if (spec.definitions) {
		Object.entries(spec.definitions).forEach(([name, schema]) => {
			validateSchemaExternalDocs(schema, `definitions.${name}`);
		});
	}
}
