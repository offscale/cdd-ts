import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { RequestBodiesGenerator } from "@src/openapi/emit_request_bodies.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import type { Project } from "ts-morph";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createTestProject, testCast } from "../shared/helpers.js";

const specWithRequestBodies: SwaggerSpec = {
	openapi: "3.2.0",
	info: { title: "RequestBodies", version: "1.0" },
	paths: {},
	components: {
		requestBodies: {
			CreateUser: {
				description: "User payload",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { name: { type: "string" } },
						},
					},
				},
			},
		},
	},
};

describe("Emitter: RequestBodiesGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const config: GeneratorConfig = testCast({ output: "/out", options: {} });
		const parser = new SwaggerParser(spec, config);
		new RequestBodiesGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) => {
		const sourceFile = project.getSourceFileOrThrow("/out/request-bodies.ts");
		const code = sourceFile.getText();
		const jsCode = ts.transpile(code, {
			target: ts.ScriptTarget.ES5,
			module: ts.ModuleKind.CommonJS,
		});

		const moduleHelper = {
			exports: testCast({}),
		};

		testCast(new Function("exports", jsCode)(moduleHelper.exports));

		return moduleHelper.exports;
	};

	it("should generate registry map for request bodies", () => {
		const project = runGenerator(specWithRequestBodies);

		const { API_REQUEST_BODIES } = compileGeneratedFile(project);

		expect(API_REQUEST_BODIES.CreateUser).toBeDefined();

		expect(API_REQUEST_BODIES.CreateUser.description).toBe("User payload");
	});

	it("should handle specs without requestBodies", () => {
		const emptySpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "Empty", version: "1.0" },
			paths: {},
		};
		const project = runGenerator(emptySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/request-bodies.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});
});
