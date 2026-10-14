/**
 * Shared header comments and OpenAPI/JSON Schema dialect URI constants.
 *
 * @module core/constants
 */
const HEADER = ``;

/** Header comment prepended to generated model/type files. */
export const TYPE_GENERATOR_HEADER_COMMENT = HEADER;

/** Header comment prepended to generated service files. */
export const SERVICE_GENERATOR_HEADER_COMMENT = HEADER;

/** Header comment prepended to generated service barrel (`index.ts`) files. */
export const SERVICE_INDEX_GENERATOR_HEADER_COMMENT = HEADER;

/** Header comment prepended to the root generated barrel (`index.ts`) file. */
export const MAIN_INDEX_GENERATOR_HEADER_COMMENT = HEADER;

/** Header comment prepended to generated Angular provider files. */
export const PROVIDER_GENERATOR_HEADER_COMMENT = HEADER;

/** Header comment prepended to generated utility and OpenAPI metadata files. */
export const UTILITY_GENERATOR_HEADER_COMMENT = HEADER;

/** Canonical OpenAPI 3.1 base JSON Schema dialect URI. */
export const OAS_3_1_DIALECT = "https://spec.openapis.org/oas/3.1/dialect/base";

/** Canonical JSON Schema Draft 2020-12 meta-schema URI. */
export const JSON_SCHEMA_2020_12_DIALECT =
	"https://json-schema.org/draft/2020-12/schema";
