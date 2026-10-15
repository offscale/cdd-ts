import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { PathsGenerator } from "@src/routes/emit.js";
import { Project } from "ts-morph";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createTestProject, testCast } from "../shared/helpers.js";

const specWithPathMeta: SwaggerSpec = {
	openapi: "3.2.0",
	info: { title: "Paths", version: "1.0" },
	paths: {
		"/pets": {
			summary: "Pets",
			description: "Pet operations",
			parameters: [{ name: "trace", in: "header", schema: { type: "string" } }],
			servers: [{ url: "https://api.example.com" }],
			"x-release": "beta",
			get: {
				responses: { "200": { description: "ok" } },
			},
		},
	},
};

describe("Emitter: PathsGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const config: GeneratorConfig = testCast({ output: "/out", options: {} });
		const parser = new SwaggerParser(spec, config);
		new PathsGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) => {
		const sourceFile = project.getSourceFileOrThrow("/out/paths.ts");
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

	it("should generate registry map for path-level metadata", () => {
		const project = runGenerator(specWithPathMeta);

		const { API_PATHS } = compileGeneratedFile(project);

		expect(API_PATHS["/pets"]).toBeDefined();

		expect(API_PATHS["/pets"].summary).toBe("Pets");

		expect(API_PATHS["/pets"].description).toBe("Pet operations");

		expect(API_PATHS["/pets"].parameters?.[0]?.name).toBe("trace");

		expect(API_PATHS["/pets"].servers?.[0]?.url).toBe(
			"https://api.example.com",
		);

		expect(API_PATHS["/pets"]["x-release"]).toBe("beta");
	});

	it("should handle specs without path-level metadata", () => {
		const emptySpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "Empty", version: "1.0" },
			paths: {
				"/ping": { get: { responses: { "200": { description: "ok" } } } },
			},
		};
		const project = runGenerator(emptySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/paths.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});

	it("should skip primitive or non-object paths in the generator", () => {
		const primitiveSpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "Empty", version: "1.0" },
			paths: {
				"/ping": testCast("invalid"),
				"/pong": testCast(null),
			},
		};
		const parser = new SwaggerParser(
			testCast({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			testCast({ output: "/out", options: {} }),
		);
		parser.spec.paths = testCast(primitiveSpec.paths); // bypass validation manually
		const project = new Project({ useInMemoryFileSystem: true });
		new PathsGenerator(parser, project).generate("/out");
		const sourceFile = project.getSourceFileOrThrow("/out/paths.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});
});
