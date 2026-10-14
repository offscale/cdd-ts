/**
 * Validates OpenAPI/Swagger root version, `$self`, `jsonSchemaDialect`, `Info`, `Contact`, and `License` objects.
 *
 * @module openapi/validators/validate_info
 */
import type { OpenApiValue, SwaggerSpec } from "../../core/types/index.js";
import { isUrl } from "../../functions/utils.js";

/**
 * Error thrown when the OpenAPI specification fails validation.
 */
export class SpecValidationError extends Error {
	/**
	 * Creates a new `SpecValidationError`.
	 *
	 * @param message - Human-readable validation failure description.
	 */
	constructor(message: string) {
		super(message);
		this.name = "SpecValidationError";
	}
}

/**
 * Checks whether `value` is a syntactically valid RFC 3986 URI reference.
 *
 * @param value - Candidate URI reference string.
 * @returns `true` if `value` is a valid URI reference.
 */
export function isUriReference(value: string): boolean {
	if (!value || typeof value !== "string") return false;
	if (/\s/.test(value)) return false;
	if (isUrl(value)) return true;

	const schemeMatch = value.match(/^([^:/?#]+):/);
	if (schemeMatch) {
		if (!/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(schemeMatch[1])) {
			return false;
		}
	}

	return /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(value);
}

/**
 * Checks whether `value` is a syntactically valid email address.
 *
 * @param value - Candidate email address string.
 * @returns `true` if `value` matches `local@domain.tld`.
 */
export function isEmailAddress(value: string): boolean {
	if (!value || typeof value !== "string") return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Checks whether `value` starts with an absolute IRI scheme (`scheme:`).
 *
 * @param value - Candidate IRI string.
 * @returns `true` if `value` has an IRI scheme prefix.
 */
export function isAbsoluteIri(value: string): boolean {
	if (!value || typeof value !== "string") return false;
	return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

/**
 * Validates that template braces `{...}` in `value` are balanced, non-empty, and non-nested.
 *
 * @param value - String containing potential `{...}` template expressions.
 * @param location - Diagnostic path within the specification.
 * @param label - Human-readable label for the field being validated.
 * @throws {SpecValidationError} When braces are unmatched, empty, or nested.
 */
export function validateTemplateBraces(
	value: string,
	location: string,
	label: string,
): void {
	if (typeof value !== "string" || value.length === 0) return;
	if (!value.includes("{") && !value.includes("}")) return;

	let index = 0;
	while (index < value.length) {
		const char = value[index];
		if (char === "{") {
			const closeIndex = value.indexOf("}", index + 1);
			if (closeIndex === -1) {
				throw new SpecValidationError(
					`${label} at '${location}' contains an opening "{" without a matching "}".`,
				);
			}
			if (closeIndex === index + 1) {
				throw new SpecValidationError(
					`${label} at '${location}' contains an empty template expression "{}".`,
				);
			}
			const inner = value.slice(index + 1, closeIndex);
			if (inner.includes("{")) {
				throw new SpecValidationError(
					`${label} at '${location}' contains nested "{" characters, which is not allowed.`,
				);
			}
			index = closeIndex + 1;
			continue;
		}
		if (char === "}") {
			throw new SpecValidationError(
				`${label} at '${location}' contains a closing "}" without a matching "{".`,
			);
		}
		index += 1;
	}
}

/**
 * Validates an `ExternalDocumentationObject` at the given location.
 *
 * @param externalDocs - Candidate ExternalDocumentationObject value.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When `externalDocs` is not an object or `url` is invalid.
 */
export function validateExternalDocsObject(
	externalDocs: OpenApiValue,
	location: string,
): void {
	if (externalDocs === undefined || externalDocs === null) return;
	if (typeof externalDocs !== "object") {
		throw new SpecValidationError(
			`ExternalDocs at '${location}' must be an object.`,
		);
	}
	const url = (externalDocs as { url?: string }).url;
	if (typeof url !== "string" || !isUriReference(url)) {
		throw new SpecValidationError(
			`ExternalDocs.url must be a valid URI at '${location}'. Value: "${String(url)}"`,
		);
	}
}

/**
 * Result of validating the specification version header.
 */
export interface SpecVersionFlags {
	/** True when `spec.swagger` starts with `"2."`. */
	isSwag2: boolean;
	/** True when `spec.openapi` starts with `"3."`. */
	isOpenApi3: boolean;
}

/**
 * Validates the root OpenAPI/Swagger version, `info` object (`title`, `version`, `termsOfService`, `contact`, `license`),
 * `$self`, and root `externalDocs`.
 *
 * @param spec - Specification object to validate.
 * @returns Flags indicating whether the document is Swagger 2.0 or OpenAPI 3.x.
 * @throws {SpecValidationError} When version or Info metadata is invalid.
 */
export function validateInfoAndRootMeta(spec: SwaggerSpec): SpecVersionFlags {
	if (!spec) {
		throw new SpecValidationError("Specification cannot be null or undefined.");
	}

	const isSwag2 =
		typeof spec.swagger === "string" && spec.swagger.startsWith("2.");
	const isOpenApi3 =
		typeof spec.openapi === "string" && spec.openapi.startsWith("3.");

	if (!isSwag2 && !isOpenApi3) {
		throw new SpecValidationError(
			`Unsupported or missing OpenAPI/Swagger version. Specification must contain 'swagger: "2.x"' or 'openapi: "3.x"'.`,
		);
	}

	if (!spec.info) {
		throw new SpecValidationError(
			"Specification must contain an 'info' object.",
		);
	}

	if (!spec.info.title || typeof spec.info.title !== "string") {
		throw new SpecValidationError(
			"Specification info object must contain a required string field: 'title'.",
		);
	}

	if (!spec.info.version || typeof spec.info.version !== "string") {
		throw new SpecValidationError(
			"Specification info object must contain a required string field: 'version'.",
		);
	}

	if (isOpenApi3 && spec.$self !== undefined) {
		if (typeof spec.$self !== "string" || !isUriReference(spec.$self)) {
			throw new SpecValidationError(
				`OpenAPI Object $self must be a valid URI reference. Value: "${String(spec.$self)}"`,
			);
		}
	}

	if (spec.info.termsOfService !== undefined) {
		if (
			typeof spec.info.termsOfService !== "string" ||
			!isUriReference(spec.info.termsOfService)
		) {
			throw new SpecValidationError(
				`Info.termsOfService must be a valid URI. Value: "${String(spec.info.termsOfService)}"`,
			);
		}
	}

	if (spec.info.contact) {
		const contact = spec.info.contact as {
			url?: OpenApiValue;
			email?: OpenApiValue;
		};
		if (contact.url !== undefined) {
			if (typeof contact.url !== "string" || !isUriReference(contact.url)) {
				throw new SpecValidationError(
					`Info.contact.url must be a valid URI. Value: "${String(contact.url)}"`,
				);
			}
		}
		if (contact.email !== undefined) {
			if (typeof contact.email !== "string" || !isEmailAddress(contact.email)) {
				throw new SpecValidationError(
					`Info.contact.email must be a valid email address. Value: "${String(contact.email)}"`,
				);
			}
		}
	}

	if (spec.externalDocs) {
		validateExternalDocsObject(spec.externalDocs, "externalDocs");
	}

	if (spec.info.license) {
		if (!spec.info.license.name || typeof spec.info.license.name !== "string") {
			throw new SpecValidationError(
				"License object must contain a required string field: 'name'.",
			);
		}

		const hasUrl =
			spec.info.license.url !== undefined && spec.info.license.url !== null;
		const hasIdentifier =
			spec.info.license.identifier !== undefined &&
			spec.info.license.identifier !== null;

		if (hasUrl && hasIdentifier) {
			throw new SpecValidationError(
				"License object cannot contain both 'url' and 'identifier' fields. They are mutually exclusive.",
			);
		}

		if (
			hasUrl &&
			typeof spec.info.license.url === "string" &&
			!isUriReference(spec.info.license.url)
		) {
			throw new SpecValidationError(
				`Info.license.url must be a valid URI. Value: "${String(spec.info.license.url)}"`,
			);
		}
	}

	return { isSwag2, isOpenApi3 };
}

/**
 * Validates `spec.jsonSchemaDialect` when present in an OpenAPI 3.1+ specification.
 *
 * @param spec - Specification object to validate.
 * @throws {SpecValidationError} When `jsonSchemaDialect` is not a valid URI string.
 */
export function validateJsonSchemaDialect(spec: SwaggerSpec): void {
	if (spec.jsonSchemaDialect) {
		if (typeof spec.jsonSchemaDialect !== "string") {
			throw new SpecValidationError(
				"Field 'jsonSchemaDialect' must be a string.",
			);
		}
		if (!isUrl(spec.jsonSchemaDialect)) {
			if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(spec.jsonSchemaDialect)) {
				throw new SpecValidationError(
					`Field 'jsonSchemaDialect' must be a valid URI. Value: "${spec.jsonSchemaDialect}"`,
				);
			}
		}
	}
}
