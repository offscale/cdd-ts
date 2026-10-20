import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { checkIsMain, executeIfMain, run } from "../../src/cli.js";
import { createTestSpec } from "../shared/helpers.js";

vi.mock("../../src/index.js", () => ({
	generateFromConfigSync: vi.fn(),
}));

vi.mock("../../src/openapi/parse.js", () => ({
	SwaggerParser: {
		create: vi.fn().mockResolvedValue({}),
		createSync: vi.fn().mockReturnValue({
			spec: { openapi: "3.0.0", info: { title: "Test", version: "1" } },
			operations: [],
		}),
	},
}));

vi.mock("../../src/functions/docs_generator.js", () => ({
	generateDocsJson: vi.fn().mockReturnValue({ docs: true }),
}));

vi.mock("../../src/cli/commands/from_arazzo.js", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../src/cli/commands/from_arazzo.js")
		>();
	return {
		...actual,
		generateFromArazzoSync: vi.fn(),
	};
});

vi.mock("../../src/cli/commands/to_arazzo.js", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../src/cli/commands/to_arazzo.js")
		>();
	return {
		...actual,
		generateToArazzo: vi.fn().mockReturnValue({ arazzo: "1.1.0" }),
	};
});

vi.mock("../../src/functions/utils.js", () => ({
	applyReverseMetadata: vi.fn((spec: unknown) => spec),
	buildOpenApiSpecFromServices: vi.fn(() => ({
		openapi: "3.0.0",
		services: true,
	})),
	buildOpenApiSpecFromScan: vi.fn(() => ({ openapi: "3.0.0", scan: true })),
	isUrl: vi.fn((url: string) => url.startsWith("http")),
	parseGeneratedMetadata: vi.fn(() => ({ meta: true })),
	parseGeneratedModels: vi.fn(() => ({ schemas: true })),
	parseGeneratedServices: vi.fn(() => []),
	readOpenApiSnapshot: vi.fn(),
	scanTypeScriptProject: vi.fn(() => ({})),
}));

vi.mock("node:http", () => ({
	createServer: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	};
});

describe("cli.ts", () => {
	let run: (argv: string[]) => Promise<void>;
	let consoleWarnSpy: import("vitest").MockInstance;
	let consoleErrorSpy: import("vitest").MockInstance;
	let stdoutSpy: import("vitest").MockInstance;
	let mockServer: { listen: import("vitest").Mock };
	let requestHandler:
		| ((
				req: { method: string; on: import("vitest").Mock },
				res: { writeHead: import("vitest").Mock; end: import("vitest").Mock },
		  ) => Promise<void> | void)
		| undefined;
	let actualFs: typeof import("node:fs");

	const dummyConfigPath1 = path.join(process.cwd(), "dummy-config1.js");
	const dummyConfigPath2 = path.join(process.cwd(), "dummy-config2.js");
	const dummyConfigPath3 = path.join(process.cwd(), "dummy-config3.js");
	const dummyConfigPath4 = path.join(process.cwd(), "dummy-config4.js");

	beforeAll(async () => {
		actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
		actualFs.writeFileSync(
			dummyConfigPath1,
			`export default { input: 'dummy.json', output: 'out' };`,
		);
		actualFs.writeFileSync(
			dummyConfigPath2,
			`export default { input: 'http://foo.com', output: '/out' };`,
		);
		actualFs.writeFileSync(
			dummyConfigPath3,
			`export default { input: '/abs/path.json', output: 'rel_out' };`,
		);
		actualFs.writeFileSync(dummyConfigPath4, `throw new Error("Load failed");`);
	});

	afterAll(() => {
		if (actualFs.existsSync(dummyConfigPath1))
			actualFs.unlinkSync(dummyConfigPath1);
		if (actualFs.existsSync(dummyConfigPath2))
			actualFs.unlinkSync(dummyConfigPath2);
		if (actualFs.existsSync(dummyConfigPath3))
			actualFs.unlinkSync(dummyConfigPath3);
		if (actualFs.existsSync(dummyConfigPath4))
			actualFs.unlinkSync(dummyConfigPath4);
	});

	beforeEach(async () => {
		vi.resetModules();
		vi.clearAllMocks();

		vi.spyOn(console, "log").mockImplementation(() => undefined);
		consoleWarnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		mockServer = {
			listen: vi.fn((_port: number, _host: string, cb: () => void) => {
				if (cb) cb();
				return mockServer;
			}),
		};
		(http.createServer as import("vitest").Mock).mockImplementation(
			(handler: typeof requestHandler) => {
				requestHandler = handler;
				return mockServer;
			},
		);

		const cli = await import("../../src/cli.js");
		run = cli.run;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("from_openapi", () => {
		it("to_sdk_cli with full options", async () => {
			await run([
				"node",
				"cli.js",
				"from_openapi",
				"to_sdk_cli",
				"--input",
				"test.json",
				"--output",
				"/my-out",
				"--clientName",
				"MyClient",
				"--framework",
				"react",
				"--implementation",
				"fetch",
				"--dateType",
				"string",
				"--enumStyle",
				"union",
				"--admin",
				"--no-generate-services",
				"--no-tests-for-service",
				"--no-tests-for-admin",
				"--no-github-actions",
				"--no-installable-package",
			]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const indexModule = await import("../../src/index.js");
			expect(indexModule.generateFromConfigSync).toHaveBeenCalled();
			const config = vi.mocked(indexModule.generateFromConfigSync).mock
				.calls[0]?.[0];
			expect(config?.input).toBe("test.json");
		});

		it("to_sdk defaults and relative output resolution", async () => {
			await run([
				"node",
				"cli.js",
				"from_openapi",
				"to_sdk",
				"--input-dir",
				"dir",
			]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const indexModule = await import("../../src/index.js");
			expect(indexModule.generateFromConfigSync).toHaveBeenCalled();
		});

		it("to_server without input should fail", async () => {
			const exitPromise = new Promise<number>((resolve) => {
				vi.spyOn(process, "exit").mockImplementation((code) => {
					resolve(code as number);
					return undefined as never;
				});
			});
			await run(["node", "cli.js", "from_openapi", "to_server"]);
			const code = await exitPromise;
			expect(code).toBe(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Generation failed"),
				expect.stringContaining("Input path or URL is required"),
			);
		});

		it("loads configuration file with relative paths", async () => {
			await run([
				"node",
				"cli.js",
				"from_openapi",
				"to_sdk",
				"--config",
				dummyConfigPath1,
			]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const indexModule = await import("../../src/index.js");
			expect(indexModule.generateFromConfigSync).toHaveBeenCalled();
			const config = vi.mocked(indexModule.generateFromConfigSync).mock
				.calls[0]?.[0];
			expect(config?.input).toBe(path.resolve(process.cwd(), "dummy.json"));
		});

		it("fails if config file throws a string error", async () => {
			const dummyConfigPathThrow = path.join(
				process.cwd(),
				"dummy-config-throw.js",
			);
			actualFs.writeFileSync(dummyConfigPathThrow, `throw "String Error";`);

			const exitPromise = new Promise<number>((resolve) => {
				vi.spyOn(process, "exit").mockImplementation((code) => {
					resolve(code as number);
					return undefined as never;
				});
			});
			await run([
				"node",
				"cli.js",
				"from_openapi",
				"to_sdk",
				"--config",
				"dummy-config-throw.js",
			]);
			const code = await exitPromise;
			expect(code).toBe(1);
		});

		it("resolves output path relative to cwd if not absolute from options", async () => {
			await run([
				"node",
				"cli.js",
				"from_openapi",
				"to_sdk",
				"-i",
				"spec.json",
				"-o",
				"outdir",
			]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const indexModule = await import("../../src/index.js");
			const config = vi.mocked(indexModule.generateFromConfigSync).mock
				.calls[0]?.[0];
			expect(config?.output).toBe(path.resolve(process.cwd(), "outdir", "src"));
		});

		it("fails if config file not found", async () => {
			const exitPromise = new Promise<number>((resolve) => {
				vi.spyOn(process, "exit").mockImplementation((code) => {
					resolve(code as number);
					return undefined as never;
				});
			});
			await run([
				"node",
				"cli.js",
				"from_openapi",
				"to_sdk",
				"--config",
				"non-existent.js",
			]);
			const code = await exitPromise;
			expect(code).toBe(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Generation failed"),
				expect.stringContaining("Configuration file not found"),
			);
		});
	});

	describe("to_openapi", () => {
		it("generates yaml spec normally", async () => {
			const utils = await import("../../src/functions/utils.js");
			vi.mocked(utils.readOpenApiSnapshot).mockReturnValueOnce({
				spec: createTestSpec({ openapi: "3.0.0" }),
				sourcePath: "in",
				format: "yaml",
			});
			await run(["node", "cli.js", "to_openapi", "-i", "in"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(stdoutSpy).toHaveBeenCalledWith(
				expect.stringContaining("openapi: 3.0.0"),
			);
		});

		it("generates json spec to file", async () => {
			const utils = await import("../../src/functions/utils.js");
			vi.mocked(utils.readOpenApiSnapshot).mockReturnValueOnce({
				spec: createTestSpec({ openapi: "3.0.0" }),
				sourcePath: "in",
				format: "json",
			});
			await run([
				"node",
				"cli.js",
				"to_openapi",
				"-i",
				"in",
				"-o",
				"out.json",
				"--format",
				"json",
			]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(fs.writeFileSync).toHaveBeenCalledWith(
				"out.json",
				expect.stringContaining('"openapi": "3.0.0"'),
				"utf8",
			);
		});

		it("fails if readOpenApiSnapshot throws an unknown error", async () => {
			const utils = await import("../../src/functions/utils.js");
			vi.mocked(utils.readOpenApiSnapshot).mockImplementationOnce(() => {
				throw new Error("Unknown error");
			});
			const exitPromise = new Promise<number>((resolve) =>
				vi.spyOn(process, "exit").mockImplementation((code) => {
					resolve(code as number);
					return undefined as never;
				}),
			);
			await run(["node", "cli.js", "to_openapi", "-i", "in"]);
			const code = await exitPromise;
			expect(code).toBe(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("to_openapi failed:"),
				"Unknown error",
			);
		});

		it("falls back to AST if parseGeneratedServices fails", async () => {
			const utils = await import("../../src/functions/utils.js");
			vi.mocked(utils.readOpenApiSnapshot).mockImplementationOnce(() => {
				throw new Error("No OpenAPI snapshot found");
			});
			vi.mocked(utils.parseGeneratedServices).mockImplementationOnce(() => {
				throw new Error("Services fail");
			});
			vi.mocked(utils.parseGeneratedMetadata).mockImplementationOnce(() => {
				throw new Error("Meta fail AST");
			});

			await run(["node", "cli.js", "to_openapi", "-i", "in"]);
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(utils.scanTypeScriptProject).toHaveBeenCalled();
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Services fail"),
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Meta fail AST"),
			);
		});

		it("continues without models if parseGeneratedModels fails", async () => {
			const utils = await import("../../src/functions/utils.js");
			vi.mocked(utils.readOpenApiSnapshot).mockImplementationOnce(() => {
				throw new Error("Unsupported snapshot file extension");
			});
			vi.mocked(utils.parseGeneratedServices).mockReturnValueOnce([]);
			vi.mocked(utils.parseGeneratedModels).mockImplementationOnce(() => {
				throw new Error("Models fail");
			});
			vi.mocked(utils.parseGeneratedMetadata).mockImplementationOnce(() => {
				throw new Error("Meta fail models");
			});

			await run(["node", "cli.js", "to_openapi", "-i", "in"]);
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Models fail"),
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Meta fail models"),
			);
		});
	});

	describe("to_docs_json", () => {
		it("generates docs json and outputs to stdout", async () => {
			await run([
				"node",
				"cli.js",
				"to_docs_json",
				"-i",
				"spec.json",
				"--framework",
				"vue",
				"--no-imports",
				"--no-wrapping",
			]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(stdoutSpy).toHaveBeenCalledWith(
				expect.stringContaining('"docs": true'),
			);
		});

		it("generates docs json and outputs to file", async () => {
			await run([
				"node",
				"cli.js",
				"to_docs_json",
				"-i",
				"spec.json",
				"-o",
				"docs.json",
			]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(fs.writeFileSync).toHaveBeenCalledWith(
				"docs.json",
				expect.stringContaining('"docs": true'),
				"utf8",
			);
		});

		it("fails on error", async () => {
			const parse = await import("../../src/openapi/parse.js");
			vi.mocked(parse.SwaggerParser.create).mockRejectedValueOnce(
				new Error("Parse error docs"),
			);
			const exitPromise = new Promise<number>((resolve) =>
				vi.spyOn(process, "exit").mockImplementation((code) => {
					resolve(code as number);
					return undefined as never;
				}),
			);
			await run(["node", "cli.js", "to_docs_json", "-i", "in"]);
			const code = await exitPromise;
			expect(code).toBe(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("to_docs_json failed:"),
				"Parse error docs",
			);
		});
	});

	describe("serve_json_rpc", () => {
		const createMockReqRes = (method: string, bodyStr?: string) => {
			const req = {
				method,
				on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
					if (event === "data" && bodyStr) cb(Buffer.from(bodyStr));
					if (event === "end") cb();
				}),
			};
			const res = {
				writeHead: vi.fn(),
				end: vi.fn(),
			};
			return { req, res };
		};

		it("starts server and responds with 405 for GET", async () => {
			await run([
				"node",
				"cli.js",
				"serve_json_rpc",
				"--port",
				"9000",
				"--listen",
				"0.0.0.0",
			]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(http.createServer).toHaveBeenCalled();
			expect(mockServer.listen).toHaveBeenCalledWith(
				9000,
				"0.0.0.0",
				expect.any(Function),
			);

			const { req, res } = createMockReqRes("GET");
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.writeHead).toHaveBeenCalledWith(405);
			expect(res.end).toHaveBeenCalled();
		});

		it("returns parse error for invalid JSON", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const { req, res } = createMockReqRes("POST", "{ invalid }");
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.writeHead).toHaveBeenCalledWith(400, {
				"Content-Type": "application/json",
			});
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining("Parse error"),
			);
		});

		it("returns method not found", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({ method: "unknown" }),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining("Method not found"),
			);
		});

		it("executes version command", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({ method: "version", id: 1 }),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining('"result":'),
			);
		});

		it("executes from_openapi_to_sdk_cli", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({
					method: "from_openapi_to_sdk_cli",
					params: { input: "test.json" },
					id: 1,
				}),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining('"result":"Success"'),
			);
		});

		it("executes from_openapi_to_sdk", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({
					method: "from_openapi_to_sdk",
					params: { input: "test.json" },
					id: 1,
				}),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining('"result":"Success"'),
			);
		});

		it("executes from_openapi_to_server", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({
					method: "from_openapi_to_server",
					params: { input: "test.json" },
					id: 1,
				}),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining('"result":"Success"'),
			);
		});

		it("executes to_openapi", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const utils = await import("../../src/functions/utils.js");
			vi.mocked(utils.readOpenApiSnapshot).mockReturnValueOnce({
				spec: createTestSpec({ openapi: "3.0.0" }),
				sourcePath: "in",
				format: "json",
			});
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({
					method: "to_openapi",
					params: { input: "test.json" },
					id: 1,
				}),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining('"result":{"openapi":"3.0.0"}'),
			);
		});

		it("executes to_docs_json", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({
					method: "to_docs_json",
					params: { input: "test.json" },
					id: 1,
				}),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining('"result":{"docs":true}'),
			);
		});

		it("executes from_arazzo_to_sdk, from_arazzo_to_sdk_cli, from_arazzo_to_server, and to_arazzo", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			for (const method of [
				"from_arazzo_to_sdk",
				"from_arazzo_to_sdk_cli",
				"from_arazzo_to_server",
				"to_arazzo",
			]) {
				const { req, res } = createMockReqRes(
					"POST",
					JSON.stringify({
						method,
						params: { input: "arazzo.json", output: "out" },
						id: 1,
					}),
				);
				await requestHandler?.(req, res);
				await new Promise((r) => setTimeout(r, 10));
				expect(res.writeHead).toHaveBeenCalledWith(200, {
					"Content-Type": "application/json",
				});
			}

			// Also test default fallback params on from_arazzo_*
			for (const method of [
				"from_arazzo_to_sdk",
				"from_arazzo_to_sdk_cli",
				"from_arazzo_to_server",
			]) {
				const { req, res } = createMockReqRes(
					"POST",
					JSON.stringify({
						method,
						id: 2,
					}),
				);
				await requestHandler?.(req, res);
				await new Promise((r) => setTimeout(r, 10));
				expect(res.writeHead).toHaveBeenCalledWith(200, {
					"Content-Type": "application/json",
				});
			}
		});

		it("handles internal generation errors gracefully", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const indexModule = await import("../../src/index.js");
			vi.mocked(indexModule.generateFromConfigSync).mockImplementationOnce(
				() => {
					throw new Error("Gen Error");
				},
			);
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({
					method: "from_openapi_to_sdk",
					params: { input: "test.json" },
					id: 1,
				}),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.writeHead).toHaveBeenCalledWith(400, {
				"Content-Type": "application/json",
			});
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining("Gen Error"),
			);
		});

		it("handles internal generation errors gracefully without code", async () => {
			await run(["node", "cli.js", "serve_json_rpc"]);
			await new Promise((resolve) => setTimeout(resolve, 100));
			const indexModule = await import("../../src/index.js");
			vi.mocked(indexModule.generateFromConfigSync).mockImplementationOnce(
				() => {
					throw "String Error";
				},
			);
			const { req, res } = createMockReqRes(
				"POST",
				JSON.stringify({
					method: "from_openapi_to_sdk",
					params: { input: "test.json" },
					id: 1,
				}),
			);
			await requestHandler?.(req, res);
			await new Promise((r) => setTimeout(r, 10));
			expect(res.writeHead).toHaveBeenCalledWith(400, {
				"Content-Type": "application/json",
			});
			expect(res.end).toHaveBeenCalledWith(
				expect.stringContaining("String Error"),
			);
		});
	});
});

describe("isMain block", () => {
	it("should execute run if isMain is true", async () => {
		expect(checkIsMain("/some/path", undefined)).toBe(false);
		expect(checkIsMain("/some/path", "not-a-valid-file-url")).toBe(false);

		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(() => undefined as never);
		const errSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const fakeUrl = "file:///tmp/cli-entry.js";
		let rejectedPromise: Promise<void> | undefined;
		executeIfMain(["node", "/tmp/cli-entry.js"], fakeUrl, () => {
			rejectedPromise = Promise.reject(new Error("runner boom"));
			return rejectedPromise;
		});
		await rejectedPromise?.catch(() => undefined);
		await new Promise((r) => setTimeout(r, 10));
		expect(errSpy).toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(1);

		executeIfMain(["node"], fakeUrl, async () => undefined);
	});
});

describe("to_sdk_cli error handling", () => {
	it("fails gracefully", async () => {
		const exitPromise = new Promise<number>((resolve) => {
			vi.spyOn(process, "exit").mockImplementation((code) => {
				resolve(code as number);
				return undefined as never;
			});
		});
		await run(["node", "cli.js", "from_openapi", "to_sdk_cli"]);
		const code = await exitPromise;
		expect(code).toBe(1);
	});
});

describe("to_sdk error handling", () => {
	it("fails gracefully", async () => {
		const exitPromise = new Promise<number>((resolve) => {
			vi.spyOn(process, "exit").mockImplementation((code) => {
				resolve(code as number);
				return undefined as never;
			});
		});
		await run(["node", "cli.js", "from_openapi", "to_sdk"]);
		const code = await exitPromise;
		expect(code).toBe(1);
	});
});
