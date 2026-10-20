/**
 * OpenAPI 3.x Security Scheme and OAuth2 Flow validation.
 *
 * @module openapi/validators/validate_security
 */
import type { OpenApiValue } from "../../core/types/index.js";
import { isUrl } from "../../functions/utils.js";
import { SpecValidationError } from "./validate_info.js";
import { isRefLike, validateReferenceObject } from "./validate_schemas.js";

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
 * Validates `components.securitySchemes` definitions in OpenAPI 3.x documents.
 *
 * @param schemes - Map of security scheme definitions.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When any security scheme is invalid.
 */
export function validateSecuritySchemes(
	schemes: Record<string, OpenApiValue>,
	location: string,
): void {
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
