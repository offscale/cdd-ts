/**
 * Aggregate barrel re-exporting model/service/spec parsing, naming, string, and sanitization utilities.
 *
 * @module functions/utils
 */

/** Re-exports `ReverseModelFileSystem` from `../classes/parse.js`. */
/** Re-exports `ReverseSchemaMap` from `../classes/parse.js`. */
export type {
	ReverseModelFileSystem,
	ReverseSchemaMap,
} from "../classes/parse.js";
/** Re-exports `parseGeneratedModels` from `../classes/parse.js`. */
/** Re-exports `parseGeneratedModelSource` from `../classes/parse.js`. */
/** Re-exports `schemaFromTypeNode` from `../classes/parse.js`. */
export {
	parseGeneratedModelSource,
	parseGeneratedModels,
	schemaFromTypeNode,
} from "../classes/parse.js";
/** Re-exports `getRequestBodyType` from `../classes/parse_type_converter.js`. */
/** Re-exports `getResponseType` from `../classes/parse_type_converter.js`. */
/** Re-exports `getTypeScriptType` from `../classes/parse_type_converter.js`. */
/** Re-exports `isDataTypeInterface` from `../classes/parse_type_converter.js`. */
export {
	getRequestBodyType,
	getResponseType,
	getTypeScriptType,
	isDataTypeInterface,
} from "../classes/parse_type_converter.js";
/** Re-exports `ReverseCallbackMeta` from `../openapi/emit.js`. */
/** Re-exports `ReverseMetadata` from `../openapi/emit.js`. */
/** Re-exports `ReverseMultipartConfig` from `../openapi/emit.js`. */
/** Re-exports `ReverseOperation` from `../openapi/emit.js`. */
/** Re-exports `ReverseParam` from `../openapi/emit.js`. */
/** Re-exports `ReverseParamLocation` from `../openapi/emit.js`. */
/** Re-exports `ReverseRequestEncoding` from `../openapi/emit.js`. */
/** Re-exports `ReverseResponseHint` from `../openapi/emit.js`. */
/** Re-exports `ReverseService` from `../openapi/emit.js`. */
/** Re-exports `ReverseWebhookMeta` from `../openapi/emit.js`. */
export type {
	ReverseCallbackMeta,
	ReverseMetadata,
	ReverseMultipartConfig,
	ReverseOperation,
	ReverseParam,
	ReverseParamLocation,
	ReverseRequestEncoding,
	ReverseResponseHint,
	ReverseService,
	ReverseWebhookMeta,
} from "../openapi/emit.js";
/** Re-exports `applyReverseMetadata` from `../openapi/emit.js`. */
/** Re-exports `buildOpenApiSpecFromServices` from `../openapi/emit.js`. */
/** Re-exports `parseGeneratedMetadata` from `../openapi/emit.js`. */
/** Re-exports `parseGeneratedServices` from `../openapi/emit.js`. */
/** Re-exports `parseGeneratedServiceSource` from `../openapi/emit.js`. */
export {
	applyReverseMetadata,
	buildOpenApiSpecFromServices,
	parseGeneratedMetadata,
	parseGeneratedServiceSource,
	parseGeneratedServices,
} from "../openapi/emit.js";
/** Re-exports `SnapshotFileSystem` from `../openapi/parse_snapshot.js`. */
/** Re-exports `SnapshotFormat` from `../openapi/parse_snapshot.js`. */
/** Re-exports `SnapshotReadResult` from `../openapi/parse_snapshot.js`. */
export type {
	SnapshotFileSystem,
	SnapshotFormat,
	SnapshotReadResult,
} from "../openapi/parse_snapshot.js";
/** Re-exports `readOpenApiSnapshot` from `../openapi/parse_snapshot.js`. */
/** Re-exports `SNAPSHOT_FILENAMES` from `../openapi/parse_snapshot.js`. */
/** Re-exports `writeOpenApiSnapshot` from `../openapi/parse_snapshot.js`. */
export {
	readOpenApiSnapshot,
	SNAPSHOT_FILENAMES,
	writeOpenApiSnapshot,
} from "../openapi/parse_snapshot.js";
/** Re-exports `extractPaths` from `../openapi/parse_spec_extractor.js`. */
/** Re-exports `groupPathsByController` from `../openapi/parse_spec_extractor.js`. */
export {
	extractPaths,
	groupPathsByController,
} from "../openapi/parse_spec_extractor.js";
/** Re-exports `AngularBestPracticeRuleId` from `./parse.js`. */
/** Re-exports `AngularBestPracticesAuditResult` from `./parse.js`. */
/** Re-exports `AngularBestPracticeViolation` from `./parse.js`. */
/** Re-exports `AngularHttpCallMatch` from `./parse.js`. */
/** Re-exports `AngularServiceMetadata` from `./parse.js`. */
/** Re-exports `CodeScanFileSystem` from `./parse.js`. */
/** Re-exports `CodeScanIr` from `./parse.js`. */
/** Re-exports `CodeScanOperation` from `./parse.js`. */
/** Re-exports `CodeScanOptions` from `./parse.js`. */
/** Re-exports `CodeScanParam` from `./parse.js`. */
/** Re-exports `CodeScanParamLocation` from `./parse.js`. */
/** Re-exports `CodeScanRequestBody` from `./parse.js`. */
/** Re-exports `CodeScanResponse` from `./parse.js`. */
export type {
	AngularBestPracticeRuleId,
	AngularBestPracticesAuditResult,
	AngularBestPracticeViolation,
	AngularHttpCallMatch,
	AngularServiceMetadata,
	CodeScanFileSystem,
	CodeScanIr,
	CodeScanOperation,
	CodeScanOptions,
	CodeScanParam,
	CodeScanParamLocation,
	CodeScanRequestBody,
	CodeScanResponse,
} from "./parse.js";
/** Re-exports `auditAngularSourceBestPractices` from `./parse.js`. */
/** Re-exports `buildOpenApiSpecFromScan` from `./parse.js`. */
/** Re-exports `extractAngularHttpCall` from `./parse.js`. */
/** Re-exports `extractAngularServiceMetadata` from `./parse.js`. */
/** Re-exports `scanTypeScriptProject` from `./parse.js`. */
/** Re-exports `scanTypeScriptSource` from `./parse.js`. */
export {
	auditAngularSourceBestPractices,
	buildOpenApiSpecFromScan,
	extractAngularHttpCall,
	extractAngularServiceMetadata,
	scanTypeScriptProject,
	scanTypeScriptSource,
} from "./parse.js";
/** Re-exports `getBasePathTokenName` from `./utils_naming.js`. */
/** Re-exports `getClientContextTokenName` from `./utils_naming.js`. */
/** Re-exports `getInterceptorsTokenName` from `./utils_naming.js`. */
/** Re-exports `getServerVariablesTokenName` from `./utils_naming.js`. */
/** Re-exports `hasDuplicateFunctionNames` from `./utils_naming.js`. */
/** Re-exports `normalizeSecurityKey` from `./utils_naming.js`. */
export {
	getBasePathTokenName,
	getClientContextTokenName,
	getInterceptorsTokenName,
	getServerVariablesTokenName,
	hasDuplicateFunctionNames,
	normalizeSecurityKey,
} from "./utils_naming.js";
/** Re-exports `sanitizeComment` from `./utils_sanitizer.js`. */
export { sanitizeComment } from "./utils_sanitizer.js";
/** Re-exports `camelCase` from `./utils_string.js`. */
/** Re-exports `isUriReference` from `./utils_string.js`. */
/** Re-exports `isUrl` from `./utils_string.js`. */
/** Re-exports `kebabCase` from `./utils_string.js`. */
/** Re-exports `pascalCase` from `./utils_string.js`. */
/** Re-exports `singular` from `./utils_string.js`. */
/** Re-exports `snakeCase` from `./utils_string.js`. */
export {
	camelCase,
	isUriReference,
	isUrl,
	kebabCase,
	pascalCase,
	singular,
	snakeCase,
} from "./utils_string.js";
