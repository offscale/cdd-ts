/**
 * Unified error hierarchy and discriminated error codes for `cdd-ts`.
 *
 * @module core/errors
 */

/**
 * Discriminated error codes for structured `CddError` subclasses.
 */
export enum CddErrorCode {
	/** OpenAPI / Swagger 2.0 specification validation failure. */
	SPEC_VALIDATION_ERROR = "SPEC_VALIDATION_ERROR",
	/** Arazzo 1.1.0 workflow specification validation failure. */
	ARAZZO_VALIDATION_ERROR = "ARAZZO_VALIDATION_ERROR",
	/** JSON Pointer or external URI `$ref` resolution failure. */
	REFERENCE_RESOLUTION_ERROR = "REFERENCE_RESOLUTION_ERROR",
	/** Reverse AST parsing failure when extracting OpenAPI or Arazzo from TypeScript. */
	AST_REVERSE_PARSE_ERROR = "AST_REVERSE_PARSE_ERROR",
	/** Invalid generator configuration or unsupported target option. */
	GENERATOR_CONFIGURATION_ERROR = "GENERATOR_CONFIGURATION_ERROR",
}

/**
 * Base error class for all domain errors thrown by `cdd-ts`.
 */
export class CddError extends Error {
	/** Discriminated error code identifying the error category. */
	public readonly code: CddErrorCode;

	/**
	 * Creates a new `CddError`.
	 *
	 * @param code - Discriminated `CddErrorCode`.
	 * @param message - Human-readable error message.
	 */
	public constructor(code: CddErrorCode, message: string) {
		super(message);
		this.name = "CddError";
		this.code = code;
	}
}

/**
 * Error thrown when an OpenAPI or Swagger specification fails structural or semantic validation.
 */
export class SpecValidationError extends CddError {
	/** Optional JSON Pointer or property path where validation failed. */
	public readonly path?: string;
	/** Optional structured validation context details. */
	public readonly details?: Record<string, unknown>;

	/**
	 * Creates a new `SpecValidationError`.
	 *
	 * @param message - Human-readable validation failure description.
	 * @param path - Optional location path in the OpenAPI document.
	 * @param details - Optional structured details.
	 */
	public constructor(
		message: string,
		path?: string,
		details?: Record<string, unknown>,
	) {
		super(CddErrorCode.SPEC_VALIDATION_ERROR, message);
		this.name = "SpecValidationError";
		if (path !== undefined) {
			this.path = path;
		}
		if (details !== undefined) {
			this.details = details;
		}
	}
}

/**
 * Error thrown when an Arazzo document fails structural or semantic validation.
 */
export class ArazzoValidationError extends CddError {
	/** JSON Pointer or property path where validation failed. */
	public readonly path: string;

	/**
	 * Creates a new `ArazzoValidationError`.
	 *
	 * @param message - Human-readable validation failure description.
	 * @param path - Location path in the Arazzo document where the violation occurred.
	 */
	public constructor(message: string, path?: string) {
		const resolvedPath = path ?? "#";
		super(
			CddErrorCode.ARAZZO_VALIDATION_ERROR,
			`${message} (at ${resolvedPath})`,
		);
		this.name = "ArazzoValidationError";
		this.path = resolvedPath;
	}
}

/**
 * Error thrown when a `$ref` or `$dynamicRef` cannot be resolved against the specification cache.
 */
export class ReferenceResolutionError extends CddError {
	/** The unresolved `$ref` string. */
	public readonly ref: string;
	/** Optional base document URI from which resolution was attempted. */
	public readonly documentUri?: string;

	/**
	 * Creates a new `ReferenceResolutionError`.
	 *
	 * @param message - Human-readable error message.
	 * @param ref - The unresolved `$ref` URI or JSON Pointer.
	 * @param documentUri - Optional base document URI.
	 */
	public constructor(message: string, ref: string, documentUri?: string) {
		super(CddErrorCode.REFERENCE_RESOLUTION_ERROR, message);
		this.name = "ReferenceResolutionError";
		this.ref = ref;
		if (documentUri !== undefined) {
			this.documentUri = documentUri;
		}
	}
}

/**
 * Error thrown when reverse-parsing TypeScript AST nodes into OpenAPI or Arazzo fails.
 */
export class AstReverseParseError extends CddError {
	/** Source file path where the AST error occurred. */
	public readonly filePath: string;
	/** Optional `ts-morph` syntax kind name of the offending AST node. */
	public readonly nodeKind?: string;

	/**
	 * Creates a new `AstReverseParseError`.
	 *
	 * @param message - Human-readable error message.
	 * @param filePath - Source file path being parsed.
	 * @param nodeKind - Optional AST node kind name.
	 */
	public constructor(message: string, filePath: string, nodeKind?: string) {
		super(CddErrorCode.AST_REVERSE_PARSE_ERROR, message);
		this.name = "AstReverseParseError";
		this.filePath = filePath;
		if (nodeKind !== undefined) {
			this.nodeKind = nodeKind;
		}
	}
}

/**
 * Error thrown when generator configuration options are invalid or incompatible.
 */
export class GeneratorConfigurationError extends CddError {
	/**
	 * Creates a new `GeneratorConfigurationError`.
	 *
	 * @param message - Human-readable configuration error description.
	 */
	public constructor(message: string) {
		super(CddErrorCode.GENERATOR_CONFIGURATION_ERROR, message);
		this.name = "GeneratorConfigurationError";
	}
}
