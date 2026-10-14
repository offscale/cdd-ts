/**
 * Clean orchestrator facade for reverse-parsing generated TypeScript SDK services and metadata into an OpenAPI/Swagger specification.
 *
 * @module openapi/emit
 */
import type { SwaggerSpec } from "../core/types/index.js";
import {
	applyComponentsAndMetadata,
	type ReverseMetadata,
} from "./emitters/assemble_components.js";
import { downgradeOpenApiToSwagger2 } from "./emitters/downgrade_openapi.js";

/** Re-exports `ReverseCallbackMeta` from `./emitters/assemble_components.js`. */
/** Re-exports `ReverseDocumentMeta` from `./emitters/assemble_components.js`. */
/** Re-exports `ReverseMetadata` from `./emitters/assemble_components.js`. */
/** Re-exports `ReverseMetadataFileStat` from `./emitters/assemble_components.js`. */
/** Re-exports `ReverseMetadataFileSystem` from `./emitters/assemble_components.js`. */
/** Re-exports `ReverseWebhookMeta` from `./emitters/assemble_components.js`. */
export type {
	ReverseCallbackMeta,
	ReverseDocumentMeta,
	ReverseMetadata,
	ReverseMetadataFileStat,
	ReverseMetadataFileSystem,
	ReverseWebhookMeta,
} from "./emitters/assemble_components.js";
/** Re-exports `applyComponentsAndMetadata` from `./emitters/assemble_components.js`. */
/** Re-exports `parseGeneratedMetadata` from `./emitters/assemble_components.js`. */
export {
	applyComponentsAndMetadata,
	parseGeneratedMetadata,
} from "./emitters/assemble_components.js";
/** Re-exports `ReverseMultipartConfig` from `./emitters/assemble_paths.js`. */
/** Re-exports `ReverseOperation` from `./emitters/assemble_paths.js`. */
/** Re-exports `ReverseParam` from `./emitters/assemble_paths.js`. */
/** Re-exports `ReverseParamLocation` from `./emitters/assemble_paths.js`. */
/** Re-exports `ReverseRequestEncoding` from `./emitters/assemble_paths.js`. */
/** Re-exports `ReverseResponseHint` from `./emitters/assemble_paths.js`. */
/** Re-exports `ReverseService` from `./emitters/assemble_paths.js`. */
/** Re-exports `ReverseServiceFileStat` from `./emitters/assemble_paths.js`. */
/** Re-exports `ReverseServiceFileSystem` from `./emitters/assemble_paths.js`. */
export type {
	ReverseMultipartConfig,
	ReverseOperation,
	ReverseParam,
	ReverseParamLocation,
	ReverseRequestEncoding,
	ReverseResponseHint,
	ReverseService,
	ReverseServiceFileStat,
	ReverseServiceFileSystem,
} from "./emitters/assemble_paths.js";
/** Re-exports `buildOpenApiSpecFromServices` from `./emitters/assemble_paths.js`. */
/** Re-exports `parseGeneratedServices` from `./emitters/assemble_paths.js`. */
/** Re-exports `parseGeneratedServiceSource` from `./emitters/assemble_paths.js`. */
export {
	buildOpenApiSpecFromServices,
	parseGeneratedServiceSource,
	parseGeneratedServices,
} from "./emitters/assemble_paths.js";
/** Re-exports `downgradeOpenApiToSwagger2` from `./emitters/downgrade_openapi.js`. */
export { downgradeOpenApiToSwagger2 } from "./emitters/downgrade_openapi.js";

/**
 * Merges parsed `ReverseMetadata` into a reconstructed `SwaggerSpec` and normalizes version-specific structures.
 *
 * @param spec - Base `SwaggerSpec` object.
 * @param metadata - Extracted `ReverseMetadata` to apply.
 * @returns Enriched `SwaggerSpec` with metadata, components, webhooks, and version adjustments applied.
 */
export function applyReverseMetadata(
	spec: SwaggerSpec,
	metadata: ReverseMetadata,
): SwaggerSpec {
	const out = applyComponentsAndMetadata(spec, metadata);
	return downgradeOpenApiToSwagger2(out);
}
