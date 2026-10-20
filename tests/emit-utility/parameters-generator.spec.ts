import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { ParametersGenerator } from "@src/routes/emit_parameters.js";
import type { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
	compileGeneratedModule,
	createTestConfig,
	createTestProject,
} from "../shared/helpers.js";

const specWithParameters: SwaggerSpec = {
	openapi: "3.2.0",
	info: { title: "Parameters", version: "1.0" },
	paths: {},
	components: {
		parameters: {
			LimitParam: {
				name: "limit",
				in: "query",
				schema: { type: "integer", format: "int32" },
			},
		},
	},
};

describe("Emitter: ParametersGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const config: GeneratorConfig = createTestConfig({
			output: "/out",
			options: {},
		});
		const parser = new SwaggerParser(spec, config);
		new ParametersGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) =>
		compileGeneratedModule(project, "/out/parameters.ts");

	it("should generate registry map for parameters", () => {
		const project = runGenerator(specWithParameters);

		const { API_PARAMETERS } = compileGeneratedFile(project);

		expect(API_PARAMETERS?.LimitParam).toBeDefined();

		expect(API_PARAMETERS?.LimitParam?.name).toBe("limit");

		expect(API_PARAMETERS?.LimitParam?.in).toBe("query");
	});

	it("should handle specs without parameters", () => {
		const emptySpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "Empty", version: "1.0" },
			paths: {},
		};
		const project = runGenerator(emptySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/parameters.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});
});
