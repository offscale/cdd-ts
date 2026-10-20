/**
 * Facade orchestrating OpenAPI 3.0, 3.1, 3.2, and Swagger 2.0 specification validation across modular sub-validators.
 *
 * @module openapi/parse_validator
 */
import type { SwaggerSpec } from "../core/types/index.js";
import { validateComponentsAndDefinitions } from "./validators/validate_components.js";
import {
	SpecValidationError,
	validateInfoAndRootMeta,
	validateJsonSchemaDialect,
} from "./validators/validate_info.js";
import { validatePathsWebhooksAndOperationIds } from "./validators/validate_paths.js";
import {
	validateAllServerLocations,
	validateTags,
} from "./validators/validate_servers_tags.js";

/** Re-exports `SpecValidationError` from `./validators/validate_info.js`. */
export { SpecValidationError } from "./validators/validate_info.js";

/**
 * Validates that a parsed object conforms to the structural and semantic rules of a Swagger 2.0 or OpenAPI 3.x specification.
 *
 * @param spec - The parsed specification object.
 * @throws {SpecValidationError} When the specification violates OpenAPI or Swagger constraints.
 */
export function validateSpec(spec: unknown): asserts spec is SwaggerSpec {
	const candidate = spec as SwaggerSpec;
	const { isOpenApi3 } = validateInfoAndRootMeta(candidate);

	const callbackPaths = validatePathsWebhooksAndOperationIds(
		candidate,
		isOpenApi3,
	);

	if (isOpenApi3) {
		validateAllServerLocations(candidate, callbackPaths);
	}

	validateComponentsAndDefinitions(candidate, isOpenApi3);

	const hasPaths = candidate.paths !== undefined && candidate.paths !== null;
	const hasComponents = !!candidate.components;
	const hasWebhooks = !!candidate.webhooks;

	if (isOpenApi3) {
		if (!hasPaths && !hasComponents && !hasWebhooks) {
			throw new SpecValidationError(
				"OpenAPI 3.x specification must contain at least one of: 'paths', 'components', or 'webhooks'.",
			);
		}
		validateTags(candidate.tags);
		validateJsonSchemaDialect(candidate);
	} else {
		if (!hasPaths) {
			throw new SpecValidationError(
				"Swagger 2.0 specification must contain a 'paths' object.",
			);
		}
	}
}
