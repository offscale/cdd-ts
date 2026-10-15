import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { AbstractClientGenerator } from "../../src/core/generator.js";
import type { GeneratorConfig } from "../../src/core/types/config.js";
import type { SwaggerSpec } from "../../src/core/types/openapi.js";
import { SwaggerParser } from "../../src/openapi/parse.js";
import { testCast } from "../shared/helpers.js";

class ConcreteClientGenerator extends AbstractClientGenerator {
	generate(
		project: Project,
		parser: SwaggerParser,
		config: GeneratorConfig,
		outputDir: string,
	): void {
		this.generateSharedCore(project, parser, config, outputDir);
		const groups = this.groupOperationsByController(parser);
		project.createSourceFile(
			`${outputDir}/groups.json`,
			JSON.stringify(Object.keys(groups)),
			{ overwrite: true },
		);
	}
}

describe("AbstractClientGenerator", () => {
	it("should generate shared core OpenAPI metadata and models and group operations by canonical controller", () => {
		const spec: SwaggerSpec = {
			openapi: "3.1.0",
			info: { title: "Core Generator Spec", version: "1.0.0" },
			paths: {
				"/users": {
					get: {
						tags: ["user-accounts"],
						operationId: "listUsers",
						responses: { "200": { description: "ok" } },
					},
				},
				"/orders/{id}": {
					get: {
						operationId: "getOrder",
						parameters: [
							{
								name: "id",
								in: "path",
								required: true,
								schema: { type: "string" },
							},
						],
						responses: { "200": { description: "ok" } },
					},
				},
				"/": {
					get: {
						operationId: "getRoot",
						responses: { "200": { description: "ok" } },
					},
				},
			},
			components: {
				schemas: {
					User: {
						type: "object",
						properties: { id: { type: "string" } },
					},
				},
			},
		};
		const config: GeneratorConfig = {
			input: "memory://spec.json",
			output: "/out",
			options: { framework: "vanilla" },
		};
		const parser = new SwaggerParser(spec, config);
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ConcreteClientGenerator();

		generator.generate(project, parser, config, "/out");

		expect(project.getSourceFile("/out/models/index.ts")).toBeDefined();
		expect(project.getSourceFile("/out/info.ts")).toBeDefined();
		expect(project.getSourceFile("/out/servers.ts")).toBeDefined();
		expect(project.getSourceFile("/out/utils/server-url.ts")).toBeDefined();
		expect(
			project.getSourceFile("/out/utils/parameter-serializer.ts"),
		).toBeDefined();
		expect(project.getSourceFile("/out/document.ts")).toBeDefined();
		expect(
			project.getFileSystem().fileExistsSync("/out/openapi.snapshot.json"),
		).toBe(true);

		const groupsJson = testCast(
			JSON.parse(
				project.getSourceFileOrThrow("/out/groups.json").getFullText(),
			),
		);
		expect(groupsJson).toEqual(["UserAccounts", "Orders", "Default"]);
	});
});
