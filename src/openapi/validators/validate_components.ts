/**
 * Facade and top-level orchestrator for OpenAPI Components, PathItem operations, and Swagger 2.0 definitions validation.
 *
 * @module openapi/validators/validate_components
 */
import type { OpenApiValue, SwaggerSpec } from "../../core/types/index.js";
import {
	SpecValidationError,
	validateExternalDocsObject,
} from "./validate_info.js";
import {
	PARAM_STYLE_BY_IN,
	RESERVED_HEADER_NAMES,
	validateComponentParameters,
	validateHeaderObject,
	validateHeadersMap,
	validateParameterStyle,
} from "./validate_parameters_headers.js";
import {
	type RuntimeExpressionMode,
	validateCallbackExpression,
	validateComponentResponses,
	validateContentMap,
	validateExampleObject,
	validateLinkObject,
	validateLinksMap,
	validateMediaTypeObject,
	validateRequestBody,
	validateResponseObject,
	validateResponses,
	validateRuntimeExpressionTemplate,
} from "./validate_responses_links.js";
import {
	getSchemaTypeKind,
	isRefLike,
	type SchemaTypeKind,
	validateReferenceObject,
	validateSchemaExternalDocs,
} from "./validate_schemas.js";
import { validateSecuritySchemes } from "./validate_security.js";

/** Re-exports `RuntimeExpressionMode` from `./validate_responses_links.js`. */
/** Re-exports `SchemaTypeKind` from `./validate_schemas.js`. */
export type { RuntimeExpressionMode, SchemaTypeKind };
/** Re-exports `PARAM_STYLE_BY_IN` from `./validate_parameters_headers.js`. */
/** Re-exports `RESERVED_HEADER_NAMES` from `./validate_parameters_headers.js`. */
/** Re-exports `getSchemaTypeKind` from `./validate_schemas.js`. */
/** Re-exports `isRefLike` from `./validate_schemas.js`. */
/** Re-exports `validateCallbackExpression` from `./validate_responses_links.js`. */
/** Re-exports `validateComponentParameters` from `./validate_parameters_headers.js`. */
/** Re-exports `validateComponentResponses` from `./validate_responses_links.js`. */
/** Re-exports `validateContentMap` from `./validate_responses_links.js`. */
/** Re-exports `validateExampleObject` from `./validate_responses_links.js`. */
/** Re-exports `validateHeaderObject` from `./validate_parameters_headers.js`. */
/** Re-exports `validateHeadersMap` from `./validate_parameters_headers.js`. */
/** Re-exports `validateLinkObject` from `./validate_responses_links.js`. */
/** Re-exports `validateLinksMap` from `./validate_responses_links.js`. */
/** Re-exports `validateMediaTypeObject` from `./validate_responses_links.js`. */
/** Re-exports `validateParameterStyle` from `./validate_parameters_headers.js`. */
/** Re-exports `validateReferenceObject` from `./validate_schemas.js`. */
/** Re-exports `validateRequestBody` from `./validate_responses_links.js`. */
/** Re-exports `validateResponseObject` from `./validate_responses_links.js`. */
/** Re-exports `validateResponses` from `./validate_responses_links.js`. */
/** Re-exports `validateRuntimeExpressionTemplate` from `./validate_responses_links.js`. */
/** Re-exports `validateSchemaExternalDocs` from `./validate_schemas.js`. */
/** Re-exports `validateSecuritySchemes` from `./validate_security.js`. */
export {
	getSchemaTypeKind,
	isRefLike,
	PARAM_STYLE_BY_IN,
	RESERVED_HEADER_NAMES,
	validateCallbackExpression,
	validateComponentParameters,
	validateComponentResponses,
	validateContentMap,
	validateExampleObject,
	validateHeaderObject,
	validateHeadersMap,
	validateLinkObject,
	validateLinksMap,
	validateMediaTypeObject,
	validateParameterStyle,
	validateReferenceObject,
	validateRequestBody,
	validateResponseObject,
	validateResponses,
	validateRuntimeExpressionTemplate,
	validateSchemaExternalDocs,
	validateSecuritySchemes,
};

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
		validateComponentParameters(
			spec.components.parameters as Record<string, OpenApiValue>,
		);
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
			);
		}
	}

	if (spec.definitions) {
		Object.entries(spec.definitions).forEach(([name, schema]) => {
			validateSchemaExternalDocs(schema, `definitions.${name}`);
		});
	}
}
