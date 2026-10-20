/**
 * Module for index generator in vendors/fetch/utils/index.generator.
 *
 * @module vendors/fetch/utils/index.generator
 */

/** Re-exports `FetchMainIndexGenerator` from `../../../openapi/emit_main_index.js`. */
/** Re-exports `FetchServiceIndexGenerator` from `../../../openapi/emit_main_index.js`. */
export {
	SdkMainIndexGenerator as FetchMainIndexGenerator,
	SdkServiceIndexGenerator as FetchServiceIndexGenerator,
} from "../../../openapi/emit_main_index.js";
