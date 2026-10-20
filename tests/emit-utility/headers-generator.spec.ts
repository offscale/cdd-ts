import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { HeadersGenerator } from "@src/openapi/emit_headers.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import type { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
	compileGeneratedModule,
	createTestConfig,
	createTestProject,
} from "../shared/helpers.js";

const specWithHeaders: SwaggerSpec = {
	openapi: "3.2.0",
	info: { title: "Headers", version: "1.0" },
	paths: {},
	components: {
		headers: {
			TraceId: {
				description: "Request trace identifier",
				schema: { type: "string" },
			},
		},
	},
};

describe("Emitter: HeadersGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const config: GeneratorConfig = createTestConfig({
			output: "/out",
			options: {},
		});
		const parser = new SwaggerParser(spec, config);
		new HeadersGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) =>
		compileGeneratedModule(project, "/out/headers.ts");

	it("should generate registry map for component headers", () => {
		const project = runGenerator(specWithHeaders);

		const { API_HEADERS } = compileGeneratedFile(project);

		expect(API_HEADERS?.TraceId).toBeDefined();

		expect(API_HEADERS?.TraceId?.description).toBe("Request trace identifier");
	});

	it("should handle specs without headers", () => {
		const emptySpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "Empty", version: "1.0" },
			paths: {},
		};
		const project = runGenerator(emptySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/headers.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});
});
