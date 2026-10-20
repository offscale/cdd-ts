/**
 * Configuration interfaces for OpenAPI SDK, CLI, and server code generation.
 *
 * @module core/types/config
 */
import type { ModuleKind, ScriptTarget } from "ts-morph";
import type { SwaggerSpec } from "./openapi.js";

/** Supported target UI/client frameworks. */
export type TargetFramework = "angular" | "react" | "vue" | "vanilla";

/** Supported HTTP transport implementations. */
export type TargetImplementation = "angular" | "fetch" | "axios" | "node";

/** Supported server route frameworks. */
export type TargetServerFramework = "express";

/**
 * Injectable logger interface for controlling diagnostic output during code generation and parsing.
 */
export interface GeneratorLogger {
	/**
	 * Logs an informational progress message.
	 * @param message - Message text.
	 */
	info?(message: string): void;
	/**
	 * Logs a warning message.
	 * @param message - Warning message text.
	 * @param args - Optional additional context arguments.
	 */
	warn?(message: string, ...args: unknown[]): void;
	/**
	 * Logs an error message.
	 * @param message - Error message text.
	 * @param args - Optional additional context arguments.
	 */
	error?(message: string, ...args: unknown[]): void;
}

/**
 * Resolves a complete `GeneratorLogger` from an optional `GeneratorConfig`,
 * falling back to standard `console.log`, `console.warn`, and `console.error` when no custom logger is provided.
 *
 * @param config - Optional generator configuration.
 * @returns Resolved logger with guaranteed `info`, `warn`, and `error` methods.
 */
export function resolveLogger(
	config?: GeneratorConfig,
): Required<GeneratorLogger> {
	return {
		info: (message: string) => {
			if (config?.logger?.info) {
				config.logger.info(message);
			} else {
				console.log(message);
			}
		},
		warn: (message: string, ...args: unknown[]) => {
			if (config?.logger?.warn) {
				config.logger.warn(message, ...args);
			} else {
				console.warn(message, ...args);
			}
		},
		error: (message: string, ...args: unknown[]) => {
			if (config?.logger?.error) {
				config.logger.error(message, ...args);
			} else {
				console.error(message, ...args);
			}
		},
	};
}

/** Options that customize the output of the generated code. */
export interface GeneratorConfigOptions {
	/**
	 * The target framework for generation.
	 * - 'angular': Generates Angular services, interceptors, and modules.
	 * - 'react': Generates React SWR hooks and functional components.
	 * - 'vue': Generates Vue composables.
	 * - 'vanilla': Generates vanilla JS / Fetch clients.
	 * @default 'vanilla'
	 */
	framework?: TargetFramework;
	/**
	 * The underlying HTTP implementation to use.
	 * - 'angular': Generates Angular HttpClient based services.
	 * - 'fetch': Generates native fetch API based services.
	 * - 'axios': Generates axios based services.
	 * - 'node': Generates Node.js builtin http/https based services.
	 * @default 'fetch'
	 */
	implementation?: TargetImplementation;
	/** The TypeScript type to use for properties with `format: "date"` or `"date-time"`. */
	dateType?: "string" | "Date";
	/**
	 * The TypeScript type to use for `integer` types with `format: "int64"`.
	 * Default is 'number', but 'string' is often safer for browser JS due to precision limit (2^53).
	 */
	int64Type?: "number" | "string" | "bigint";
	/** How to generate types for schemas with an `enum` list. */
	enumStyle?: "enum" | "union";
	/** If true, generates services for API operations. */
	generateServices?: boolean;
	/** If true, generates a complete admin UI module. */
	admin?: boolean;
	/** If true, generates unit tests for the generated services. Defaults to false. */
	generateServiceTests?: boolean;
	/** If true, generates unit tests for the admin UI. Defaults to false. */
	generateAdminTests?: boolean;
	/** If true, generates composable tests and mocks, useful for e2e and edge case bugs. Defaults to false. */
	composableTests?: boolean;
	/** If true, generates an MCP server wrapper for the generated SDK. */
	mcp?: boolean;
	/** If true, generates tests based on the selected framework or implementation. */
	tests?: boolean;
	/** A record of static headers to be added to every generated service request. */
	customHeaders?: Record<string, string>;
	/**
	 * Target runtime platform for the generated code.
	 * - 'browser': (Default) Assumes standard browser environment. Cookie setting in headers will emit warnings.
	 * - 'node': Assumes Node.js/SSR environment. Cookie setting is allowed without warnings.
	 */
	platform?: "browser" | "node";
	/**
	 * A callback to provide a custom method name for an operation.
	 * @param operationId - The OpenAPI operationId.
	 * @returns The customized method name.
	 */
	customizeMethodName?(operationId: string): string | undefined;
	/**
	 * The ORM implementation to generate entities for or parse entities from.
	 * - 'typeorm': Uses TypeORM decorators and patterns.
	 */
	orm?: "typeorm";
	/**
	 * The server framework to use when generating server routes.
	 * - 'express': Generates Express.js routers and integrations.
	 */
	serverFramework?: TargetServerFramework;
	/** If true, disables generation of GitHub Actions scaffolding. */
	noGithubActions?: boolean;
	/** If true, disables generation of package scaffolding. */
	noInstallablePackage?: boolean;
}

/** Compiler options subset forwarded to ts-morph Project creation. */
export interface GeneratorCompilerOptions {
	/** Whether to emit `.d.ts` declaration files. */
	declaration?: boolean;
	/** Target ECMAScript version for emitted code. */
	target?: ScriptTarget;
	/** Module system kind for emitted code. */
	module?: ModuleKind;
	/** Whether strict type checking is enabled. */
	strict?: boolean;
}

/** The main configuration object for the entire generation process. */
export interface GeneratorConfig {
	/** The local file path or remote URL of the OpenAPI specification. */
	input: string;
	/** The root directory where the generated code will be saved. */
	output: string;
	/** The name of the main service client. */
	clientName?: string;
	/**
	 * An optional callback to validate the input specification before generation.
	 * @param spec - The parsed OpenAPI specification.
	 * @returns `true` if the specification is valid.
	 */
	validateInput?(spec: SwaggerSpec): boolean;
	/** Fine-grained options for customizing the generated code. */
	options: GeneratorConfigOptions;
	/** ts-morph compiler options for the generated project. */
	compilerOptions?: GeneratorCompilerOptions;
	/** Optional injectable logger for diagnostic output. */
	logger?: GeneratorLogger;
}
