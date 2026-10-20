import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { PathsGenerator } from "@src/routes/emit.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
	compileGeneratedModule,
	createTestConfig,
	createTestPaths,
	createTestProject,
	createTestSpec,
} from "../shared/helpers.js";

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
		const config: GeneratorConfig = createTestConfig({
			output: "/out",
			options: {},
		});
		const parser = new SwaggerParser(spec, config);
		new PathsGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) =>
		compileGeneratedModule(project, "/out/paths.ts");

	it("should generate registry map for path-level metadata", () => {
		const project = runGenerator(specWithPathMeta);

		const { API_PATHS } = compileGeneratedFile(project);

		expect(API_PATHS?.["/pets"]).toBeDefined();

		expect(API_PATHS?.["/pets"]?.summary).toBe("Pets");

		expect(API_PATHS?.["/pets"]?.description).toBe("Pet operations");

		expect(API_PATHS?.["/pets"]?.parameters?.[0]?.name).toBe("trace");

		expect(API_PATHS?.["/pets"]?.servers?.[0]?.url).toBe(
			"https://api.example.com",
		);

		expect(API_PATHS?.["/pets"]?.["x-release"]).toBe("beta");
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
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			createTestConfig({ output: "/out", options: {} }),
		);
		parser.spec.paths = createTestPaths({
			"/ping": "invalid",
			"/pong": null,
		}); // bypass validation manually
		const project = new Project({ useInMemoryFileSystem: true });
		new PathsGenerator(parser, project).generate("/out");
		const sourceFile = project.getSourceFileOrThrow("/out/paths.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});

	it("should handle pathItem.$ref and undefined spec.paths", () => {
		const refSpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "RefPaths", version: "1.0" },
			paths: {
				"/ref-path": {
					$ref: "#/components/pathItems/SharedPath",
				},
			},
			components: {
				pathItems: {
					SharedPath: {
						get: { responses: { "200": { description: "ok" } } },
					},
				},
			},
		};
		const project = runGenerator(refSpec);
		const { API_PATHS } = compileGeneratedFile(project);
		expect(API_PATHS?.["/ref-path"]?.$ref).toBe(
			"#/components/pathItems/SharedPath",
		);

		const parserNoPaths = new SwaggerParser(
			createTestSpec({
				openapi: "3.1.0",
				info: { title: "NoPaths", version: "1" },
				webhooks: {
					hook: { post: { responses: { "200": { description: "ok" } } } },
				},
			}),
			createTestConfig({ output: "/out", options: {} }),
		);
		const proj2 = new Project({ useInMemoryFileSystem: true });
		new PathsGenerator(parserNoPaths, proj2).generate("/out");
		expect(proj2.getSourceFileOrThrow("/out/paths.ts").getText()).toContain(
			"export { };",
		);
	});
});
