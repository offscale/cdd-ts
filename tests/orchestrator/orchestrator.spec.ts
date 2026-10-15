import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
	GeneratorConfig,
	PathInfo,
	SwaggerSpec,
} from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { AngularClientGenerator } from "@src/vendors/angular/angular-client.generator.js";
import { AuthInterceptorGenerator } from "@src/vendors/angular/utils/auth-interceptor.generator.js";
import { Project } from "ts-morph";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@src/vendors/angular/service/service.generator.js", () => {
	return {
		ServiceGenerator: class {
			generate(_out: string, _groups: Record<string, PathInfo[]>) {
				if (!fs.existsSync(path.join(_out, "services"))) {
					fs.mkdirSync(path.join(_out, "services"), { recursive: true });
				}
				fs.writeFileSync(
					path.join(_out, "services/user.service.spec.ts"),
					"// Mock Spec",
				);
			}
		},
	};
});

const fullSpec: SwaggerSpec = {
	openapi: "3.0.0",
	info: { title: "Orchestrator Spec", version: "1.0" },
	paths: {
		"/users": {
			get: {
				tags: ["User"],
				responses: { "200": { description: "ok" } },
				callbacks: {
					onUser: {
						"{$request.query.userId}": {
							post: { responses: { "200": { description: "ok" } } },
						},
					},
				},
			},
		},
	},
	tags: [
		{ name: "User", description: "User management" },
		{ name: "Admin", description: "Admin access" },
	],
	components: {
		securitySchemes: {
			ApiKey: { type: "apiKey", name: "x-api-key", in: "header" },
		},
		schemas: {
			User: { type: "object", properties: { name: { type: "string" } } },
		},
		examples: {
			Sample: { summary: "Example", dataValue: { id: 1 } },
		},
		mediaTypes: {
			EventStream: { schema: { type: "string" } },
		},
		pathItems: {
			Ping: { get: { responses: { "200": { description: "pong" } } } },
		},
	},
	servers: [{ url: "https://api.test.com" }],
	webhooks: {
		userCreated: { post: { responses: { "200": { description: "ok" } } } },
	},
};

describe("Generators: AngularClientGenerator (Orchestrator)", () => {
	const testOutputDir = path.join(os.tmpdir(), "cdd_ts_temp_gen_out");
	const pathsOutputDir = path.join(os.tmpdir(), "cdd_ts_temp_gen_out_paths");
	const tokensOutputDir = path.join(os.tmpdir(), "cdd_ts_temp_gen_out_tokens");

	const cleanup = () => {
		for (const dir of [testOutputDir, pathsOutputDir, tokensOutputDir]) {
			if (fs.existsSync(dir)) {
				fs.rmSync(dir, { recursive: true, force: true });
			}
		}
	};

	afterAll(() => {
		cleanup();
	});

	it("should orchestrate the generation of all utility files including tags", async () => {
		cleanup();

		const config: GeneratorConfig = {
			input: "",
			output: testOutputDir,
			clientName: "TestClient",
			options: {
				framework: "angular",
				dateType: "string",
				enumStyle: "enum",
				generateServices: true,
				tests: true,
			},
		};

		const project = new Project();
		const parser = new SwaggerParser(fullSpec, config);
		const generator = new AngularClientGenerator();

		generator.generate(project, parser, config, testOutputDir);
		await project.save();

		expect(fs.existsSync(path.join(testOutputDir, "callbacks.ts"))).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "webhooks.ts"))).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "links.ts"))).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "discriminators.ts"))).toBe(
			true,
		);
		expect(fs.existsSync(path.join(testOutputDir, "security.ts"))).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "servers.ts"))).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "tags.ts"))).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "examples.ts"))).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "media-types.ts"))).toBe(
			true,
		);
		expect(fs.existsSync(path.join(testOutputDir, "path-items.ts"))).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "document.ts"))).toBe(true);
		expect(
			fs.existsSync(path.join(testOutputDir, "openapi.snapshot.json")),
		).toBe(true);
		expect(
			fs.existsSync(path.join(testOutputDir, "openapi.snapshot.yaml")),
		).toBe(true);

		expect(
			fs.existsSync(
				path.join(testOutputDir, "services", "user.service.spec.ts"),
			),
		).toBe(true);
		expect(fs.existsSync(path.join(testOutputDir, "tokens", "index.ts"))).toBe(
			true,
		);
	});

	it("should contain expected content in framework agnostic files", async () => {
		const serverFile = fs.readFileSync(
			path.join(testOutputDir, "servers.ts"),
			"utf-8",
		);
		expect(serverFile).toContain("API_SERVERS");
		expect(serverFile).toContain("https://api.test.com");

		const securityFile = fs.readFileSync(
			path.join(testOutputDir, "security.ts"),
			"utf-8",
		);
		expect(securityFile).toContain("API_SECURITY_SCHEMES");
		expect(securityFile).toContain("ApiKey");

		const tagsFile = fs.readFileSync(
			path.join(testOutputDir, "tags.ts"),
			"utf-8",
		);
		expect(tagsFile).toContain("API_TAGS");
		expect(tagsFile).toContain("User management");

		const examplesFile = fs.readFileSync(
			path.join(testOutputDir, "examples.ts"),
			"utf-8",
		);
		expect(examplesFile).toContain("API_EXAMPLES");

		const mediaTypesFile = fs.readFileSync(
			path.join(testOutputDir, "media-types.ts"),
			"utf-8",
		);
		expect(mediaTypesFile).toContain("API_MEDIA_TYPES");

		const pathItemsFile = fs.readFileSync(
			path.join(testOutputDir, "path-items.ts"),
			"utf-8",
		);
		expect(pathItemsFile).toContain("API_PATH_ITEMS");
	});

	it("should derive controller names from path segments when tags are missing", async () => {
		if (fs.existsSync(pathsOutputDir)) {
			fs.rmSync(pathsOutputDir, { recursive: true, force: true });
		}

		const spec: SwaggerSpec = {
			openapi: "3.0.0",
			info: { title: "Paths Only", version: "1.0" },
			paths: {
				"/": {
					get: {
						operationId: "rootGet",
						responses: { "200": { description: "ok" } },
					},
				},
				"/items": {
					get: {
						operationId: "listItems",
						responses: { "200": { description: "ok" } },
					},
				},
			},
		};

		const config: GeneratorConfig = {
			input: "",
			output: pathsOutputDir,
			options: {
				framework: "angular",
				dateType: "string",
				enumStyle: "enum",
				generateServices: true,
				generateServiceTests: true,
			},
		};

		const project = new Project();
		const parser = new SwaggerParser(spec, config);
		const generator = new AngularClientGenerator();

		generator.generate(project, parser, config, pathsOutputDir);
		await project.save();

		expect(
			fs.existsSync(
				path.join(pathsOutputDir, "services", "default.service.spec.ts"),
			),
		).toBe(true);
		expect(
			fs.existsSync(
				path.join(pathsOutputDir, "services", "items.service.spec.ts"),
			),
		).toBe(true);
	});

	it("should default token names when auth interceptor returns undefined", async () => {
		if (fs.existsSync(tokensOutputDir)) {
			fs.rmSync(tokensOutputDir, { recursive: true, force: true });
		}

		const specWithSecurity: SwaggerSpec = {
			openapi: "3.0.0",
			info: { title: "Security", version: "1.0" },
			paths: {
				"/secure": { get: { responses: { "200": { description: "ok" } } } },
			},
			components: {
				securitySchemes: {
					ApiKey: { type: "apiKey", name: "x-api-key", in: "header" },
				},
			},
		};

		const config: GeneratorConfig = {
			input: "",
			output: tokensOutputDir,
			options: {
				framework: "angular",
				dateType: "string",
				enumStyle: "enum",
				generateServices: true,
			},
		};

		const project = new Project();
		const parser = new SwaggerParser(specWithSecurity, config);
		const generator = new AngularClientGenerator();

		const spy = vi
			.spyOn(AuthInterceptorGenerator.prototype, "generate")
			.mockReturnValue(undefined as never);
		generator.generate(project, parser, config, tokensOutputDir);
		await project.save();
		spy.mockRestore();

		expect(fs.existsSync(path.join(tokensOutputDir, "providers.ts"))).toBe(
			true,
		);
	});
});
