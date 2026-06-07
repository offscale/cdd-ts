import { Project } from "ts-morph";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratorConfig } from "../../src/core/types/index.js";
import * as utils from "../../src/functions/utils.js";
import {
	generateFromConfigSync,
	getGeneratorFactory,
} from "../../src/index.js";
import { SwaggerParser } from "../../src/openapi/parse.js";
import { AngularClientGenerator } from "../../src/vendors/angular/angular-client.generator.js";
import { AxiosClientGenerator } from "../../src/vendors/axios/axios-client.generator.js";
import { FetchClientGenerator } from "../../src/vendors/fetch/fetch-client.generator.js";
import { NodeClientGenerator } from "../../src/vendors/node/node-client.generator.js";
import { ReactClientGenerator } from "../../src/vendors/react/react-client.generator.js";
import { VueClientGenerator } from "../../src/vendors/vue/vue-client.generator.js";

vi.mock("../../src/openapi/parse.js", () => {
	const MockSwaggerParser = vi.fn();
	(MockSwaggerParser as unknown as Record<string, unknown>).createSync = vi
		.fn()
		.mockReturnValue({
			spec: {
				openapi: "3.0.0",
				info: { title: "Test", version: "1" },
				paths: {},
			},
			getSpec: vi.fn().mockReturnValue({}),
		});
	(MockSwaggerParser as unknown as Record<string, unknown>).create = vi
		.fn()
		.mockResolvedValue({
			spec: {
				openapi: "3.0.0",
				info: { title: "Test", version: "1" },
				paths: {},
			},
			getSpec: vi.fn().mockReturnValue({}),
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
	});

	describe("generateFromConfigSync", () => {
		let project: Project;
		let config: GeneratorConfig;
		let consoleLogSpy: import("vitest").MockInstance;
		let consoleErrorSpy: import("vitest").MockInstance;

		beforeEach(() => {
			project = new Project({ useInMemoryFileSystem: true });
			config = {
				input: "http://example.com/spec.json",
				output: "/out",
				options: {
					framework: "angular",
				},
				compilerOptions: {},
			} as unknown as GeneratorConfig;
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
				spec: {
					openapi: "3.0.0",
					info: { title: "Test", version: "1" },
					paths: {},
				} as unknown as SwaggerParser,
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
				spec: {
					openapi: "3.0.0",
					info: { title: "Test", version: "1" },
					paths: {},
				} as unknown as SwaggerParser,
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
				generateFromConfigSync(config, project, {} as unknown as SwaggerParser);
				expect.unreachable("Should have thrown");
			} catch (_e) {
				expect(consoleErrorSpy).not.toHaveBeenCalled();
			}
		});
	});
});
