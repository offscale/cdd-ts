import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { TagGenerator } from "@src/openapi/emit_tag.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import type { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
	compileGeneratedModule,
	createTestConfig,
	createTestProject,
	createTestTag,
} from "../shared/helpers.js";

const tagsSpec: SwaggerSpec = {
	openapi: "3.2.0",
	info: { title: "Tags Test", version: "1.0" },
	paths: {},
	tags: [
		createTestTag({
			name: "Pet",
			summary: "Pet Operations",
			description: "Everything about your Pets",
			kind: "resource",
			"x-audience": "internal",
			externalDocs: {
				description: "Find out more",
				url: "http://swagger.io",
			},
		}),
		createTestTag({
			name: "Store",
			description: "Access to Petstore orders",
			parent: "Pet",
		}),
	],
};

describe("Emitter: TagGenerator", () => {
	const runGenerator = (spec: SwaggerSpec) => {
		const project = createTestProject();
		const config: GeneratorConfig = createTestConfig({
			output: "/out",
			options: {},
		});
		const parser = new SwaggerParser(spec, config);
		new TagGenerator(parser, project).generate("/out");
		return project;
	};

	const compileGeneratedFile = (project: Project) =>
		compileGeneratedModule(project, "/out/tags.ts");

	it("should generate registry array for tags including OAS 3.2 fields", () => {
		const project = runGenerator(tagsSpec);

		const { API_TAGS } = compileGeneratedFile(project);

		expect(API_TAGS).toHaveLength(2);

		expect(API_TAGS?.[0]?.name).toBe("Pet");

		expect(API_TAGS?.[0]?.summary).toBe("Pet Operations");

		expect(API_TAGS?.[0]?.kind).toBe("resource");

		expect(API_TAGS?.[0]?.["x-audience"]).toBe("internal");

		expect(API_TAGS?.[0]?.externalDocs?.url).toBe("http://swagger.io");
	});

	it("should generate lookup map handling parent field", () => {
		const project = runGenerator(tagsSpec);

		const { API_TAGS_MAP } = compileGeneratedFile(project);

		expect(API_TAGS_MAP?.Store).toBeDefined();

		expect(API_TAGS_MAP?.Store?.description).toContain("orders");

		expect(API_TAGS_MAP?.Store?.parent).toBe("Pet");

		expect(API_TAGS_MAP?.Pet?.name).toBe("Pet");
	});

	it("should handle specs without tags", () => {
		const emptySpec: SwaggerSpec = {
			openapi: "3.0.0",
			info: { title: "NoTags", version: "1.0" },
			paths: {},
		};
		const project = runGenerator(emptySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/tags.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});

	it("should handle empty tags array", () => {
		const emptyArraySpec: SwaggerSpec = {
			openapi: "3.0.0",
			info: { title: "EmptyTags", version: "1.0" },
			paths: {},
			tags: [],
		};
		const project = runGenerator(emptyArraySpec);
		const sourceFile = project.getSourceFileOrThrow("/out/tags.ts");
		expect(sourceFile.getText()).toContain("export { };");
	});

	it("should omit description when not provided", () => {
		const minimalSpec: SwaggerSpec = {
			openapi: "3.2.0",
			info: { title: "MinimalTags", version: "1.0" },
			paths: {},
			tags: [createTestTag({ name: "Minimal" })],
		};
		const project = runGenerator(minimalSpec);

		const { API_TAGS } = compileGeneratedFile(project);

		expect(API_TAGS).toHaveLength(1);

		expect(API_TAGS?.[0]?.description).toBeUndefined();
	});
});
