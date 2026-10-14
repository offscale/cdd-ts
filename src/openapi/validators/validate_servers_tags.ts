/**
 * Validates OpenAPI Server Objects, Server Variables, Tags, ExternalDocs, and Server overrides across paths/webhooks/callbacks.
 *
 * @module openapi/validators/validate_servers_tags
 */
import type {
	OpenApiValue,
	ServerObject,
	SwaggerSpec,
	TagObject,
} from "../../core/types/index.js";
import {
	SpecValidationError,
	validateExternalDocsObject,
	validateTemplateBraces,
} from "./validate_info.js";

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

function countOccurrences(haystack: string, needle: string): number {
	if (!needle) return 0;
	return haystack.split(needle).length - 1;
}

function getServerTemplateVariables(url: string): string[] {
	const vars = new Set<string>();
	const regex = /\{([^}]+)\}/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(url)) !== null) {
		if (match[1]) vars.add(match[1]);
	}
	return Array.from(vars);
}

/**
 * Validates an array of OpenAPI `ServerObject` entries and their template variables.
 *
 * @param servers - Server objects array to validate.
 * @param location - Diagnostic location path.
 * @throws {SpecValidationError} When any server URL, name, or variable constraint is violated.
 */
export function validateServers(
	servers: ServerObject[] | undefined,
	location: string,
): void {
	if (!servers || servers.length === 0) return;

	const seenNames = new Set<string>();

	servers.forEach((server, index) => {
		const url = server.url;
		if (typeof url !== "string" || url.length === 0) {
			throw new SpecValidationError(
				`Server url must be a non-empty string at ${location}[${index}].`,
			);
		}

		validateTemplateBraces(url, `${location}[${index}].url`, "Server url");

		if (url.includes("?") || url.includes("#")) {
			throw new SpecValidationError(
				`Server url MUST NOT include query or fragment at ${location}[${index}]. Value: "${url}"`,
			);
		}

		if (server.name) {
			if (seenNames.has(server.name)) {
				throw new SpecValidationError(
					`Server name "${server.name}" must be unique at ${location}. Duplicate found.`,
				);
			}
			seenNames.add(server.name);
		}

		const templateVars = getServerTemplateVariables(url);
		if (templateVars.length > 0 && !server.variables) {
			throw new SpecValidationError(
				`Server url defines template variables but 'variables' is missing at ${location}[${index}].`,
			);
		}

		templateVars.forEach((varName) => {
			if (!server.variables?.[varName]) {
				throw new SpecValidationError(
					`Server url variable "${varName}" is not defined in variables at ${location}[${index}].`,
				);
			}
		});

		if (server.variables) {
			Object.entries(server.variables).forEach(([varName, variable]) => {
				if (typeof variable.default !== "string") {
					throw new SpecValidationError(
						`Server variable "${varName}" must define a string default at ${location}[${index}].`,
					);
				}

				if (variable.enum && variable.enum.length === 0) {
					throw new SpecValidationError(
						`Server variable "${varName}" enum MUST NOT be empty at ${location}[${index}].`,
					);
				}

				if (
					variable.enum &&
					!variable.enum.every((v: OpenApiValue) => typeof v === "string")
				) {
					throw new SpecValidationError(
						`Server variable "${varName}" enum MUST contain only strings at ${location}[${index}].`,
					);
				}

				if (variable.enum && !variable.enum.includes(variable.default)) {
					throw new SpecValidationError(
						`Server variable "${varName}" default MUST be present in enum at ${location}[${index}].`,
					);
				}

				const token = `{${varName}}`;
				const occurrences = countOccurrences(url, token);

				if (occurrences > 1) {
					throw new SpecValidationError(
						`Server variable "${varName}" appears more than once in url at ${location}[${index}].`,
					);
				}
			});
		}
	});
}

/**
 * Validates `servers` arrays across root, paths, webhooks, and callbacks in an OpenAPI 3.x document.
 *
 * @param spec - Root OpenAPI specification.
 * @param callbackPaths - Collected callback path items keyed by location.
 * @throws {SpecValidationError} When any server definition is invalid.
 */
export function validateAllServerLocations(
	spec: SwaggerSpec,
	callbackPaths: Record<string, OpenApiValue>,
): void {
	validateServers(spec.servers, "servers");

	const validateServerLocations = (
		paths: Record<string, OpenApiValue> | undefined,
		locationPrefix: string,
	) => {
		if (!paths) return;

		for (const [pathKey, pVal] of Object.entries(paths)) {
			const pathItem = pVal as Record<string, OpenApiValue>;
			if (!pathItem || typeof pathItem !== "object") continue;

			if (pathItem.servers) {
				validateServers(
					pathItem.servers as ServerObject[],
					`${locationPrefix}${pathKey}.servers`,
				);
			}

			for (const method of OPERATION_KEYS) {
				const operation = pathItem[method] as
					| Record<string, OpenApiValue>
					| undefined;
				if (operation?.servers) {
					validateServers(
						operation.servers as ServerObject[],
						`${locationPrefix}${pathKey}.${method}.servers`,
					);
				}
			}

			const addOps = pathItem.additionalOperations as
				| Record<string, OpenApiValue>
				| undefined;
			if (addOps) {
				for (const [method, opVal] of Object.entries(addOps)) {
					const operation = opVal as Record<string, OpenApiValue> | undefined;
					if (operation?.servers) {
						validateServers(
							operation.servers as ServerObject[],
							`${locationPrefix}${pathKey}.additionalOperations.${method}.servers`,
						);
					}
				}
			}
		}
	};

	validateServerLocations(
		spec.paths as Record<string, OpenApiValue> | undefined,
		"paths.",
	);
	validateServerLocations(
		spec.webhooks as Record<string, OpenApiValue> | undefined,
		"webhooks.",
	);
	if (Object.keys(callbackPaths).length > 0) {
		validateServerLocations(callbackPaths, "callbacks.");
	}
}

/**
 * Validates root `tags` array for uniqueness, valid `externalDocs`, existing `parent` references, and absence of parent cycles.
 *
 * @param tags - Array of `TagObject` definitions from `spec.tags`.
 * @throws {SpecValidationError} When duplicate tag names, missing parents, or circular tag hierarchies are found.
 */
export function validateTags(tags: TagObject[] | undefined): void {
	if (!tags || tags.length === 0) return;

	const tagNames = new Set<string>();
	const duplicates = new Set<string>();
	const parentMap = new Map<string, string>();

	tags.forEach((tag: TagObject) => {
		if (typeof tag.name === "string") {
			if (tagNames.has(tag.name)) {
				duplicates.add(tag.name);
			} else {
				tagNames.add(tag.name);
			}
		}
	});

	if (duplicates.size > 0) {
		throw new SpecValidationError(
			`Duplicate tag name(s) detected: ${Array.from(duplicates).join(", ")}`,
		);
	}

	tags.forEach((tag: TagObject) => {
		if (tag.externalDocs) {
			validateExternalDocsObject(
				tag.externalDocs,
				`tags.${tag.name}.externalDocs`,
			);
		}
		if (tag.parent) {
			if (!tagNames.has(tag.parent)) {
				throw new SpecValidationError(
					`Tag "${tag.name}" has parent "${tag.parent}" which does not exist in tags array.`,
				);
			}
			parentMap.set(tag.name, tag.parent);
		}
	});

	for (const tag of tags) {
		const seen = new Set<string>();
		let current: string | undefined = tag.name;
		while (current && parentMap.has(current)) {
			if (seen.has(current)) {
				throw new SpecValidationError(
					`Circular tag parent reference detected at "${current}".`,
				);
			}
			seen.add(current);
			current = parentMap.get(current);
		}
	}
}
