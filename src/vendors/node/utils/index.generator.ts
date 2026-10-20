/**
 * Module for index generator in vendors/node/utils/index.generator.
 *
 * @module vendors/node/utils/index.generator
 */

/** Re-exports `NodeMainIndexGenerator` from `../../../openapi/emit_main_index.js`. */
/** Re-exports `NodeServiceIndexGenerator` from `../../../openapi/emit_main_index.js`. */
export {
	SdkMainIndexGenerator as NodeMainIndexGenerator,
	SdkServiceIndexGenerator as NodeServiceIndexGenerator,
} from "../../../openapi/emit_main_index.js";
