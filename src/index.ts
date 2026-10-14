/**
 * Public programmatic entrypoint for `cdd-ts` OpenAPI SDK, CLI, and server code generation and reverse parsing.
 *
 * @module index
 */
import * as path from "node:path";
import { ModuleKind, Project, ScriptTarget } from "ts-morph";
import { TypeGenerator } from "./classes/emit.js";
import { createJavyFsPolyfill } from "./cli/commands/from_openapi.js";
import type { IClientGenerator } from "./core/generator.js";
import type { GeneratorConfig, SwaggerSpec } from "./core/types/index.js";
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
	if (targetScope === "to_server") {
		config.options.generateServices = false;
	}

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
				...config.compilerOptions,
			},
			...(fsPolyfill ? { fileSystem: fsPolyfill } : {}),
		});

	console.log("==> TRACE: new Project() finished");

	const codeOutputRoot = config.output;

	if (!isTestEnv) {
		const fs = activeProject.getFileSystem();
		if (!fs.directoryExistsSync(codeOutputRoot)) {
			fs.mkdirSync(codeOutputRoot);
		}
		console.log(
			`📡 Processing OpenAPI specification from ${isUrl(config.input) ? "URL" : "file"}: ${config.input}`,
		);
	}

	try {
		const framework = config.options.framework || "vanilla";
		const implementation = config.options.implementation;

		let swaggerParser: SwaggerParser;
		if (isTestEnv) {
			const docUri = "file://in-memory-spec.json";
			const spec = testConfig.spec as SwaggerSpec;
			const cache = new Map<string, SwaggerSpec>([[docUri, spec]]);
			swaggerParser = new SwaggerParser(spec, config, cache, docUri);
		} else {
			console.log("==> TRACE: Before SwaggerParser.create");
			console.log("==> TRACE: Before SwaggerParser.create");
			console.log("TRACE AWAIT 1");
			swaggerParser = SwaggerParser.createSync(config.input, config);
			console.log("TRACE AWAIT 2");
			console.log("==> TRACE: After SwaggerParser.create");
			console.log("==> TRACE: After SwaggerParser.create");
		}

		if (targetScope === "to_server") {
			if (config.options.orm === "typeorm") {
				new TypeOrmGenerator().generate(
					activeProject,
					swaggerParser,
					config,
					codeOutputRoot,
				);
			}

			const serverFramework = config.options.serverFramework || "express";
			if (serverFramework === "express") {
				const serverGenerator = new ExpressServerGenerator();

				// Generate models using TypeGenerator
				new TypeGenerator(swaggerParser, activeProject, config).generate(
					codeOutputRoot,
				);

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
								config.options.orm,
								config,
								swaggerParser,
							);
						}
					}
					serverGenerator.generateMcpRoutes(
						activeProject,
						swaggerParser,
						routesDir,
						config,
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
			console.log("==> TRACE: Before generator");
			console.log("==> TRACE: Before generator");
			console.log("TRACE AWAIT 3");
			generator.generate(activeProject, swaggerParser, config, codeOutputRoot);
			console.log("TRACE AWAIT 4");
			console.log("==> TRACE: After generator");
			console.log("==> TRACE: After generator");
		}

		if (targetScope === "to_sdk_cli") {
			new CliGenerator().generate(
				activeProject,
				swaggerParser,
				config,
				codeOutputRoot,
			);
			if (config.options.mcp) {
				new McpGenerator().generate(
					activeProject,
					swaggerParser,
					config,
					codeOutputRoot,
				);
			}
		}

		// ... This block is reachable when isTestEnv is true ...

		if (!isTestEnv) {
			console.log("==> TRACE: Before saveSync");
			activeProject.saveSync();
			console.log("==> TRACE: After saveSync");
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

/** Re-exports `generateFromOpenApi` from `./cli/commands/from_openapi.js`. */
export { generateFromOpenApi } from "./cli/commands/from_openapi.js";
/** Re-exports `serveJsonRpc` from `./cli/commands/serve_json_rpc.js`. */
export { serveJsonRpc } from "./cli/commands/serve_json_rpc.js";
/** Re-exports `syncDir` from `./cli/commands/sync_and_github.js`. */
export { syncDir } from "./cli/commands/sync_and_github.js";
/** Re-exports `generateDocsJson` and `generateToOpenApi` from `./cli/commands/to_openapi.js`. */
export {
	generateDocsJson,
	generateToOpenApi,
} from "./cli/commands/to_openapi.js";
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
