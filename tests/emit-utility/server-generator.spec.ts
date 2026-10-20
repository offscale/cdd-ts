import type { SwaggerSpec } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { ServerGenerator } from "@src/routes/emit_server.js";
import type { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
	compileGeneratedModule,
	createTestConfig,
	createTestProject,
	createTestSpec,
} from "../shared/helpers.js";

const multiEnvSpec: SwaggerSpec = createTestSpec({
	openapi: "3.2.0",
	info: { title: "Server Test", version: "1.0" },
	paths: {},
	servers: [
		{
			url: "https://api.production.com/v1",
			description: "Production",
			name: "prod",
		},
		{
			url: "https://api.staging.com/v1",
			description: "Staging",
			name: "staging",
		},
	],
});

describe("Emitter: ServerGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const parser = new SwaggerParser(spec, createTestConfig({ options: {} }));
		new ServerGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) =>
		compileGeneratedModule(project, "/out/servers.ts");

	it("should generate registry for static servers with name (OAS 3.2)", () => {
		const project = runGenerator(multiEnvSpec);

		const { API_SERVERS } = compileGeneratedFile(project);

		expect(API_SERVERS).toHaveLength(2);

		expect(API_SERVERS?.[0]?.url).toBe("https://api.production.com/v1");

		expect(API_SERVERS?.[0]?.name).toBe("prod");

		expect(API_SERVERS?.[1]?.description).toBe("Staging");

		expect(API_SERVERS?.[1]?.name).toBe("staging");
	});

	it("should generate default server for OAS specs with empty servers array", () => {
		const spec: SwaggerSpec = {
			openapi: "3.0.0",
			info: { title: "E", version: "1" },
			paths: {},
			servers: [],
		};
		const project = runGenerator(spec);
		const sourceFile = project.getSourceFileOrThrow("/out/servers.ts");

		expect(sourceFile.getText()).toContain("export const API_SERVERS");
		expect(sourceFile.getText()).toContain('"url": "/"');
	});

	it("should not generate servers for Swagger 2.0 specs without servers", () => {
		const spec: SwaggerSpec = {
			swagger: "2.0",
			info: { title: "E", version: "1" },
			paths: {},
		};
		const project = runGenerator(spec);
		const sourceFile = project.getSourceFileOrThrow("/out/servers.ts");
		expect(sourceFile.getText()).toMatch(/export\s*{\s*};/);
	});

	it("should handle empty parser.servers array", () => {
		const project = createTestProject();
		const parser = {
			servers: [],
		};

		new ServerGenerator(parser, project).generate("/out");

		const sourceFile = project.getSourceFileOrThrow("/out/servers.ts");
		expect(sourceFile.getText()).toMatch(/export\s*{\s*};/);
		const vars = sourceFile.getVariableStatements();
		expect(vars.length).toBe(0);
	});
});
