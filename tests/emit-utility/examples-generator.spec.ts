import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { ExamplesGenerator } from "@src/mocks/emit.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import type { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
	compileGeneratedModule,
	createTestConfig,
	createTestProject,
} from "../shared/helpers.js";

const examplesSpec: SwaggerSpec = {
	openapi: "3.2.0",
	info: { title: "Examples", version: "1.0" },
	paths: {},
	components: {
		examples: {
			ExampleOne: {
				summary: "Example",
				dataValue: { foo: "bar" },
			},
			ExampleTwo: {
				serializedValue: '{"hello":"world"}',
			},
		},
	},
};

describe("Emitter: ExamplesGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const config: GeneratorConfig = createTestConfig({
			output: "/out",
			options: {},
		});
		const parser = new SwaggerParser(spec, config);
		new ExamplesGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) =>
		compileGeneratedModule(project, "/out/examples.ts");

	it("should generate registry map for examples", () => {
		const project = runGenerator(examplesSpec);

		const { API_EXAMPLES } = compileGeneratedFile(project);

		expect(API_EXAMPLES?.ExampleOne?.summary).toBe("Example");

		expect(API_EXAMPLES?.ExampleOne?.dataValue?.foo).toBe("bar");

		expect(API_EXAMPLES?.ExampleTwo?.serializedValue).toContain("world");
	});

	it("should handle specs without examples", () => {
		const emptySpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "Empty", version: "1.0" },
			paths: {},
		};
		const project = runGenerator(emptySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/examples.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});
});
