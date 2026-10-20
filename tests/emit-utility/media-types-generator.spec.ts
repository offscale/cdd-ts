import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { MediaTypesGenerator } from "@src/openapi/emit_media_types.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import type { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
	compileGeneratedModule,
	createTestConfig,
	createTestProject,
} from "../shared/helpers.js";

const mediaTypesSpec: SwaggerSpec = {
	openapi: "3.2.0",
	info: { title: "MediaTypes", version: "1.0" },
	paths: {},
	components: {
		mediaTypes: {
			EventStream: {
				schema: { type: "string" },
			},
			JsonLines: {
				itemSchema: { type: "object", properties: { id: { type: "string" } } },
			},
		},
	},
};

describe("Emitter: MediaTypesGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const config: GeneratorConfig = createTestConfig({
			output: "/out",
			options: {},
		});
		const parser = new SwaggerParser(spec, config);
		new MediaTypesGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) =>
		compileGeneratedModule(project, "/out/media-types.ts");

	it("should generate registry map for media types", () => {
		const project = runGenerator(mediaTypesSpec);

		const { API_MEDIA_TYPES } = compileGeneratedFile(project);

		expect(API_MEDIA_TYPES?.EventStream?.schema?.type).toBe("string");

		expect(API_MEDIA_TYPES?.JsonLines?.itemSchema?.type).toBe("object");
	});

	it("should handle specs without mediaTypes", () => {
		const emptySpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "Empty", version: "1.0" },
			paths: {},
		};
		const project = runGenerator(emptySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/media-types.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});
});
