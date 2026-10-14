/**
 * Runtime type guards for OpenAPI 2.0 / 3.0 / 3.1 / 3.2 specification objects.
 *
 * @module openapi/type_guards
 */
import type {
	DynamicReferenceObject,
	OpenApiValue,
	Parameter,
	ReferenceObject,
	SwaggerDefinition,
} from "../core/types/openapi.js";

/**
 * Checks whether an unknown value is a non-null plain object record of OpenApiValues.
 *
 * @param value - The value to inspect.
 * @returns `true` if `value` is a non-null, non-array object.
 */
export function isOpenApiObject(
	value: unknown,
): value is Record<string, OpenApiValue> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks whether an unknown value is an OpenAPI ReferenceObject (`{ $ref: string }`).
 *
 * @param value - The value to inspect.
 * @returns `true` if `value` is an object with a string `$ref` property.
 */
export function isReferenceObject(value: unknown): value is ReferenceObject {
	return (
		isOpenApiObject(value) &&
		typeof value.$ref === "string" &&
		value.$ref.length > 0
	);
}

/**
 * Checks whether an unknown value is a JSON Schema 2020-12 DynamicReferenceObject (`{ $dynamicRef: string }`).
 *
 * @param value - The value to inspect.
 * @returns `true` if `value` is an object with a string `$dynamicRef` property.
 */
export function isDynamicReferenceObject(
	value: unknown,
): value is DynamicReferenceObject {
	return (
		isOpenApiObject(value) &&
		typeof value.$dynamicRef === "string" &&
		value.$dynamicRef.length > 0
	);
}

/**
 * Checks whether an unknown value is a `SwaggerDefinition` schema object (as opposed to a boolean schema or primitive).
 *
 * @param value - The value to inspect.
 * @returns `true` if `value` is a non-null, non-array object suitable as a `SwaggerDefinition`.
 */
export function isSwaggerDefinition(
	value: unknown,
): value is SwaggerDefinition {
	return isOpenApiObject(value);
}

/**
 * Checks whether an unknown value is an OpenAPI `Parameter` object with valid `name` and `in` fields.
 *
 * @param value - The value to inspect.
 * @returns `true` if `value` is an object with string `name` and valid `in` location.
 */
export function isParameterObject(value: unknown): value is Parameter {
	if (!isOpenApiObject(value)) {
		return false;
	}
	if (typeof value.name !== "string" || value.name.length === 0) {
		return false;
	}
	const validLocations = new Set([
		"query",
		"path",
		"header",
		"cookie",
		"formData",
		"querystring",
	]);
	return typeof value.in === "string" && validLocations.has(value.in);
}
