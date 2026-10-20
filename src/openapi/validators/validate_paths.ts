/**
 * Validates OpenAPI Paths, PathItem Objects, Operations, Parameters, Callbacks, Webhooks, and `operationId` uniqueness.
 *
 * @module openapi/validators/validate_paths
 */
import type {
	OpenApiValue,
	Parameter,
	SwaggerSpec,
} from "../../core/types/index.js";
import {
	isRefLike,
	RESERVED_HEADER_NAMES,
	validateCallbackExpression,
	validateContentMap,
	validateExampleObject,
	validateOperationsContent,
	validateParameterStyle,
	validatePathItemOperations,
	validateReferenceObject,
	validateRequestBody,
	validateResponses,
	validateSchemaExternalDocs,
} from "./validate_components.js";
import {
	SpecValidationError,
	validateExternalDocsObject,
	validateTemplateBraces,
} from "./validate_info.js";

const HTTP_METHOD_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

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

function getPathTemplateSignature(path: string): string {
	return path
		.split("/")
		.map((segment) => {
			if (segment.startsWith("{") && segment.endsWith("}")) {
				return "{}";
			}
			return segment;
		})
		.join("/");
}

function getPathTemplateParams(path: string): string[] {
	const matches = path.match(/\{[^}]+\}/g) ?? [];
	return matches.map((m) => m.slice(1, -1));
}

/**
 * Validates that parameter `(name, in)` pairs within a single parameter list are unique.
 *
 * @param params - Candidate array of Parameter Objects.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When duplicate parameter `(name, in)` pairs are detected.
 */
export function validateUniqueParameters(
	params: OpenApiValue,
	location: string,
): void {
	if (!Array.isArray(params)) return;
	const seen = new Set<string>();

	for (const param of params as OpenApiValue[]) {
		if (!param || typeof param !== "object") continue;
		const name = (param as { name?: string }).name;
		const loc = (param as { in?: string }).in;
		if (typeof name !== "string" || typeof loc !== "string") continue;

		const normalizedName =
			loc.toLowerCase() === "header" ? name.toLowerCase() : name;
		const key = `${normalizedName}:${loc}`;
		if (seen.has(key)) {
			throw new SpecValidationError(
				`Duplicate parameter '${name}' in '${location}'. Parameter names must be unique per location.`,
			);
		}
		seen.add(key);
	}
}

/**
 * Validates `spec.paths`, `spec.webhooks`, callbacks, and `operationId` uniqueness across the specification,
 * returning the collected callback PathItem map.
 *
 * @param spec - Root OpenAPI/Swagger specification.
 * @param isOpenApi3 - Whether the specification is OpenAPI 3.x.
 * @returns Collected callback PathItem entries keyed by diagnostic path.
 * @throws {SpecValidationError} When any path, parameter, operation, callback, or duplicate `operationId` is invalid.
 */
export function validatePathsWebhooksAndOperationIds(
	spec: SwaggerSpec,
	isOpenApi3: boolean,
): Record<string, OpenApiValue> {
	const operationIdLocations = new Map<string, string[]>();

	const recordOperationId = (operationId: string, location: string) => {
		const existing = operationIdLocations.get(operationId);
		if (existing) {
			existing.push(location);
		} else {
			operationIdLocations.set(operationId, [location]);
		}
	};

	const collectOperationIds = (
		paths: Record<string, OpenApiValue> | undefined,
		locationPrefix: string,
	) => {
		if (!paths) return;
		for (const [pathKey, pVal] of Object.entries(paths)) {
			const pathItem = pVal as Record<string, OpenApiValue>;
			if (!pathItem || typeof pathItem !== "object") continue;

			for (const method of OPERATION_KEYS) {
				const operation = pathItem[method] as
					| Record<string, OpenApiValue>
					| undefined;
				if (operation?.operationId) {
					recordOperationId(
						operation.operationId as string,
						`${locationPrefix}${pathKey} ${method.toUpperCase()}`,
					);
				}
			}

			const addOps = pathItem.additionalOperations as
				| Record<string, OpenApiValue>
				| undefined;
			if (addOps) {
				for (const [method, opVal] of Object.entries(addOps)) {
					const operation = opVal as Record<string, OpenApiValue> | undefined;
					if (operation?.operationId) {
						recordOperationId(
							operation.operationId as string,
							`${locationPrefix}${pathKey} ${method}`,
						);
					}
				}
			}
		}
	};

	const collectCallbackPathItems = (
		paths: Record<string, OpenApiValue> | undefined,
		locationPrefix: string,
	): Record<string, OpenApiValue> => {
		const callbacks: Record<string, OpenApiValue> = {};
		if (!paths) return callbacks;

		const visitOperation = (operation: OpenApiValue, opLocation: string) => {
			if (!operation || typeof operation !== "object") return;
			const cbMap = (operation as Record<string, OpenApiValue>).callbacks;
			if (!cbMap || typeof cbMap !== "object") return;

			for (const [callbackName, callbackObj] of Object.entries(
				cbMap as Record<string, OpenApiValue>,
			)) {
				if (!callbackObj || typeof callbackObj !== "object") continue;

				if (isRefLike(callbackObj)) {
					validateReferenceObject(
						callbackObj,
						`${opLocation}.callbacks.${callbackName}`,
					);
					continue;
				}

				for (const [expression, callbackPathItem] of Object.entries(
					callbackObj as Record<string, OpenApiValue>,
				)) {
					if (!callbackPathItem || typeof callbackPathItem !== "object")
						continue;

					validateCallbackExpression(
						expression,
						`${opLocation}.callbacks.${callbackName}.${expression}`,
					);
					validatePathItemOperations(
						callbackPathItem,
						`${opLocation}.callbacks.${callbackName}.${expression}`,
						isOpenApi3,
					);
					callbacks[`${opLocation}.callbacks.${callbackName}.${expression}`] =
						callbackPathItem;
				}
			}
		};

		for (const [pathKey, pVal] of Object.entries(paths)) {
			const pathItem = pVal as Record<string, OpenApiValue>;
			if (!pathItem || typeof pathItem !== "object") continue;

			for (const method of OPERATION_KEYS) {
				const operation = pathItem[method];
				if (operation) {
					visitOperation(operation, `${locationPrefix}${pathKey}.${method}`);
				}
			}

			const addOps = pathItem.additionalOperations as
				| Record<string, OpenApiValue>
				| undefined;
			if (addOps) {
				for (const [method, operation] of Object.entries(addOps)) {
					visitOperation(
						operation,
						`${locationPrefix}${pathKey}.additionalOperations.${method}`,
					);
				}
			}
		}

		return callbacks;
	};

	if (spec.paths) {
		const signatures = new Map<string, string>();

		for (const pathKey of Object.keys(spec.paths)) {
			const pathItemObj = spec.paths[pathKey] as Record<string, OpenApiValue>;
			const pathItemRec = pathItemObj;
			const templateParams = getPathTemplateParams(pathKey);
			const templateParamSet = new Set(templateParams);
			const hasTemplateParams = templateParams.length > 0;

			const hasOperations =
				OPERATION_KEYS.some((method) => pathItemRec[method]) ||
				(pathItemRec.additionalOperations &&
					Object.keys(
						pathItemRec.additionalOperations as Record<string, OpenApiValue>,
					).length > 0);

			const hasPathParams =
				Array.isArray(pathItemObj.parameters) &&
				pathItemObj.parameters.length > 0;
			const isEmptyPathItem = !hasOperations && !hasPathParams;
			const skipPathTemplateValidation = !!pathItemRec.$ref || isEmptyPathItem;

			if (!pathKey.startsWith("/")) {
				throw new SpecValidationError(
					`Path key "${pathKey}" must start with "/".`,
				);
			}

			validateTemplateBraces(pathKey, `paths.${pathKey}`, "Path template");

			if (hasTemplateParams) {
				const duplicates = templateParams.filter(
					(param, index) => templateParams.indexOf(param) !== index,
				);
				if (duplicates.length > 0) {
					throw new SpecValidationError(
						`Path template "${pathKey}" repeats template variable(s): ${[...new Set(duplicates)].join(", ")}`,
					);
				}
			}

			if (isOpenApi3 && pathItemRec.additionalOperations) {
				const additionalOps = pathItemRec.additionalOperations as Record<
					string,
					OpenApiValue
				>;

				for (const methodKey of Object.keys(additionalOps)) {
					if (!HTTP_METHOD_TOKEN.test(methodKey)) {
						throw new SpecValidationError(
							`Path '${pathKey}' defines additionalOperations method "${methodKey}" which is not a valid HTTP method token.`,
						);
					}

					const normalized = methodKey.toLowerCase();
					if (OPERATION_KEYS.includes(normalized)) {
						throw new SpecValidationError(
							`Path '${pathKey}' defines additionalOperations method "${methodKey}" which conflicts with a fixed HTTP method. ` +
								`Use the corresponding fixed field (e.g. "${normalized}") instead.`,
						);
					}
				}

				for (const [methodKey, operation] of Object.entries(additionalOps)) {
					if (operation && typeof operation === "object") {
						const opRec = operation as Record<string, OpenApiValue>;
						if (opRec.responses === undefined) {
							throw new SpecValidationError(
								`Operation Object at 'paths.${pathKey}.additionalOperations.${methodKey}' must define 'responses'.`,
							);
						}
						if (opRec.externalDocs) {
							validateExternalDocsObject(
								opRec.externalDocs,
								`${pathKey}.additionalOperations.${methodKey}.externalDocs`,
							);
						}
						validateUniqueParameters(
							opRec.parameters,
							`${pathKey}.additionalOperations.${methodKey}.parameters`,
						);
					}
				}
			}

			const signature = getPathTemplateSignature(pathKey);
			if (signature.includes("{}")) {
				const existingPath = signatures.get(signature);
				if (existingPath !== undefined) {
					throw new SpecValidationError(
						`Ambiguous path definition detected. OAS 3.2 forbids identical path hierarchies with different parameter names.
` +
							`Path 1: "${existingPath}"
` +
							`Path 2: "${pathKey}"`,
					);
				}
				signatures.set(signature, pathKey);
			}

			const pathParams = (pathItemObj.parameters || []) as Parameter[];
			validateUniqueParameters(pathParams, `${pathKey}.parameters`);

			const validatePathParam = (param: Parameter, location: string) => {
				if (!templateParamSet.has(param.name)) {
					throw new SpecValidationError(
						`Path parameter '${param.name}' in '${location}' does not match the template variable in path '${pathKey}'.`,
					);
				}
				if (param.required !== true) {
					throw new SpecValidationError(
						`Path parameter '${param.name}' in '${location}' must be marked as required: true.`,
					);
				}
			};

			for (const method of OPERATION_KEYS) {
				const operation = pathItemRec[method] as
					| Record<string, OpenApiValue>
					| undefined;

				if (operation) {
					if (isOpenApi3 && operation.responses === undefined) {
						throw new SpecValidationError(
							`Operation Object at 'paths.${pathKey}.${method}' must define 'responses'.`,
						);
					}

					if (operation.externalDocs) {
						validateExternalDocsObject(
							operation.externalDocs,
							`${pathKey}.${method}.externalDocs`,
						);
					}

					const opParams = (operation.parameters || []) as Parameter[];
					validateUniqueParameters(opParams, `${pathKey}.${method}.parameters`);

					const allParams = [...pathParams, ...opParams];

					if (hasTemplateParams && !skipPathTemplateValidation) {
						for (const name of templateParamSet) {
							const hasParam = allParams.some(
								(p) =>
									!!p &&
									typeof p === "object" &&
									(p as OpenApiValue as Record<string, OpenApiValue>).in ===
										"path" &&
									(p as OpenApiValue as Record<string, OpenApiValue>).name ===
										name,
							);
							if (!hasParam) {
								throw new SpecValidationError(
									`Path template '{${name}}' in '${method.toUpperCase()} ${pathKey}' is missing a corresponding 'in: path' parameter definition.`,
								);
							}
						}
					}

					const hasQuery = allParams.some((p) => p.in === "query");
					const hasQuerystring = allParams.some((p) => p.in === "querystring");

					if (hasQuery && hasQuerystring) {
						throw new SpecValidationError(
							`Operation '${method.toUpperCase()} ${pathKey}' contains both 'query' and 'querystring' parameters. These are mutually exclusive.`,
						);
					}

					if (hasQuerystring) {
						const querystringParams = allParams.filter(
							(p) => p.in === "querystring",
						);
						if (querystringParams.length > 1) {
							throw new SpecValidationError(
								`Operation '${method.toUpperCase()} ${pathKey}' defines more than one 'querystring' parameter. Only one is allowed.`,
							);
						}
					}

					for (const [index, param] of allParams.entries()) {
						if (!param || typeof param !== "object") {
							throw new SpecValidationError(
								`Parameter in '${method.toUpperCase()} ${pathKey}' must be an object or Reference Object.`,
							);
						}

						if (isRefLike(param)) {
							validateReferenceObject(
								param,
								`${method.toUpperCase()} ${pathKey}.parameters[${index}]`,
							);
							continue;
						}

						const paramRec = param as OpenApiValue as Record<
							string,
							OpenApiValue
						>;

						if (
							typeof paramRec.name !== "string" ||
							paramRec.name.trim().length === 0
						) {
							throw new SpecValidationError(
								`Parameter in '${method.toUpperCase()} ${pathKey}' must define a non-empty string 'name'.`,
							);
						}

						if (
							typeof paramRec.in !== "string" ||
							paramRec.in.trim().length === 0
						) {
							throw new SpecValidationError(
								`Parameter '${paramRec.name}' in '${method.toUpperCase()} ${pathKey}' must define a non-empty string 'in'.`,
							);
						}

						if (
							param.in === "header" &&
							typeof param.name === "string" &&
							RESERVED_HEADER_NAMES.has(param.name.toLowerCase())
						) {
							continue;
						}

						if (
							!skipPathTemplateValidation &&
							paramRec.in === "path" &&
							paramRec.name
						) {
							validatePathParam(
								param as Parameter,
								`${method.toUpperCase()} ${pathKey}`,
							);
						}

						if (param.example !== undefined && param.examples !== undefined) {
							throw new SpecValidationError(
								`Parameter '${param.name}' in '${method.toUpperCase()} ${pathKey}' contains both 'example' and 'examples'. These fields are mutually exclusive.`,
							);
						}

						if (param.examples && typeof param.examples === "object") {
							Object.entries(
								param.examples as Record<string, OpenApiValue>,
							).forEach(([name, example]) => {
								validateExampleObject(
									example,
									`${method.toUpperCase()} ${pathKey}.parameters.${param.name}.examples.${name}`,
								);
							});
						}

						if (param.schema !== undefined) {
							validateSchemaExternalDocs(
								param.schema,
								`${method.toUpperCase()} ${pathKey}.parameters.${param.name}.schema`,
							);
						}

						if (isOpenApi3) {
							if (param.schema === undefined && param.content === undefined) {
								throw new SpecValidationError(
									`Parameter '${param.name}' in '${method.toUpperCase()} ${pathKey}' must define either 'schema' or 'content'.`,
								);
							}

							if (param.schema !== undefined && param.content !== undefined) {
								throw new SpecValidationError(
									`Parameter '${param.name}' in '${method.toUpperCase()} ${pathKey}' contains both 'schema' and 'content'. These fields are mutually exclusive.`,
								);
							}

							if (param.content) {
								if (Object.keys(param.content).length !== 1) {
									throw new SpecValidationError(
										`Parameter '${param.name}' in '${method.toUpperCase()} ${pathKey}' has an invalid 'content' map. It MUST contain exactly one entry.`,
									);
								}
							}

							if (param.allowEmptyValue) {
								if (param.in !== "query") {
									throw new SpecValidationError(
										`Parameter '${param.name}' in '${method.toUpperCase()} ${pathKey}' defines 'allowEmptyValue' but location is not 'query'.`,
									);
								}
								if (param.style) {
									throw new SpecValidationError(
										`Parameter '${param.name}' in '${method.toUpperCase()} ${pathKey}' defines 'allowEmptyValue' alongside 'style'. This is forbidden.`,
									);
								}
							}
						}

						if (param.in === "querystring") {
							if (
								param.style !== undefined ||
								param.explode !== undefined ||
								param.allowReserved !== undefined
							) {
								throw new SpecValidationError(
									`Parameter '${param.name}' in '${method.toUpperCase()} ${pathKey}' has location 'querystring' but defines style/explode/allowReserved, which are forbidden.`,
								);
							}

							if (param.schema !== undefined) {
								throw new SpecValidationError(
									`Parameter '${param.name}' in '${method.toUpperCase()} ${pathKey}' has location 'querystring' but defines 'schema'. Querystring parameters MUST use 'content' instead.`,
								);
							}
						}

						if (isOpenApi3) {
							validateParameterStyle(
								param as Parameter,
								`${method.toUpperCase()} ${pathKey}.parameters.${param.name}`,
							);
						}

						if (isOpenApi3 && param.content) {
							validateContentMap(
								param.content as Record<string, OpenApiValue>,
								`paths.${pathKey}.${method}.parameters.${param.name}.content`,
							);
						}
					}

					if (isOpenApi3) {
						validateRequestBody(
							operation.requestBody,
							`paths.${pathKey}.${method}.requestBody`,
						);
						validateResponses(
							operation.responses as Record<string, OpenApiValue>,
							`paths.${pathKey}.${method}.responses`,
							isOpenApi3,
						);
					}
				}
			}
		}
	}

	const callbackPaths = {
		...collectCallbackPathItems(
			spec.paths as Record<string, OpenApiValue> | undefined,
			"paths.",
		),
		...collectCallbackPathItems(
			spec.webhooks as Record<string, OpenApiValue> | undefined,
			"webhooks.",
		),
	};

	if (isOpenApi3) {
		validateOperationsContent(
			spec.webhooks as Record<string, OpenApiValue> | undefined,
			"webhooks.",
			isOpenApi3,
		);
		if (Object.keys(callbackPaths).length > 0) {
			validateOperationsContent(callbackPaths, "callbacks.", isOpenApi3);
		}
	}

	collectOperationIds(
		spec.paths as Record<string, OpenApiValue> | undefined,
		"",
	);
	collectOperationIds(
		spec.webhooks as Record<string, OpenApiValue> | undefined,
		"webhooks:",
	);

	if (Object.keys(callbackPaths).length > 0) {
		collectOperationIds(callbackPaths, "callbacks:");
	}

	if (isOpenApi3 && spec.components?.pathItems) {
		collectOperationIds(
			spec.components.pathItems as OpenApiValue as Record<string, OpenApiValue>,
			"components.pathItems:",
		);
	}

	if (isOpenApi3 && spec.components?.webhooks) {
		collectOperationIds(
			spec.components.webhooks as OpenApiValue as Record<string, OpenApiValue>,
			"components.webhooks:",
		);
	}

	if (isOpenApi3 && spec.components?.callbacks) {
		for (const [name, callbackObj] of Object.entries(
			spec.components.callbacks as Record<string, OpenApiValue>,
		)) {
			if (!callbackObj || typeof callbackObj !== "object") continue;
			if (isRefLike(callbackObj)) continue;
			collectOperationIds(
				callbackObj as Record<string, OpenApiValue>,
				`components.callbacks.${name}:`,
			);
		}
	}

	for (const [operationId, locations] of operationIdLocations.entries()) {
		if (locations.length > 1) {
			throw new SpecValidationError(
				`Duplicate operationId "${operationId}" found in multiple operations: ${locations.join(", ")}`,
			);
		}
	}

	return callbackPaths;
}
