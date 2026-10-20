/**
 * OpenAPI Parameter Object, Header Object, style matrix, and `schema`/`content` mutual exclusion validation.
 *
 * @module openapi/validators/validate_parameters_headers
 */
import type { OpenApiValue, Parameter } from "../../core/types/index.js";
import { SpecValidationError } from "./validate_info.js";
import {
	validateContentMap,
	validateExampleObject,
} from "./validate_responses_links.js";
import {
	getSchemaTypeKind,
	isRefLike,
	validateReferenceObject,
	validateSchemaExternalDocs,
} from "./validate_schemas.js";

/**
 * Allowed parameter serialization `style` values indexed by parameter `in` location.
 */
export const PARAM_STYLE_BY_IN: Record<string, Set<string>> = {
	path: new Set(["matrix", "label", "simple"]),
	query: new Set(["form", "spaceDelimited", "pipeDelimited", "deepObject"]),
	header: new Set(["simple"]),
	cookie: new Set(["form", "cookie"]),
	querystring: new Set([]),
};

/**
 * Reserved HTTP header names that are ignored when declared as `in: "header"` parameters.
 */
export const RESERVED_HEADER_NAMES: Set<string> = new Set([
	"accept",
	"content-type",
	"authorization",
]);

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
	headers: Record<string, OpenApiValue>,
	location: string,
	isOpenApi3: boolean,
): void {
	for (const [headerName, headerObj] of Object.entries(headers)) {
		if (headerName.toLowerCase() === "content-type") continue;
		validateHeaderObject(headerObj, `${location}.${headerName}`, isOpenApi3);
	}
}

/**
 * Validates `components.parameters` definitions in OpenAPI 3.x documents.
 *
 * @param parameters - Map of component parameter definitions.
 * @throws {SpecValidationError} When any component parameter is invalid.
 */
export function validateComponentParameters(
	parameters: Record<string, OpenApiValue>,
): void {
	for (const [name, paramObj] of Object.entries(parameters)) {
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
		}

		validateParameterStyle(param as Parameter, `components.parameters.${name}`);

		if (param.content) {
			validateContentMap(
				param.content as Record<string, OpenApiValue>,
				`components.parameters.${name}.content`,
			);
		}
	}
}
