/**
 * Public programmatic entrypoint for `cdd-ts` OpenAPI SDK, CLI, and server code generation and reverse parsing.
 *
 * @module index
 */
import * as path from "node:path";
import { ModuleKind, Project, ScriptTarget } from "ts-morph";
import { TypeGenerator } from "./classes/emit.js";
import type { IClientGenerator } from "./core/generator.js";
import type { IOrmGenerator } from "./core/orm/index.js";
import type { IServerFrameworkGenerator } from "./core/server/index.js";
import type { GeneratorConfig, SwaggerSpec } from "./core/types/index.js";
import { createJavyFsPolyfill } from "./core/wasm-fs.js";
import { isUrl } from "./functions/utils.js";
import { SwaggerParser } from "./openapi/parse.js";
import { AngularClientGenerator } from "./vendors/angular/angular-client.generator.js";
import { AxiosClientGenerator } from "./vendors/axios/axios-client.generator.js";
import { CliGenerator } from "./vendors/cli/emit.js";
import { ExpressServerGenerator } from "./vendors/express/express-server.generator.js";
import { FetchClientGenerator } from "./vendors/fetch/fetch-client.generator.js";
import { McpGenerator } from "./vendors/mcp/emit.js";
import { NodeClientGenerator } from "./vendors/node/node-client.generator.js";
import { ReactClientGenerator } from "./vendors/react/react-client.generator.js";
import { TypeOrmGenerator } from "./vendors/typeorm/emit.js";
import { VueClientGenerator } from "./vendors/vue/vue-client.generator.js";

/**
 * For test environments, allows passing a pre-parsed OpenAPI specification object.
 */
export type TestGeneratorConfig = {
	/** The pre-parsed OpenAPI specification object. */
	spec: SwaggerSpec | Record<string, unknown> | object;
};

/**
 * Resolves a transport-level `IClientGenerator` for `"fetch"`, `"axios"`, or `"node"`.
 *
 * @param implementation - The requested transport implementation.
 * @returns The corresponding transport client generator, or `undefined` if not specified.
 */
function resolveTransportGenerator(
	implementation?: string,
): IClientGenerator | undefined {
	if (implementation === "fetch") {
		return new FetchClientGenerator();
	}
	if (implementation === "axios") {
		return new AxiosClientGenerator();
	}
	if (implementation === "node") {
		return new NodeClientGenerator();
	}
	return undefined;
}

/**
 * Returns a generator factory instance matching the requested framework or implementation.
 *
 * @param framework - The UI framework for the generator (e.g., `'angular'`, `'react'`, `'vue'`, `'vanilla'`).
 * @param implementation - The specific HTTP transport implementation (`'fetch'`, `'axios'`, `'node'`).
 * @returns An instance of a class implementing `IClientGenerator`.
 */
export function getGeneratorFactory(
	framework: string,
	implementation?: string,
): IClientGenerator {
	const fwLower = (framework || "").toLowerCase();
	const transportDelegate = resolveTransportGenerator(implementation);

	if (fwLower === "react") {
		return new ReactClientGenerator(transportDelegate);
	}
	if (fwLower === "vue") {
		return new VueClientGenerator(transportDelegate);
	}
	if (transportDelegate) {
		return transportDelegate;
	}

	switch (fwLower) {
		case "angular":
			return new AngularClientGenerator();

		case "vanilla js":
		case "vanillajs":
		case "vanilla":
			return new FetchClientGenerator();

		default:
			return new AngularClientGenerator();
	}
}

/**
 * Returns an ORM generator instance matching the requested ORM target.
 *
 * @param orm - Target ORM identifier (e.g. `"typeorm"`).
 * @returns Matching `IOrmGenerator` or `undefined` if not supported.
 */
export function getOrmGeneratorFactory(
	orm?: string,
): IOrmGenerator | undefined {
	if (orm === "typeorm") {
		return new TypeOrmGenerator();
	}
	return undefined;
}

/**
 * Returns a server framework generator instance matching the requested server framework.
 *
 * @param serverFramework - Target server framework identifier (e.g. `"express"`).
 * @returns Matching `IServerFrameworkGenerator` or `undefined` if not supported.
 */
export function getServerGeneratorFactory(
	serverFramework = "express",
): IServerFrameworkGenerator | undefined {
	if (serverFramework === "express") {
		return new ExpressServerGenerator();
	}
	return undefined;
}

/**
 * Orchestrates the synchronous code generation process based on a configuration object.
 *
 * @param config - The generator configuration object.
 * @param project - Optional `ts-morph` Project to use. If not provided, a new one is created.
 * @param testConfig - Optional configuration for test environments to inject a pre-parsed spec.
 * @param targetScope - Optional target scope (`'to_sdk'`, `'to_sdk_cli'`, or `'to_server'`).
 * @throws {Error} When specification parsing or code generation fails.
 */
export function generateFromConfigSync(
	config: GeneratorConfig,
	project?: Project,
	testConfig?: TestGeneratorConfig,
	targetScope?: "to_sdk" | "to_sdk_cli" | "to_server",
): void {
	const effectiveConfig: GeneratorConfig =
		targetScope === "to_server"
			? {
					...config,
					options: {
						...config.options,
						generateServices: false,
					},
				}
			: config;

	const isTestEnv = !!testConfig;
	const fsPolyfill = createJavyFsPolyfill();

	const activeProject =
		project ||
		new Project({
			compilerOptions: {
				declaration: true,
				target: ScriptTarget.ES2022,
				module: ModuleKind.ESNext,
				strict: true,
				...effectiveConfig.compilerOptions,
			},
			...(fsPolyfill ? { fileSystem: fsPolyfill } : {}),
		});

	const codeOutputRoot = effectiveConfig.output;

	if (!isTestEnv) {
		const fs = activeProject.getFileSystem();
		if (!fs.directoryExistsSync(codeOutputRoot)) {
			fs.mkdirSync(codeOutputRoot);
		}
		console.log(
			`📡 Processing OpenAPI specification from ${isUrl(effectiveConfig.input) ? "URL" : "file"}: ${effectiveConfig.input}`,
		);
	}

	try {
		const framework = effectiveConfig.options.framework || "vanilla";
		const implementation = effectiveConfig.options.implementation;

		let swaggerParser: SwaggerParser;
		if (isTestEnv) {
			const docUri = "file://in-memory-spec.json";
			const spec = testConfig.spec as SwaggerSpec;
			const cache = new Map<string, SwaggerSpec>([[docUri, spec]]);
			swaggerParser = new SwaggerParser(spec, effectiveConfig, cache, docUri);
		} else {
			swaggerParser = SwaggerParser.createSync(
				effectiveConfig.input,
				effectiveConfig,
			);
		}

		if (targetScope === "to_server") {
			const ormGenerator = getOrmGeneratorFactory(effectiveConfig.options.orm);
			if (ormGenerator) {
				ormGenerator.generate(
					activeProject,
					swaggerParser,
					effectiveConfig,
					codeOutputRoot,
				);
			}

			const serverGenerator = getServerGeneratorFactory(
				effectiveConfig.options.serverFramework || "express",
			);
			if (serverGenerator) {
				new TypeGenerator(
					swaggerParser,
					activeProject,
					effectiveConfig,
				).generate(codeOutputRoot);

				const schemas = swaggerParser.schemas;
				if (schemas && schemas.length > 0) {
					const routesDir = path.join(codeOutputRoot, "routes");
					const schemaNamesList: string[] = [];
					for (const schema of schemas) {
						if (
							schema.definition &&
							typeof schema.definition === "object" &&
							(schema.definition.type === "object" ||
								(schema.definition.properties &&
									Object.keys(schema.definition.properties).length > 0))
						) {
							schemaNamesList.push(schema.name);
							serverGenerator.generateEntityRoutes(
								activeProject,
								schema.name,
								routesDir,
								effectiveConfig.options.orm,
								effectiveConfig,
								swaggerParser,
							);
						}
					}
					serverGenerator.generateMcpRoutes(
						activeProject,
						swaggerParser,
						routesDir,
						effectiveConfig,
					);
					serverGenerator.generateServerEntrypoint(
						activeProject,
						schemaNamesList,
						codeOutputRoot,
						swaggerParser,
					);
				}
			}
		} else {
			const generator = getGeneratorFactory(framework, implementation);
			generator.generate(
				activeProject,
				swaggerParser,
				effectiveConfig,
				codeOutputRoot,
			);
		}

		if (targetScope === "to_sdk_cli") {
			new CliGenerator().generate(
				activeProject,
				swaggerParser,
				effectiveConfig,
				codeOutputRoot,
			);
			if (effectiveConfig.options.mcp) {
				new McpGenerator().generate(
					activeProject,
					swaggerParser,
					effectiveConfig,
					codeOutputRoot,
				);
			}
		}

		if (!isTestEnv) {
			activeProject.saveSync();
		}
	} catch (error) {
		if (!isTestEnv) {
			console.error(
				"❌ Generation failed:",
				error instanceof Error ? error.message : error,
			);
		}
		throw error;
	}
}

/** Re-exports `extractArazzoFromTypeScript` and `writeFormattedArazzoSpec` from `./arazzo/emit_arazzo.js`. */
export {
	extractArazzoFromTypeScript,
	writeFormattedArazzoSpec,
} from "./arazzo/emit_arazzo.js";
/** Re-exports `ArazzoCliGenerator` from `./arazzo/emit_cli.js`. */
export { ArazzoCliGenerator } from "./arazzo/emit_cli.js";
/** Re-exports `ArazzoSdkGenerator` and `executeArazzoWorkflowRuntime` from `./arazzo/emit_sdk.js`. */
export {
	ArazzoSdkGenerator,
	executeArazzoWorkflowRuntime,
} from "./arazzo/emit_sdk.js";
/** Re-exports `ArazzoServerGenerator` from `./arazzo/emit_server.js`. */
export { ArazzoServerGenerator } from "./arazzo/emit_server.js";
/** Re-exports `ArazzoSnapshotGenerator` from `./arazzo/emit_snapshot.js`. */
export { ArazzoSnapshotGenerator } from "./arazzo/emit_snapshot.js";
/** Re-exports `ArazzoParser` from `./arazzo/parse.js`. */
export { ArazzoParser } from "./arazzo/parse.js";
/** Re-exports `parseArazzoCliAst` and `parseArazzoCliSourceFile` from `./arazzo/parse_cli_ast.js`. */
export {
	parseArazzoCliAst,
	parseArazzoCliSourceFile,
} from "./arazzo/parse_cli_ast.js";
/** Re-exports `ArazzoLoader` from `./arazzo/parse_loader.js`. */
export { ArazzoLoader } from "./arazzo/parse_loader.js";
/** Re-exports `parseArazzoSdkAst` and `parseArazzoSdkSourceFile` from `./arazzo/parse_sdk_ast.js`. */
export {
	parseArazzoSdkAst,
	parseArazzoSdkSourceFile,
} from "./arazzo/parse_sdk_ast.js";
/** Re-exports `parseArazzoServerAst` and `parseArazzoServerE2eSourceFile` from `./arazzo/parse_server_ast.js`. */
export {
	parseArazzoServerAst,
	parseArazzoServerE2eSourceFile,
} from "./arazzo/parse_server_ast.js";
/** Re-exports `validateArazzoSpec` from `./arazzo/parse_validator.js`. */
export { validateArazzoSpec } from "./arazzo/parse_validator.js";
/** Re-exports `generateFromArazzoSync` from `./cli/commands/from_arazzo.js`. */
export { generateFromArazzoSync } from "./cli/commands/from_arazzo.js";
/** Re-exports `generateFromOpenApi` from `./cli/commands/from_openapi.js`. */
export { generateFromOpenApi } from "./cli/commands/from_openapi.js";
/** Re-exports `serveJsonRpc` from `./cli/commands/serve_json_rpc.js`. */
export { serveJsonRpc } from "./cli/commands/serve_json_rpc.js";
/** Re-exports `syncDir` from `./cli/commands/sync_and_github.js`. */
export { syncDir } from "./cli/commands/sync_and_github.js";
/** Re-exports `generateToArazzo` from `./cli/commands/to_arazzo.js`. */
export { generateToArazzo } from "./cli/commands/to_arazzo.js";
/** Re-exports `generateDocsJson` and `generateToOpenApi` from `./cli/commands/to_openapi.js`. */
export {
	generateDocsJson,
	generateToOpenApi,
} from "./cli/commands/to_openapi.js";
/** Re-exports unified error hierarchy from `./core/errors.js`. */
export {
	ArazzoValidationError,
	AstReverseParseError,
	CddError,
	CddErrorCode,
	GeneratorConfigurationError,
	ReferenceResolutionError,
	SpecValidationError,
} from "./core/errors.js";
/** Re-exports `IOrmGenerator` from `./core/orm/index.js`. */
/** Re-exports `IOrmParser` from `./core/orm/index.js`. */
export type { IOrmGenerator, IOrmParser } from "./core/orm/index.js";
/** Re-exports `CodeScanFileSystem` from `./functions/parse.js`. */
/** Re-exports `CodeScanIr` from `./functions/parse.js`. */
/** Re-exports `CodeScanOperation` from `./functions/parse.js`. */
/** Re-exports `CodeScanOptions` from `./functions/parse.js`. */
/** Re-exports `CodeScanParam` from `./functions/parse.js`. */
/** Re-exports `CodeScanParamLocation` from `./functions/parse.js`. */
/** Re-exports `CodeScanRequestBody` from `./functions/parse.js`. */
/** Re-exports `CodeScanResponse` from `./functions/parse.js`. */
export type {
	CodeScanFileSystem,
	CodeScanIr,
	CodeScanOperation,
	CodeScanOptions,
	CodeScanParam,
	CodeScanParamLocation,
	CodeScanRequestBody,
	CodeScanResponse,
} from "./functions/parse.js";
/** Re-exports `buildOpenApiSpecFromScan` from `./functions/parse.js`. */
/** Re-exports `scanTypeScriptProject` from `./functions/parse.js`. */
/** Re-exports `scanTypeScriptSource` from `./functions/parse.js`. */
export {
	buildOpenApiSpecFromScan,
	scanTypeScriptProject,
	scanTypeScriptSource,
} from "./functions/parse.js";
/** Re-exports `serveMcp` from `./mcp_server.js`. */
export { serveMcp } from "./mcp_server.js";
/**
 * AST scanner utilities for reverse-generating OpenAPI specs from TypeScript.
 */
export { parseGeneratedCliSource } from "./vendors/cli/parse.js";
/** Re-exports `TypeOrmGenerator` from `./vendors/typeorm/emit.js`. */
export { TypeOrmGenerator } from "./vendors/typeorm/emit.js";
/** Re-exports `TypeOrmParser` from `./vendors/typeorm/parse.js`. */
export { TypeOrmParser } from "./vendors/typeorm/parse.js";
