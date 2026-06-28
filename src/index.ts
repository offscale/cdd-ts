import * as path from "node:path";

// src/index.ts

import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { isUrl } from "@src/functions/utils.js";
import { ModuleKind, Project, ScriptTarget } from "ts-morph";
import { TypeGenerator } from "./classes/emit.js";
import type { IClientGenerator } from "./core/generator.js";
import { SwaggerParser } from "./openapi/parse.js";
import { AngularClientGenerator } from "./vendors/angular/angular-client.generator.js";
import { AxiosClientGenerator } from "./vendors/axios/axios-client.generator.js";
import { ExpressServerGenerator } from "./vendors/express/express-server.generator.js";
import { FetchClientGenerator } from "./vendors/fetch/fetch-client.generator.js";
import { NodeClientGenerator } from "./vendors/node/node-client.generator.js";
import { ReactClientGenerator } from "./vendors/react/react-client.generator.js";
import { TypeOrmGenerator } from "./vendors/typeorm/emit.js";
import { VueClientGenerator } from "./vendors/vue/vue-client.generator.js";

/**
 * For test environments, allows passing a pre-parsed OpenAPI specification object.
 */
export type TestGeneratorConfig = {
	/** The pre-parsed OpenAPI specification object. */
	spec: object;
};

/**
 * Returns a generator factory instance matching the requested framework or implementation.
 * @param framework The UI framework for the generator (e.g., 'angular', 'react', 'vue').
 * @param implementation The specific implementation to use instead of a UI framework (e.g., 'fetch', 'axios', 'node').
 * @returns An instance of a class implementing IClientGenerator.
 */
export function getGeneratorFactory(
	framework: string,
	implementation?: string,
): IClientGenerator {
	if (implementation === "fetch") {
		return new FetchClientGenerator();
	}
	if (implementation === "axios") {
		return new AxiosClientGenerator();
	}
	if (implementation === "node") {
		return new NodeClientGenerator();
	}
	const fwLower = (framework || "").toLowerCase();
	switch (fwLower) {
		case "angular":
			return new AngularClientGenerator();

		case "react":
			return new ReactClientGenerator();

		case "vue":
			return new VueClientGenerator();

		case "vanilla js":
		case "vanillajs":
		case "vanilla":
			return new FetchClientGenerator();

		default:
			// Default to Angular for backward compatibility if undefined, though config defaults handle this
			return new AngularClientGenerator();
	}
}

import { CliGenerator } from "./vendors/cli/emit.js";
import { McpGenerator } from "./vendors/mcp/emit.js";

/**
 * Orchestrates the entire code generation process based on a configuration object.
 * @param config The generator configuration object.
 * @param project Optional ts-morph Project to use. If not provided, a new one is created. Useful for testing.
 * @param testConfig Optional configuration for test environments to inject a pre-parsed spec.
 * @returns A promise that resolves when generation is complete.
 */
export function generateFromConfigSync(
	config: GeneratorConfig,
	project?: Project,
	testConfig?: TestGeneratorConfig,
	targetScope?: "to_sdk" | "to_sdk_cli" | "to_server",
): void {
	if (targetScope === "to_server") {
		if (config.options) {
			config.options.generateServices = false;
		}
	}

	const isTestEnv = !!testConfig;

	const isJavy: boolean =
		typeof globalThis !== "undefined" &&
		!!(globalThis as { __FsData?: unknown }).__FsData;
	const fsPolyfill = isJavy
		? ({
				getCurrentDirectory: () => "/",
				directoryExistsSync: () => true,
				fileExistsSync: (p: string) => {
					const fs = require("node:fs") as typeof import("node:fs");
					return fs.existsSync(p);
				},
				readFileSync: (p: string) => {
					const fs = require("node:fs") as typeof import("node:fs");
					return fs.readFileSync(p, "utf8");
				},
				readdirSync: () => [],
				statSync: () => ({ isDirectory: () => false, isFile: () => true }),
				realpathSync: (p: string) => p,
				mkdirSync: () => {},
				writeFileSync: (p: string, d: string) => {
					const fs = require("node:fs") as typeof import("node:fs");
					fs.writeFileSync(p, d);
				},
				deleteSync: () => {},
				moveSync: () => {},
				copySync: () => {},
				isCaseSensitive: () => true,
			} as unknown)
		: undefined;

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
			fileSystem: fsPolyfill as unknown as import("ts-morph").FileSystemHost,
		});

	console.log("==> TRACE: new Project() finished");

	if (!isTestEnv) {
		const fs = activeProject.getFileSystem();
		if (!fs.directoryExistsSync(config.output)) {
			fs.mkdirSync(config.output);
		}
	}

	if (!isTestEnv) {
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

		const codeOutputRoot = config.output;

		if (
			!isTestEnv &&
			!activeProject.getFileSystem().directoryExistsSync(codeOutputRoot)
		) {
			activeProject.getFileSystem().mkdirSync(codeOutputRoot);
		}

		if (targetScope === "to_server" && config.options.orm) {
			if (config.options.orm === "typeorm") {
				new TypeOrmGenerator().generate(
					activeProject,
					swaggerParser,
					config,
					codeOutputRoot,
				);
			}
		}

		if (targetScope === "to_server") {
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
					const schemaNamesList = [];
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
					if (serverGenerator.generateMcpRoutes) {
						serverGenerator.generateMcpRoutes(
							activeProject,
							swaggerParser,
							routesDir,
							config,
						);
					}
					if (serverGenerator.generateServerEntrypoint) {
						serverGenerator.generateServerEntrypoint(
							activeProject,
							schemaNamesList,
							codeOutputRoot,
							swaggerParser,
						);
					}
				}
			}
		}

		if (targetScope !== "to_server") {
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

export {
	generateDocsJson,
	generateFromOpenApi,
	generateToOpenApi,
	serveJsonRpc,
	syncDir,
} from "./cli.js";
export type { IOrmGenerator, IOrmParser } from "./core/orm/index.js";
export {
	buildOpenApiSpecFromScan,
	type CodeScanFileSystem,
	type CodeScanIr,
	type CodeScanOperation,
	type CodeScanOptions,
	type CodeScanParam,
	type CodeScanParamLocation,
	type CodeScanRequestBody,
	type CodeScanResponse,
	scanTypeScriptProject,
	scanTypeScriptSource,
} from "./functions/parse.js";
export { serveMcp } from "./mcp_server.js";
/**
 * AST scanner utilities for reverse-generating OpenAPI specs from TypeScript.
 */
export { parseGeneratedCliSource } from "./vendors/cli/parse.js";
export { TypeOrmGenerator } from "./vendors/typeorm/emit.js";
export { TypeOrmParser } from "./vendors/typeorm/parse.js";
