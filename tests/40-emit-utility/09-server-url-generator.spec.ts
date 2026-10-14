import { SwaggerParser } from "@src/openapi/parse.js";
import { ServerUrlGenerator } from "@src/routes/emit_server_url.js";
import type { Project } from "ts-morph";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
	createTestProject,
	type TestValue,
	testCast,
} from "../shared/helpers.js";

describe("Emitter: ServerUrlGenerator", () => {
	const runGenerator = (servers: unknown): Project => {
		const project = createTestProject();
		const parser = new SwaggerParser(
			testCast({
				openapi: "3.2.0",
				info: { title: "Test", version: "1.0" },
				paths: {},
				servers,
			}),
			testCast({ options: {} }),
		);

		new ServerUrlGenerator(parser, project).generate("/out");
		return project;
	};

	const compileHelper = (project: Project) => {
		const sourceFile = project.getSourceFileOrThrow("/out/utils/server-url.ts");
		const startText = sourceFile.getText();
		const jsCode = ts.transpile(startText.replace(/export /g, ""), {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.CommonJS,
		});

		const moduleScope = {
			API_SERVERS: [],
			getServerUrl: testCast(null),
			resolveServerUrl: testCast(null),
		};
		testCast(
			new Function(
				"scope",
				`
            ${jsCode} 
            scope.API_SERVERS = API_SERVERS; 
            scope.getServerUrl = getServerUrl; 
            scope.resolveServerUrl = resolveServerUrl;
        `,
			)(moduleScope),
		);
		return moduleScope;
	};

	it("should generate file with default server if no servers are defined (OAS 3.x)", () => {
		const project = runGenerator(testCast([]));
		const sourceFile = project.getSourceFile("/out/utils/server-url.ts");
		expect(sourceFile).toBeDefined();
		expect(sourceFile?.getText()).toContain('"url": "/"');
	});

	it("should generate API_SERVERS constant checking OAS 3.2 name property", () => {
		const project = testCast(
			testCast(
				testCast(
					runGenerator([
						testCast({
							url: testCast("https://api.example.com"),
							name: "production",
							description: testCast("Production"),
						}),
					]),
				),
			),
		);
		const text = project
			.getSourceFileOrThrow("/out/utils/server-url.ts")
			.getText();
		expect(text).toContain(
			"export const API_SERVERS: ServerConfiguration[] = [",
		);
		// Resolution updates URLs to be absolute and normalized (trailing slash for domains)
		expect(text).toContain('"url": "https://api.example.com/"');
		expect(text).toContain('"name": "production"');
	});

	it("should preserve x- extensions and allow them in server metadata types", () => {
		const project = testCast(
			runGenerator([
				testCast({
					url: testCast("https://api.example.com"),
					name: "prod",
					"x-server": testCast("alpha"),
					variables: testCast({
						env: testCast({
							default: testCast("dev"),
							"x-var": testCast("meta"),
						}),
					}),
				}),
			]),
		);

		const { API_SERVERS } = compileHelper(testCast(project));
		expect(API_SERVERS[0]["x-server"]).toBe("alpha");

		expect(testCast(API_SERVERS[0]).variables?.env["x-var"]).toBe("meta");

		const sourceFile = project.getSourceFileOrThrow("/out/utils/server-url.ts");
		expect(
			sourceFile.getInterfaceOrThrow("ServerConfiguration").getIndexSignatures()
				.length,
		).toBe(1);
		expect(
			sourceFile.getInterfaceOrThrow("ServerVariable").getIndexSignatures()
				.length,
		).toBe(1);
	});

	it("should generate logic to substitute simple variables", () => {
		const project = testCast(
			runGenerator([
				testCast({
					url: testCast("https://{env}.example.com/v1"),
					variables: testCast({ env: testCast({ default: testCast("dev") }) }),
				}),
			]),
		);

		const { getServerUrl } = compileHelper(testCast(project));

		// Template URLs starting with { are NOT resolved/normalized by parser, ensuring variables are preserved
		// but URLs like https://{var} are resolved by URL() constructor which encodes {}.
		// The parser decodes them back.
		// Trailing slash is added to the *pathless* root of the resolved URL by standard URL normalization.
		// https://{env}.example.com/v1 -> path is /v1, no trailing slash added to root.

		// Use default

		expect(getServerUrl(0)).toBe("https://dev.example.com/v1");
		// Override

		expect(getServerUrl(0, { env: "prod" })).toBe(
			"https://prod.example.com/v1",
		);
	});

	it("should throw error if variable value is not in enum", () => {
		const project = testCast(
			runGenerator([
				testCast({
					url: testCast("https://{region}.api.com"),
					variables: testCast({
						region: testCast({
							default: testCast("us"),
							enum: testCast(["us", "eu", "asia"]),
						}),
					}),
				}),
			]),
		);

		const { getServerUrl } = compileHelper(testCast(project));

		// Valid - Note: URL normalization adds trailing slash to the template base
		// e.g., https://{region}.api.com/

		expect(getServerUrl(0, { region: "eu" })).toBe("https://eu.api.com/");
		// Invalid

		expect(() => getServerUrl(0, { region: "mars" })).toThrow(
			'Value "mars" for variable "region" is not in the allowed enum: us, eu, asia',
		);
	});

	it("should generate logic to look up server by name (OAS 3.2)", () => {
		const project = testCast(
			testCast(
				testCast(
					runGenerator([
						testCast({
							url: testCast("https://dev.api.com"),
							name: "dev",
							description: testCast("Development"),
						}),
						testCast({
							url: testCast("https://prod.api.com"),
							name: "prod",
							description: testCast("Production"),
						}),
					]),
				),
			),
		);

		const { getServerUrl } = compileHelper(testCast(project));

		// Expect trailing slashes due to URL normalization

		expect(getServerUrl("prod")).toBe("https://prod.api.com/");

		expect(getServerUrl("dev")).toBe("https://dev.api.com/");
	});

	it("should resolve server URLs from a custom server list", () => {
		const project = testCast(
			testCast(
				testCast(
					runGenerator([
						testCast({
							url: testCast("https://global.api.com"),
							name: "global",
						}),
					]),
				),
			),
		);

		const { resolveServerUrl } = compileHelper(testCast(project));
		const customServers = [
			{ url: "https://custom.api.com", name: "custom" },
			{ url: "https://alt.api.com", description: "Alternative" },
		];

		expect(resolveServerUrl(customServers, "custom")).toBe(
			"https://custom.api.com",
		);

		expect(resolveServerUrl(customServers, "Alternative")).toBe(
			"https://alt.api.com",
		);
	});

	it("should generate logic to look up server by description (Legacy fallback)", () => {
		const project = testCast(
			testCast(
				testCast(
					runGenerator([
						testCast({
							url: testCast("https://dev.api.com"),
							description: testCast("Development"),
						}),
						testCast({
							url: testCast("https://prod.api.com"),
							description: testCast("Production"),
						}),
					]),
				),
			),
		);

		const { getServerUrl } = compileHelper(testCast(project));

		expect(getServerUrl("Production")).toBe("https://prod.api.com/");

		expect(getServerUrl("Development")).toBe("https://dev.api.com/");
	});

	it("should throw error if server is not found", () => {
		const project = testCast(
			testCast(testCast(runGenerator([testCast({ url: testCast("/") })]))),
		);

		const { getServerUrl } = compileHelper(testCast(project));

		expect(() => getServerUrl(99)).toThrow("Server not found: 99");

		expect(() => getServerUrl("Unknown")).toThrow("Server not found: Unknown");
	});

	it("should handle multiple variables", () => {
		const project = testCast(
			runGenerator([
				testCast({
					url: testCast("{protocol}://{host}:{port}/{base}"),
					variables: testCast({
						protocol: testCast({ default: testCast("https") }),
						host: testCast({ default: testCast("localhost") }),
						port: testCast({ default: testCast("8080") }),
						base: testCast({ default: testCast("api") }),
					}),
				}),
			]),
		);

		const { getServerUrl } = compileHelper(testCast(project));

		// Use Defaults. Note: Parser skips resolution for URLs starting with {
		// So no normalization occurs.

		expect(getServerUrl(0)).toBe("https://localhost:8080/api");
		// Partial override

		expect(getServerUrl(0, { port: "3000", protocol: "http" })).toBe(
			"http://localhost:3000/api",
		);
	});

	it("should fall back to default server when parser.servers is undefined", () => {
		const project = createTestProject();
		const parser = new SwaggerParser(
			testCast({
				openapi: "3.2.0",
				info: { title: "No Servers", version: "1.0" },
				paths: {},
			}),
			testCast({ options: {} }),
		);
		// Force undefined to exercise defensive fallback path

		testCast<TestValue>(parser).servers = testCast(undefined);

		new ServerUrlGenerator(parser, project).generate("/out");
		const sourceFile = project.getSourceFileOrThrow("/out/utils/server-url.ts");
		expect(sourceFile.getText()).toContain('"url": "/"');
	});
});
