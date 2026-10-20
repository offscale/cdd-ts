import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import type { GeneratorConfig, PathInfo } from "../../src/core/types/index.js";
import type { SwaggerParser } from "../../src/openapi/parse.js";
import { CliGenerator } from "../../src/vendors/cli/emit.js";
import { createTestSpec } from "../shared/helpers.js";

describe("CliGenerator", () => {
	const defaultConfig: GeneratorConfig = {
		input: "memory://spec.json",
		output: "/out",
		options: {},
	};

	it("should generate cli.ts with correct imports and commands", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new CliGenerator();

		const operations: PathInfo[] = [
			{
				tags: ["Users"],
				operationId: "getUser",
				path: "/users/{id}",
				method: "GET",
				summary: "Get User",
				parameters: [{ name: "id", in: "path", required: true }],
			},
			{
				tags: ["Posts"],
				path: "/posts",
				method: "GET",
				description: "List Posts",
			},
			{
				path: "/no-tag",
				method: "POST",
				summary: "No Tag",
				requestBody: { content: {} },
			},
		];

		const mockParser: Pick<SwaggerParser, "spec" | "operations"> = {
			spec: {
				openapi: "3.1.0",
				info: { title: "api-cli", version: "1.0.0", description: "Test CLI" },
				servers: [{ url: "http://api.example.com" }],
				components: {
					securitySchemes: {
						BearerAuth: { type: "http", scheme: "bearer" },
					},
				},
			},
			operations,
		};

		generator.generate(project, mockParser, defaultConfig, "/out");

		const cliFile = project.getSourceFileOrThrow("/out/cli.ts");
		const text = cliFile.getFullText();

		expect(text).toContain('import { Command, Option } from "commander";');
		expect(text).toContain('import * as services from "./services/index.js";');
		expect(text).toContain("program.name('api-cli')");

		expect(text).toContain("const usersCommand = program.command('users')");
		expect(text).toContain(".description('Get User')");
		expect(text).toContain("const postsCommand = program.command('posts')");
		expect(text).toContain("const defaultCommand = program.command('default')");
		expect(text).toContain(".description('No Tag')");
		expect(text).toContain("const client = new services.UsersService();");
	});

	it("should generate cli.ts with coverage for openIdConnect, externalDocs, deprecated, and callbacks", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new CliGenerator();

		const operations: PathInfo[] = [
			{
				tags: ["Complex"],
				operationId: "complexOp",
				path: "/complex",
				method: "POST",
				summary: "Complex Operation",
				externalDocs: { description: "Docs", url: "https://docs.com" },
				deprecated: true,
				callbacks: { myCallback: {} },
			},
		];

		const mockParser: Pick<SwaggerParser, "spec" | "operations"> = {
			spec: {
				openapi: "3.1.0",
				info: {
					title: "api-cli-full",
					version: "1.0.0",
					description: "Test CLI",
					contact: {
						name: "Support",
						email: "support@example.com",
						url: "https://support.com",
					},
					license: { name: "MIT", identifier: "MIT", url: "https://mit.com" },
					termsOfService: "https://tos.com",
				},
				externalDocs: {
					description: "Spec Docs",
					url: "https://spec.docs.com",
				},
				servers: [
					{
						url: "http://api.example.com/{version}",
						variables: {
							version: {
								enum: ["v1", "v2"],
								description: "API Version",
								default: "v1",
							},
						},
					},
				],
				components: {
					securitySchemes: {
						OidcAuth: {
							type: "openIdConnect",
							openIdConnectUrl: "https://example.com/oidc",
							description: "OIDC token",
						},
						DeprecatedAuth: { type: "http", scheme: "basic", deprecated: true },
						OAuth2Auth: {
							type: "oauth2",
							description: "OAuth2 auth",
							flows: { implicit: {}, authorizationCode: {} },
							oauth2MetadataUrl: "https://example.com/oauth2",
						},
					},
				},
			},
			operations,
		};

		generator.generate(
			project,
			mockParser as SwaggerParser,
			defaultConfig,
			"/out",
		);

		const cliFile = project.getSourceFileOrThrow("/out/cli.ts");
		const text = cliFile.getFullText();

		expect(text).toContain("External Docs: Spec Docs https://spec.docs.com");
		expect(text).toContain(
			"// Server variable: version (enum: v1,v2) - API Version",
		);
		expect(text).toContain(
			"// OAuth2 Flows supported: implicit, authorizationCode",
		);
		expect(text).toContain(
			"program.option('--auth-oauth2auth <token>', 'OAuth2 auth');",
		);
		expect(text).toContain("// OAuth2 Metadata: https://example.com/oauth2");
		expect(text).toContain("// OpenID Connect URL: https://example.com/oidc");
		expect(text).toContain(
			"program.option('--auth-oidcauth <token>', 'OIDC token');",
		);
		expect(text).toContain("// Deprecated security scheme: DeprecatedAuth");
		expect(text).toContain("External Docs: Docs https://docs.com");
		expect(text).toContain("// Deprecated operation");
		expect(text).toContain("// Supports Callbacks");
	});

	it("should handle minimal/fallback metadata and optional/duplicate parameters in CliGenerator", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new CliGenerator();

		const operations: PathInfo[] = [
			{
				tags: [""],
				path: "/minimal",
				method: "GET",
				externalDocs: { url: "" },
				parameters: [
					{ name: "opt", in: "query", required: false },
					{ name: "opt", in: "query", required: false },
					{ name: "", in: "query" },
				],
			},
		];

		const mockParser: Pick<SwaggerParser, "spec" | "operations"> = {
			spec: createTestSpec({
				openapi: "3.1.0",
				info: {
					title: "",
					version: "",
					summary: "Summary fallback",
					contact: {},
					license: {},
				},
				externalDocs: { url: "" },
				servers: [
					{
						url: "http://api.example.com",
						variables: {
							env: { default: "" },
						},
					},
				],
				components: {
					securitySchemes: {
						ApiKeyAuth: { type: "apiKey", in: "header", name: "X-Key" },
						OAuth2Minimal: { type: "oauth2" },
						OidcMinimal: {
							type: "openIdConnect",
							openIdConnectUrl: "https://oidc",
						},
						MutualTLS: { type: "mutualTLS" },
					},
				},
			}),
			operations,
		};

		generator.generate(project, mockParser, defaultConfig, "/out");

		const text = project.getSourceFileOrThrow("/out/cli.ts").getFullText();
		expect(text).toContain("program.name('api-cli')");
		expect(text).toContain(".description('Summary fallback')");
		expect(text).toContain(".option('--opt [value]', '')");

		// Also test completely omitted info, servers, and securitySchemes
		const project2 = new Project({ useInMemoryFileSystem: true });
		generator.generate(
			project2,
			{
				spec: createTestSpec({ openapi: "3.1.0" }),
				operations: [{ path: "/bare", method: "GET" }],
			},
			defaultConfig,
			"/out2",
		);
		expect(
			project2.getSourceFileOrThrow("/out2/cli.ts").getFullText(),
		).toContain("CLI for API generated by cdd-ts");
	});
});
