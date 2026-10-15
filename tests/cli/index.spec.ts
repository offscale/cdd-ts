import { Project } from "ts-morph";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypeGenerator } from "../../src/classes/emit.js";
import type { GeneratorConfig } from "../../src/core/types/index.js";
import * as utils from "../../src/functions/utils.js";
import {
	generateFromConfigSync,
	getGeneratorFactory,
} from "../../src/index.js";
import { SwaggerParser } from "../../src/openapi/parse.js";
import { AngularClientGenerator } from "../../src/vendors/angular/angular-client.generator.js";
import { AxiosClientGenerator } from "../../src/vendors/axios/axios-client.generator.js";
import { ExpressServerGenerator } from "../../src/vendors/express/express-server.generator.js";
import { FetchClientGenerator } from "../../src/vendors/fetch/fetch-client.generator.js";
import { McpGenerator } from "../../src/vendors/mcp/emit.js";
import { NodeClientGenerator } from "../../src/vendors/node/node-client.generator.js";
import { ReactClientGenerator } from "../../src/vendors/react/react-client.generator.js";
import { TypeOrmGenerator } from "../../src/vendors/typeorm/emit.js";
import { VueClientGenerator } from "../../src/vendors/vue/vue-client.generator.js";
import { testCast } from "../shared/helpers.js";

vi.mock("../../src/openapi/parse.js", () => {
	const MockSwaggerParser = vi.fn().mockImplementation(function (
		this: unknown,
	) {
		void this;
		return {
			spec: {
				openapi: "3.0.0",
				info: { title: "Test", version: "1" },
				paths: {},
			},
			schemas: [],
			operations: [],
			getSpec: vi.fn().mockReturnValue({}),
			getSecuritySchemes: vi.fn().mockReturnValue({}),
			getDocumentServers: vi.fn().mockReturnValue([]),
		};
	});
	Object.assign(MockSwaggerParser, {
		createSync: vi.fn().mockReturnValue({
			spec: {
				openapi: "3.0.0",
				info: { title: "Test", version: "1" },
				paths: {},
			},
			schemas: [],
			operations: [],
			getSpec: vi.fn().mockReturnValue({}),
		}),
		create: vi.fn().mockResolvedValue({
			spec: {
				openapi: "3.0.0",
				info: { title: "Test", version: "1" },
				paths: {},
			},
			schemas: [],
			operations: [],
			getSpec: vi.fn().mockReturnValue({}),
		}),
	});
	return { SwaggerParser: MockSwaggerParser };
});

vi.mock("../../src/vendors/cli/emit.js", () => {
	return {
		CliGenerator: class {
			generate = vi.fn();
		},
	};
});

describe("index.ts", () => {
	describe("getGeneratorFactory", () => {
		it("returns AngularClientGenerator by default", () => {
			expect(getGeneratorFactory("unknown")).toBeInstanceOf(
				AngularClientGenerator,
			);
		});
		it("returns ReactClientGenerator for react", () => {
			expect(getGeneratorFactory("react")).toBeInstanceOf(ReactClientGenerator);
		});
		it("returns VueClientGenerator for vue", () => {
			expect(getGeneratorFactory("vue")).toBeInstanceOf(VueClientGenerator);
		});
		it("returns FetchClientGenerator for fetch implementation", () => {
			expect(getGeneratorFactory("angular", "fetch")).toBeInstanceOf(
				FetchClientGenerator,
			);
		});
		it("returns AxiosClientGenerator for axios implementation", () => {
			expect(getGeneratorFactory("angular", "axios")).toBeInstanceOf(
				AxiosClientGenerator,
			);
		});
		it("returns NodeClientGenerator for node implementation", () => {
			expect(getGeneratorFactory("angular", "node")).toBeInstanceOf(
				NodeClientGenerator,
			);
		});
		it("returns FetchClientGenerator for vanilla, vanillajs, and Vanilla JS", () => {
			expect(getGeneratorFactory("vanilla")).toBeInstanceOf(
				FetchClientGenerator,
			);
			expect(getGeneratorFactory("vanillajs")).toBeInstanceOf(
				FetchClientGenerator,
			);
			expect(getGeneratorFactory("Vanilla JS")).toBeInstanceOf(
				FetchClientGenerator,
			);
			expect(getGeneratorFactory("")).toBeInstanceOf(AngularClientGenerator);
		});
	});

	describe("generateFromConfigSync", () => {
		let project: Project;
		let config: GeneratorConfig;
		let consoleLogSpy: import("vitest").MockInstance;
		let consoleErrorSpy: import("vitest").MockInstance;

		beforeEach(() => {
			project = new Project({ useInMemoryFileSystem: true });
			config = testCast<GeneratorConfig>({
				input: "http://example.com/spec.json",
				output: "/out",
				options: {
					framework: "angular",
				},
				compilerOptions: {},
			});
			consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should create output directory if it does not exist and is not test env", async () => {
			config.input = "/local/spec.json"; // local path to test console log branch

			// Allow isUrl to return false
			vi.spyOn(utils, "isUrl").mockReturnValue(false);

			// Mocking the parse to fail so it stops but creates dir
			(SwaggerParser.create as import("vitest").Mock).mockRejectedValueOnce(
				new Error("Stop"),
			);

			try {
				generateFromConfigSync(config, project);
			} catch (_e) {
				// Ignore failure
			}

			const fs = project.getFileSystem();
			expect(fs.directoryExistsSync("/out")).toBe(true);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("file"),
			);
		});

		it("should NOT create output directory if it already exists", async () => {
			config.input = "/local/spec.json";
			vi.spyOn(utils, "isUrl").mockReturnValue(false);
			(SwaggerParser.create as import("vitest").Mock).mockRejectedValueOnce(
				new Error("Stop"),
			);

			const fs = project.getFileSystem();
			fs.mkdirSync("/out"); // Pre-create the directory
			const mkdirSpy = vi.spyOn(fs, "mkdirSync");

			try {
				generateFromConfigSync(config, project);
			} catch (e) {
				console.error(e);
			}

			expect(mkdirSpy).not.toHaveBeenCalled();
		});

		it("should handle URL input logging", async () => {
			config.input = "http://example.com/spec.json";
			vi.spyOn(utils, "isUrl").mockReturnValue(true);
			(SwaggerParser.create as import("vitest").Mock).mockRejectedValueOnce(
				new Error("Stop"),
			);

			try {
				generateFromConfigSync(config, project);
			} catch (_e) {
				// Ignore failure
			}
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("URL"),
			);
		});

		it("should default framework to vanilla if not provided", async () => {
			delete config.options.framework;
			const testConfig = {
				spec: testCast<SwaggerParser>({
					openapi: "3.0.0",
					info: { title: "Test", version: "1" },
					paths: {},
				}),
			};
			const activeProjectSaveSpy = vi
				.spyOn(project, "saveSync")
				.mockResolvedValue(undefined);
			const generateSpy = vi
				.spyOn(FetchClientGenerator.prototype, "generate")
				.mockResolvedValue(undefined);

			generateFromConfigSync(config, project, testConfig);

			// Should not save if isTestEnv
			expect(activeProjectSaveSpy).not.toHaveBeenCalled();
			expect(generateSpy).toHaveBeenCalled();
		});

		it("should save project if not test env and target cli", async () => {
			const activeProjectSaveSpy = vi
				.spyOn(project, "saveSync")
				.mockResolvedValue(undefined);

			// Ensure SwaggerParser.create resolves
			(SwaggerParser.createSync as import("vitest").Mock).mockReturnValueOnce({
				spec: {
					openapi: "3.0.0",
					info: { title: "Test", version: "1" },
					paths: {},
				},
				operations: [],
			});

			// Mock generator
			vi.spyOn(AngularClientGenerator.prototype, "generate").mockResolvedValue(
				undefined,
			);

			generateFromConfigSync(config, project, undefined, "to_sdk_cli");

			expect(activeProjectSaveSpy).toHaveBeenCalled();
		});

		it("should initialize a new Project if not provided", async () => {
			const generateSpy = vi
				.spyOn(AngularClientGenerator.prototype, "generate")
				.mockResolvedValue(undefined);

			// Should pass without project argument
			generateFromConfigSync(config, undefined, {
				spec: testCast<SwaggerParser>({
					openapi: "3.0.0",
					info: { title: "Test", version: "1" },
					paths: {},
				}),
			});

			expect(generateSpy).toHaveBeenCalled();
		});

		it("should throw and log error if generation fails and not test env", async () => {
			config.input = "invalid-input";
			const error = new Error("Parse Error");
			(
				SwaggerParser.createSync as import("vitest").Mock
			).mockImplementationOnce(() => {
				throw error;
			});

			try {
				generateFromConfigSync(config, project);
				expect.unreachable("Should have thrown");
			} catch (_e) {
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"❌ Generation failed:",
					"Parse Error",
				);
			}
		});

		it("should throw and log unknown error if generation fails and not test env", async () => {
			config.input = "invalid-input";
			const error = "String Error";
			(
				SwaggerParser.createSync as import("vitest").Mock
			).mockImplementationOnce(() => {
				throw error;
			});

			try {
				generateFromConfigSync(config, project);
				expect.unreachable("Should have thrown");
			} catch (_e) {
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"❌ Generation failed:",
					"String Error",
				);
			}
		});

		it("should throw WITHOUT logging if generation fails IN test env", async () => {
			const error = new Error("Parse Error");
			(
				SwaggerParser.createSync as import("vitest").Mock
			).mockImplementationOnce(() => {
				throw error;
			});

			try {
				// Pass testConfig to simulate isTestEnv = true
				generateFromConfigSync(config, project, {
					spec: {
						openapi: "3.0.0",
						info: { title: "Test", version: "1" },
						paths: {},
					},
				});
				expect.unreachable("Should have thrown");
			} catch (_e) {
				expect(consoleErrorSpy).not.toHaveBeenCalled();
			}
		});

		it("should generate server with typeorm and express when targetScope is to_server", () => {
			config.options.orm = "typeorm";
			config.options.serverFramework = "express";
			const typeOrmSpy = vi
				.spyOn(TypeOrmGenerator.prototype, "generate")
				.mockReturnValue(undefined);
			const typeGenSpy = vi
				.spyOn(TypeGenerator.prototype, "generate")
				.mockReturnValue(undefined);

			generateFromConfigSync(
				config,
				project,
				{
					spec: {
						openapi: "3.0.0",
						info: { title: "Test", version: "1" },
						paths: {},
					},
				},
				"to_server",
			);
			expect(config.options.generateServices).toBe(false);
			expect(typeOrmSpy).toHaveBeenCalled();
			expect(typeGenSpy).toHaveBeenCalled();
		});

		it("should generate server entity routes when schemas exist in SwaggerParser", () => {
			delete config.options.serverFramework;
			vi.spyOn(TypeGenerator.prototype, "generate").mockReturnValue(undefined);
			const entitySpy = vi
				.spyOn(ExpressServerGenerator.prototype, "generateEntityRoutes")
				.mockReturnValue(undefined);
			const mcpRoutesSpy = vi
				.spyOn(ExpressServerGenerator.prototype, "generateMcpRoutes")
				.mockReturnValue(undefined);
			const entrySpy = vi
				.spyOn(ExpressServerGenerator.prototype, "generateServerEntrypoint")
				.mockReturnValue(undefined);

			const parserInstance = {
				spec: {
					openapi: "3.0.0",
					info: { title: "Test", version: "1" },
					paths: {},
				},
				schemas: [
					{
						name: "User",
						definition: {
							type: "object",
							properties: { id: { type: "string" } },
						},
					},
					{
						name: "Item",
						definition: { properties: { name: { type: "string" } } },
					},
					{
						name: "EmptyObj",
						definition: { properties: {} },
					},
					{
						name: "Flag",
						definition: true,
					},
				],
				getSpec: () => ({}),
				getSecuritySchemes: () => ({}),
				getDocumentServers: () => [],
				operations: [],
			};
			testCast<import("vitest").Mock>(SwaggerParser).mockImplementationOnce(
				function (this: unknown) {
					void this;
					return parserInstance;
				},
			);

			generateFromConfigSync(
				config,
				project,
				{
					spec: {
						openapi: "3.0.0",
						info: { title: "Test", version: "1" },
						paths: {},
					},
				},
				"to_server",
			);
			expect(entitySpy).toHaveBeenCalledTimes(2);
			expect(mcpRoutesSpy).toHaveBeenCalled();
			expect(entrySpy).toHaveBeenCalled();
		});

		it("should skip express server generation when serverFramework is not express", () => {
			(config.options as Record<string, unknown>).serverFramework = "other";
			generateFromConfigSync(
				config,
				project,
				{
					spec: {
						openapi: "3.0.0",
						info: { title: "Test", version: "1" },
						paths: {},
					},
				},
				"to_server",
			);
			expect(config.options.generateServices).toBe(false);
		});

		it("should invoke McpGenerator when targetScope is to_sdk_cli and mcp is true", () => {
			config.options.mcp = true;
			vi.spyOn(AngularClientGenerator.prototype, "generate").mockReturnValue(
				undefined,
			);
			const mcpSpy = vi
				.spyOn(McpGenerator.prototype, "generate")
				.mockReturnValue(undefined);

			generateFromConfigSync(
				config,
				project,
				{
					spec: {
						openapi: "3.0.0",
						info: { title: "Test", version: "1" },
						paths: {},
					},
				},
				"to_sdk_cli",
			);
			expect(mcpSpy).toHaveBeenCalled();
		});

		it("should use Javy fsPolyfill when globalThis.__FsData is defined and project is omitted", () => {
			(globalThis as { __FsData?: unknown }).__FsData = {};
			vi.spyOn(AngularClientGenerator.prototype, "generate").mockReturnValue(
				undefined,
			);
			try {
				generateFromConfigSync(config, undefined, {
					spec: {
						openapi: "3.0.0",
						info: { title: "Test", version: "1" },
						paths: {},
					},
				});
			} finally {
				delete (globalThis as { __FsData?: unknown }).__FsData;
			}
		});
	});
});
