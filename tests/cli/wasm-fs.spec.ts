import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	emitGithubActionsScaffolding,
	emitPackageScaffolding,
} from "../../src/cli/scaffold.js";
import {
	loadPackageVersion,
	writeDocsJsonOutput,
	writeFormattedSpec,
} from "../../src/cli/spec_writer.js";
import {
	createJavyFsPolyfill,
	runJavyStdinIfPresent,
} from "../../src/core/wasm-fs.js";

describe("core/wasm-fs", () => {
	afterEach(() => {
		delete (globalThis as { __FsData?: unknown }).__FsData;
		delete (globalThis as { __SPEC_JSON?: unknown }).__SPEC_JSON;
		delete (globalThis as { Javy?: unknown }).Javy;
		vi.restoreAllMocks();
	});

	it("returns undefined from createJavyFsPolyfill when __FsData is not set", () => {
		expect(createJavyFsPolyfill()).toBeUndefined();
	});

	it("creates a functional FileSystemHost polyfill when __FsData is set", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-wasm-fs-"));
		const sampleFile = path.join(tmpDir, "hello.txt");
		(globalThis as { __FsData?: unknown }).__FsData = {};

		try {
			const host = createJavyFsPolyfill();
			expect(host).toBeDefined();
			if (!host) return;

			expect(host.getCurrentDirectory()).toBe("/");
			expect(host.directoryExistsSync("/any")).toBe(true);
			expect(host.readDirSync("/any")).toEqual([]);
			expect(host.realpathSync("/a/b")).toBe("/a/b");
			expect(host.isCaseSensitive()).toBe(true);

			expect(host.readdirSync("/any")).toEqual([]);
			const stat = host.statSync(sampleFile);
			expect(stat.isDirectory()).toBe(false);
			expect(stat.isFile()).toBe(true);

			host.mkdirSync(tmpDir);
			host.writeFileSync(sampleFile, "world");
			expect(host.fileExistsSync(sampleFile)).toBe(true);
			expect(host.readFileSync(sampleFile)).toBe("world");
			host.deleteSync(sampleFile);
			host.moveSync("/a", "/b");
			host.copySync("/a", "/b");
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("exercises all branches of runJavyStdinIfPresent", async () => {
		const runner = vi.fn().mockResolvedValue(undefined);

		// 1. No __FsData
		runJavyStdinIfPresent(runner);
		expect(runner).not.toHaveBeenCalled();

		// 2. __FsData set, but no Javy.IO
		(globalThis as { __FsData?: unknown }).__FsData = { "/out.ts": "code" };
		runJavyStdinIfPresent(runner);
		expect(runner).not.toHaveBeenCalled();

		// 3. Javy.IO returns 0 bytes (empty stdinContent)
		(globalThis as { Javy?: unknown }).Javy = {
			IO: {
				readSync: () => 0,
			},
		};
		runJavyStdinIfPresent(runner);
		expect(runner).not.toHaveBeenCalled();

		// 4. Javy.IO throws EOF error after reading invalid JSON
		const errSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		let callCount = 0;
		(globalThis as { Javy?: unknown }).Javy = {
			IO: {
				readSync: (_fd: number, chunk: Uint8Array) => {
					callCount++;
					if (callCount === 1) {
						const bytes = new TextEncoder().encode("{bad json");
						chunk.set(bytes);
						return bytes.length;
					}
					throw new Error("EOF");
				},
			},
		};
		runJavyStdinIfPresent(runner);
		expect(errSpy).toHaveBeenCalledWith(
			"Failed to parse stdin:",
			expect.any(Error),
		);

		// 5. Valid JSON with input and args starting with "cdd-ts"
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const payload = JSON.stringify({
			input: { openapi: "3.0.0" },
			args: ["cdd-ts", "from_openapi", "to_sdk", "-i", "spec.json"],
		});
		let readDone = false;
		(globalThis as { Javy?: unknown }).Javy = {
			IO: {
				readSync: (_fd: number, chunk: Uint8Array) => {
					if (!readDone) {
						readDone = true;
						const bytes = new TextEncoder().encode(payload);
						chunk.set(bytes);
						return bytes.length;
					}
					return 0;
				},
			},
		};
		runJavyStdinIfPresent(runner);
		await new Promise((r) => setTimeout(r, 10));
		expect((globalThis as { __SPEC_JSON?: unknown }).__SPEC_JSON).toEqual({
			openapi: "3.0.0",
		});
		expect(runner).toHaveBeenCalledWith([
			"node",
			"cdd-ts",
			"from_openapi",
			"to_sdk",
			"-i",
			"spec.json",
		]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("JAVY_FS_DUMP:"),
		);

		// 6. Valid JSON with args NOT starting with "cdd-ts" and runner rejecting
		const failingRunner = vi.fn().mockRejectedValue(new Error("Runner failed"));
		const payload2 = JSON.stringify({
			args: ["to_openapi", "-i", "/spec.json"],
		});
		let readDone2 = false;
		(globalThis as { Javy?: unknown }).Javy = {
			IO: {
				readSync: (_fd: number, chunk: Uint8Array) => {
					if (!readDone2) {
						readDone2 = true;
						const bytes = new TextEncoder().encode(payload2);
						chunk.set(bytes);
						return bytes.length;
					}
					return 0;
				},
			},
		};
		runJavyStdinIfPresent(failingRunner);
		await new Promise((r) => setTimeout(r, 10));
		expect(failingRunner).toHaveBeenCalledWith([
			"node",
			"cdd-ts",
			"to_openapi",
			"-i",
			"/input.service.ts",
		]);
		expect(errSpy).toHaveBeenCalledWith(expect.any(Error));

		// 7. Valid JSON without input or args
		let readDone3 = false;
		(globalThis as { Javy?: unknown }).Javy = {
			IO: {
				readSync: (_fd: number, chunk: Uint8Array) => {
					if (!readDone3) {
						readDone3 = true;
						const bytes = new TextEncoder().encode("{}");
						chunk.set(bytes);
						return bytes.length;
					}
					return 0;
				},
			},
		};
		runJavyStdinIfPresent(runner);
	});
});

describe("cli/spec_writer & cli/scaffold", () => {
	it("loads package version and falls back to 1.0.0 when missing or invalid", () => {
		expect(loadPackageVersion(import.meta.url)).toBe("0.0.4");
		expect(loadPackageVersion("file:///non-existent/dir/mod.js")).toBe("1.0.0");

		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-pkg-ver-"));
		const subDir = path.join(tmpDir, "a", "b");
		fs.mkdirSync(subDir, { recursive: true });
		fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
		try {
			const fakeMetaUrl = `file://${path.join(subDir, "mod.js")}`;
			expect(loadPackageVersion(fakeMetaUrl)).toBe("1.0.0");
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("writes formatted specs and docs JSON to files and stdout", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-spec-writer-"));
		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		try {
			const jsonPath = path.join(tmpDir, "spec.json");
			const yamlPath = path.join(tmpDir, "spec.yaml");
			const docsPath = path.join(tmpDir, "docs.json");

			writeFormattedSpec({ openapi: "3.0.0" }, "json", jsonPath);
			expect(fs.readFileSync(jsonPath, "utf-8")).toContain(
				'"openapi": "3.0.0"',
			);

			writeFormattedSpec({ openapi: "3.0.0" }, "yaml", yamlPath);
			expect(fs.readFileSync(yamlPath, "utf-8")).toContain("openapi: 3.0.0");

			writeFormattedSpec({ openapi: "3.0.0" }, "json");
			expect(stdoutSpy).toHaveBeenCalled();

			writeDocsJsonOutput({ endpoints: {} }, docsPath);
			expect(fs.readFileSync(docsPath, "utf-8")).toContain('"endpoints"');

			writeDocsJsonOutput({ endpoints: {} });
			expect(stdoutSpy).toHaveBeenCalled();

			// Scaffold tests for to_server with typeorm and to_sdk with tests: false
			const serverDir = path.join(tmpDir, "server");
			fs.mkdirSync(serverDir, { recursive: true });
			emitPackageScaffolding(
				serverDir,
				{ options: { orm: "typeorm", tests: true } },
				"to_server",
			);
			const pkgJson = JSON.parse(
				fs.readFileSync(path.join(serverDir, "package.json"), "utf-8"),
			) as { name: string; dependencies: Record<string, string> };
			expect(pkgJson.name).toBe("generated-server");
			expect(pkgJson.dependencies.typeorm).toBeDefined();
			expect(pkgJson.dependencies["better-sqlite3"]).toBe("^12.0");
			expect(fs.existsSync(path.join(serverDir, "vitest.config.ts"))).toBe(
				true,
			);
			expect(fs.existsSync(path.join(serverDir, "README.md"))).toBe(true);

			const sdkDir = path.join(tmpDir, "sdk");
			fs.mkdirSync(sdkDir, { recursive: true });
			emitPackageScaffolding(sdkDir, { options: { tests: false } }, "to_sdk");
			emitGithubActionsScaffolding(sdkDir);
			expect(
				fs.existsSync(path.join(sdkDir, ".github", "workflows", "ci.yml")),
			).toBe(true);

			const sdkWithTestsDir = path.join(tmpDir, "sdk-with-tests");
			fs.mkdirSync(sdkWithTestsDir, { recursive: true });
			emitPackageScaffolding(
				sdkWithTestsDir,
				{ options: { tests: true } },
				"to_sdk",
			);
			const sdkPkgJson = JSON.parse(
				fs.readFileSync(path.join(sdkWithTestsDir, "package.json"), "utf-8"),
			) as {
				name: string;
				devDependencies: Record<string, string>;
			};
			expect(sdkPkgJson.devDependencies.vitest).toBeDefined();
			expect(sdkPkgJson.devDependencies.typescript).toBeDefined();
			expect(sdkPkgJson.devDependencies["@types/node"]).toBeDefined();
			const sdkVitestConfig = fs.readFileSync(
				path.join(sdkWithTestsDir, "vitest.config.ts"),
				"utf-8",
			);
			expect(sdkVitestConfig).toContain('include: ["src/**/*.spec.ts"]');
		} finally {
			stdoutSpy.mockRestore();
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("generates an SDK with --tests and executes npx vitest run successfully inside the generated SDK directory", async () => {
		const { execFileSync } = await import("node:child_process");
		const { generateFromOpenApi } = await import(
			"../../src/cli/commands/from_openapi.js"
		);

		const tmpSdkDir = fs.mkdtempSync(
			path.join(process.cwd(), "tmp-sdk-vitest-"),
		);
		const specPath = path.join(tmpSdkDir, "openapi.json");
		try {
			fs.writeFileSync(
				specPath,
				JSON.stringify({
					openapi: "3.0.0",
					info: { title: "Petstore SDK Test", version: "1.0.0" },
					paths: {
						"/pets": {
							get: {
								tags: ["pet"],
								operationId: "listPets",
								responses: {
									"200": {
										description: "ok",
										content: {
											"application/json": {
												schema: { type: "array", items: { type: "object" } },
											},
										},
									},
								},
							},
						},
					},
				}),
			);

			const sdkOutDir = path.join(tmpSdkDir, "generated-sdk");
			await generateFromOpenApi(
				{
					input: specPath,
					output: sdkOutDir,
					tests: true,
				},
				"to_sdk",
			);

			expect(fs.existsSync(path.join(sdkOutDir, "vitest.config.ts"))).toBe(
				true,
			);
			expect(
				fs.existsSync(path.join(sdkOutDir, "src", "integration.spec.ts")),
			).toBe(true);
			expect(
				fs.existsSync(
					path.join(sdkOutDir, "src", "services", "pet.client.spec.ts"),
				),
			).toBe(true);

			const output = execFileSync("npx", ["vitest", "run"], {
				cwd: sdkOutDir,
				encoding: "utf-8",
			});
			expect(output).toContain("2 passed");
			expect(output).toContain("4 passed");
		} finally {
			fs.rmSync(tmpSdkDir, { recursive: true, force: true });
		}
	});
});

describe("cli commands & generator branch coverage", () => {
	afterEach(() => {
		delete (globalThis as { __FsData?: unknown }).__FsData;
		vi.restoreAllMocks();
	});

	it("covers multiple operations per controller in AbstractClientGenerator.groupPathsByCanonicalController", async () => {
		const { AbstractClientGenerator } = await import(
			"../../src/core/generator.js"
		);
		const { SwaggerParser } = await import("../../src/openapi/parse.js");
		const parser = new SwaggerParser(
			{
				openapi: "3.1.0",
				info: { title: "MultiOp", version: "1.0.0" },
				paths: {
					"/users": {
						get: {
							tags: ["Users"],
							operationId: "getUsers",
							responses: { "200": { description: "ok" } },
						},
						post: {
							tags: ["Users"],
							operationId: "createUser",
							responses: { "201": { description: "created" } },
						},
					},
				},
			},
			{
				input: "mem.json",
				output: "/out",
				options: { framework: "vanilla" },
			},
		);
		const grouped =
			AbstractClientGenerator.groupPathsByCanonicalController(parser);
		expect(grouped.Users?.length).toBe(2);
	});

	it("covers all CLI option branches in generateFromOpenApi, generateToOpenApi, syncDir, and generateFromArazzoSync", async () => {
		const indexMod = await import("../../src/index.js");
		const genSyncSpy = vi
			.spyOn(indexMod, "generateFromConfigSync")
			.mockImplementation(() => undefined);
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		const errSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const { generateFromOpenApi } = await import(
			"../../src/cli/commands/from_openapi.js"
		);
		const { generateToOpenApi, generateDocsJson } = await import(
			"../../src/cli/commands/to_openapi.js"
		);
		const { syncDir } = await import(
			"../../src/cli/commands/sync_and_github.js"
		);
		const { generateFromArazzoSync, registerFromArazzoCommands } = await import(
			"../../src/cli/commands/from_arazzo.js"
		);
		const { Command } = await import("commander");

		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-cli-branches-"));
		const origArgv = [...process.argv];
		try {
			// 1. Config file exporting named `config` and direct object
			const namedCfgPath = path.join(tmpDir, "named-cfg.mjs");
			fs.writeFileSync(
				namedCfgPath,
				`export const config = { input: "http://example.com/api.json", output: "${path.join(tmpDir, "out1")}" };`,
			);
			await generateFromOpenApi(
				{
					config: namedCfgPath,
					framework: "express",
					testGen: false,
					mcp: true,
					tests: true,
					orm: "typeorm",
					int64Type: "bigint",
					platform: "node",
					customHeader: ["X-Api-Key: secret:value", "MalformedHeader"],
					installablePackage: false,
					githubActions: false,
				},
				"to_server",
			);
			expect(genSyncSpy).toHaveBeenCalled();

			// 2. extractArg fallback from process.argv (`-i=spec.json` and `-o out`) and tests string option & __FsData dump
			(globalThis as { __FsData?: unknown }).__FsData = { "/mem.ts": "1" };
			process.argv = [
				"node",
				"cli.js",
				"--unrelated",
				"-i=http://example.com/spec.json",
				"-o",
				path.join(tmpDir, "out2"),
			];
			await generateFromOpenApi(
				{
					tests: "false",
					installablePackage: false,
					githubActions: false,
				},
				"to_sdk",
			);
			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining("JAVY_FS_DUMP:"),
			);
			delete (globalThis as { __FsData?: unknown }).__FsData;

			// 3. extractArg `--input` and `--output=`
			process.argv = [
				"node",
				"cli.js",
				"--input",
				"http://example.com/spec2.json",
				`--output=${path.join(tmpDir, "out3")}`,
			];
			await generateFromOpenApi({
				tests: "true",
				input: "http://example.com/spec2.json",
				output: path.join(tmpDir, "out3"),
				installablePackage: false,
				githubActions: false,
			});

			// 4. to_openapi with orm="typeorm" and non-Error throws in fallbacks
			const entityDir = path.join(tmpDir, "entities");
			const servicesDir = path.join(entityDir, "services");
			fs.mkdirSync(servicesDir, { recursive: true });
			fs.writeFileSync(
				path.join(servicesDir, "users.service.ts"),
				`export class UsersService {
					async getUsers(): Promise<string> {
						const res = await fetch("/users", { method: "GET" });
						return res.text();
					}
				}`,
			);
			fs.writeFileSync(
				path.join(entityDir, "user.entity.ts"),
				`import { Entity, PrimaryGeneratedColumn } from "typeorm";
				@Entity()
				export class User {
					@PrimaryGeneratedColumn()
					id!: number;
				}`,
			);
			const ormSpec = await generateToOpenApi(
				{
					input: entityDir,
					format: "json",
					orm: "typeorm",
				},
				true,
			);
			expect(ormSpec).toBeDefined();

			// 5. syncDir branches (class, typeorm, failed spec extraction, arazzo without output, unsupported truth, and MCP command action)
			await syncDir({ input: entityDir, truth: "typeorm" });
			await syncDir({ input: entityDir, truth: "class" });

			const exitSpy = vi
				.spyOn(process, "exit")
				.mockImplementation(() => undefined as never);
			await syncDir({ input: entityDir, truth: "unknown_truth" });
			expect(exitSpy).toHaveBeenCalledWith(1);

			const { registerSyncAndMcpCommands } = await import(
				"../../src/cli/commands/sync_and_github.js"
			);
			const mcpMod = await import("../../src/mcp_server.js");
			const serveMcpSpy = vi
				.spyOn(mcpMod, "serveMcp")
				.mockResolvedValue(undefined);
			const syncProg = new Command();
			registerSyncAndMcpCommands(syncProg);
			await syncProg.parseAsync(["node", "cli.js", "mcp"]);
			expect(serveMcpSpy).toHaveBeenCalled();
			serveMcpSpy.mockRestore();

			// 6. from_arazzo scope branches ("cli", "server", and undefined output option)
			const arazzoSpec = {
				arazzo: "1.1.0",
				info: { title: "Flow", version: "1.0.0" },
				sourceDescriptions: [{ name: "api", url: "./openapi.json" }],
				workflows: [
					{
						workflowId: "wf1",
						steps: [{ stepId: "s1", operationId: "op1" }],
					},
				],
			};
			const arazzoOutCli = path.join(tmpDir, "arazzo-cli");
			const arazzoOutServer = path.join(tmpDir, "arazzo-server");
			generateFromArazzoSync(arazzoSpec, arazzoOutCli, "cli", false);
			generateFromArazzoSync(arazzoSpec, arazzoOutServer, "server", false);
			expect(fs.existsSync(path.join(arazzoOutCli, "workflows"))).toBe(true);
			const prevCwd = process.cwd();
			process.chdir(tmpDir);
			try {
				await syncDir({ input: arazzoOutCli, truth: "arazzo" });
				expect(fs.existsSync(path.join(tmpDir, "arazzo.json"))).toBe(true);
			} finally {
				process.chdir(prevCwd);
			}

			const prog = new Command();
			registerFromArazzoCommands(prog);
			const toSdkCmd = prog.commands
				.find((c) => c.name() === "from_arazzo")
				?.commands.find((c) => c.name() === "to_sdk");
			expect(toSdkCmd).toBeDefined();

			// 7. generateDocsJson with explicit framework
			const specFilePath = path.join(tmpDir, "openapi.json");
			fs.writeFileSync(
				specFilePath,
				JSON.stringify({
					openapi: "3.0.0",
					info: { title: "Docs", version: "1.0.0" },
					paths: {},
				}),
			);
			const docsObj = await generateDocsJson(
				{
					input: specFilePath,
					imports: true,
					wrapping: true,
					framework: "react",
				},
				true,
			);
			expect(docsObj).toBeDefined();

			// Javy WASM mode (__FsData active) branches for generateToOpenApi and generateDocsJson
			(globalThis as { __FsData?: unknown }).__FsData = {};
			(globalThis as { __SPEC_JSON?: unknown }).__SPEC_JSON = JSON.stringify({
				openapi: "3.0.0",
				info: { title: "Docs", version: "1.0.0" },
				paths: {},
			});
			await generateDocsJson(
				{
					input: specFilePath,
					output: path.join(tmpDir, "wasm-docs.json"),
					imports: true,
					wrapping: true,
				},
				false,
			);
			await generateToOpenApi(
				{
					input: path.join(servicesDir, "users.service.ts"),
					output: path.join(tmpDir, "wasm-openapi.json"),
					format: "json",
				},
				false,
			);
			delete (globalThis as { __FsData?: unknown }).__FsData;
			delete (globalThis as { __SPEC_JSON?: unknown }).__SPEC_JSON;

			const { formatCliError } = await import(
				"../../src/cli/commands/to_openapi.js"
			);
			expect(formatCliError(new Error("boom"))).toBe("boom");
			expect(formatCliError("raw")).toBe("raw");
			expect(formatCliError("raw", true)).toBe("Unknown error: raw");

			// Direct module exports config (neither .default nor .config)
			const directCfgPath = path.join(tmpDir, "direct-cfg.mjs");
			fs.writeFileSync(
				directCfgPath,
				`export const input = "http://example.com/api.json"; export const output = "${path.join(tmpDir, "out-direct")}";`,
			);
			await generateFromOpenApi({
				config: directCfgPath,
				installablePackage: false,
				githubActions: false,
			});

			// Config file throwing Error instance
			const errCfgPath = path.join(tmpDir, "err-cfg.mjs");
			fs.writeFileSync(errCfgPath, `throw new Error("Syntax boom");`);
			await expect(generateFromOpenApi({ config: errCfgPath })).rejects.toThrow(
				"Failed to load configuration file: Syntax boom",
			);

			// Non-Error thrown in executeFromOpenApiSubcommand
			genSyncSpy.mockImplementationOnce(() => {
				throw "raw string failure";
			});
			const exitSpy2 = vi
				.spyOn(process, "exit")
				.mockImplementation(() => undefined as never);
			const prog2 = new Command();
			const { registerFromOpenApiCommands } = await import(
				"../../src/cli/commands/from_openapi.js"
			);
			registerFromOpenApiCommands(prog2);
			await prog2.parseAsync([
				"node",
				"cli.js",
				"from_openapi",
				"to_sdk",
				"-i",
				"http://example.com/spec.json",
				"-o",
				path.join(tmpDir, "out-err"),
			]);
			expect(exitSpy2).toHaveBeenCalledWith(1);
		} finally {
			process.argv = origArgv;
			genSyncSpy.mockRestore();
			logSpy.mockRestore();
			warnSpy.mockRestore();
			errSpy.mockRestore();
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});
