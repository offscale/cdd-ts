import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { PathItemsGenerator } from "@src/routes/emit_path_items.js";
import type { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
	compileGeneratedModule,
	createTestConfig,
	createTestProject,
} from "../shared/helpers.js";

const specWithPathItems: SwaggerSpec = {
	openapi: "3.2.0",
	info: { title: "PathItems", version: "1.0" },
	paths: {},
	components: {
		pathItems: {
			Ping: {
				get: {
					operationId: "ping",
					responses: { "200": { description: "pong" } },
				},
			},
		},
	},
};

describe("Emitter: PathItemsGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const config: GeneratorConfig = createTestConfig({
			output: "/out",
			options: {},
		});
		const parser = new SwaggerParser(spec, config);
		new PathItemsGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) =>
		compileGeneratedModule(project, "/out/path-items.ts");

	it("should generate registry map for path items", () => {
		const project = runGenerator(specWithPathItems);

		const { API_PATH_ITEMS } = compileGeneratedFile(project);

		expect(API_PATH_ITEMS?.Ping).toBeDefined();

		expect(API_PATH_ITEMS?.Ping?.get?.operationId).toBe("ping");
	});

	it("should handle specs without pathItems", () => {
		const emptySpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "Empty", version: "1.0" },
			paths: {},
		};
		const project = runGenerator(emptySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/path-items.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});
});
