import { TypeGenerator } from "@src/classes/emit.js";
import type { GeneratorConfig } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { createTestSpec } from "../shared/helpers.js";

describe("Emitter: TypeGenerator (Coverage Edges)", () => {
	it("should emit schema identifier JSDoc tags for round-trip", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const config: GeneratorConfig = { input: "", output: "/out", options: {} };
		const spec = {
			openapi: "3.2.0",
			info: { title: "SchemaIds", version: "1.0" },
			components: {
				schemas: {
					Identified: {
						type: "object",
						$schema: "https://example.com/dialect/schema",
						$id: "https://example.com/schemas/identified",
						$anchor: "root",
						$dynamicAnchor: "dyn",
						properties: { id: { type: "string" } },
					},
				},
			},
		};

		const parser = new SwaggerParser(createTestSpec(spec), config);
		new TypeGenerator(parser, project, config).generate("/out");

		const sourceFile = project.createSourceFile(
			"/out/combined.ts",
			project
				.getSourceFiles()
				.filter((f) => f.getFilePath().includes("/out/models/"))
				.map((f) => f.getFullText().replace(/import type .+\n/g, ""))
				.join("\n"),
			{ overwrite: true },
		);
		const iface = sourceFile.getInterfaceOrThrow("Identified");
		const tags = iface
			.getJsDocs()
			.flatMap((doc) => doc.getTags())
			.map((tag) => tag.getTagName());
		const tagText = iface
			.getJsDocs()
			.flatMap((doc) => doc.getTags())
			.map((tag) => `${tag.getTagName()} ${tag.getCommentText() ?? ""}`.trim());

		expect(tags).toEqual(
			expect.arrayContaining([
				"schemaDialect",
				"schemaId",
				"schemaAnchor",
				"schemaDynamicAnchor",
			]),
		);
		expect(tagText).toEqual(
			expect.arrayContaining([
				"schemaDialect https://example.com/dialect/schema",
				"schemaId https://example.com/schemas/identified",
				"schemaAnchor root",
				"schemaDynamicAnchor dyn",
			]),
		);
	});

	it("should cover webhooks, callbacks, links, headers, and composition edge cases", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const config: GeneratorConfig = { input: "", output: "/out", options: {} };
		const spec = {
			openapi: "3.0.0",
			info: { title: "Edge", version: "1.0" },
			paths: {
				"/no-opid": {
					post: {
						callbacks: {
							missingCallback: {
								$ref: "#/components/callbacks/MissingCallback",
							},
							inlineCallback: {
								"{$request.query.url}": {
									post: {
										requestBody: {
											content: {
												"application/json": {
													schema: {
														type: "object",
														properties: { id: { type: "string" } },
													},
												},
											},
										},
										responses: { "200": { description: "ok" } },
									},
								},
							},
							emptyCallback: {
								"{$request.query.empty}": {
									post: {
										requestBody: {
											content: { "*/*": {} },
										},
										responses: { "200": { description: "ok" } },
									},
								},
							},
						},
						responses: {
							"200": {
								description: "ok",
								headers: {
									"X-Missing-Header": {
										$ref: "#/components/headers/MissingHeader",
									},
									"X-Content-NoSchema": { content: { "application/json": {} } },
									"X-Deprecated": {
										deprecated: true,
										schema: { type: "string" },
									},
								},
							},
						},
					},
				},
				"/empty-headers": {
					get: {
						operationId: "emptyHeaders",
						responses: {
							"200": {
								description: "ok",
								headers: {
									"X-Only-Missing": {
										$ref: "#/components/headers/MissingHeader",
									},
									"Content-Type": { schema: { type: "string" } },
								},
							},
						},
					},
				},
			},
			webhooks: {
				webhookGetOnly: {
					get: {
						responses: { "200": { description: "ok" } },
					},
				},
				webhookNoContent: {
					post: {
						requestBody: {
							content: { "application/json": {} },
						},
						responses: { "200": { description: "ok" } },
					},
				},
				webhookWildcard: {
					post: {
						requestBody: {
							content: { "*/*": {} },
						},
						responses: { "200": { description: "ok" } },
					},
				},
			},
			components: {
				schemas: {
					Dummy: { type: "object", properties: { id: { type: "string" } } },
					Plain: { type: "object", properties: { name: { type: "string" } } },
					Base: {
						type: "object",
						properties: { id: { type: "string", readOnly: true } },
					},
					Composite: {
						allOf: [
							true,
							{ $ref: "#/components/schemas/Missing" },
							{ $ref: "#/components/schemas/Base" },
							{ $ref: "#/components/schemas/Plain" },
							{ $ref: "#/components/schemas/" },
							{ type: "object" },
							{
								type: "object",
								properties: {
									inlineProp: { type: "string" },
									boolProp: true,
								},
							},
						],
					},
					InlineAllOfOnly: {
						allOf: [
							true,
							{
								type: "object",
								properties: {
									onlyInline: { type: "string" },
								},
							},
						],
					},
					PostNoOpid200Headers: {
						type: "object",
						properties: { existing: { type: "string" } },
					},
					EnumWithNumber: { type: "string", enum: ["1st", "SECOND"] },
				},
				links: {
					NoParams: { operationId: "noop" },
				},
				headers: {},
				callbacks: {},
			},
		};

		const parser = new SwaggerParser(createTestSpec(spec), config);
		new TypeGenerator(parser, project, config).generate("/out");

		const sourceFile = project.createSourceFile(
			"/out/combined.ts",
			project
				.getSourceFiles()
				.filter((f) => f.getFilePath().includes("/out/models/"))
				.map((f) => f.getFullText().replace(/import type .+\n/g, ""))
				.join("\n"),
			{ overwrite: true },
		);

		const enumDecl = sourceFile.getEnumOrThrow("EnumWithNumber");
		expect(enumDecl.getMember("_1ST")).toBeDefined();

		const compositeRequest = sourceFile.getInterfaceOrThrow("CompositeRequest");
		expect(
			compositeRequest
				.getExtends()
				.some((e) => e.getText().includes("BaseRequest")),
		).toBe(true);

		expect(sourceFile.getInterface("EmptyHeaders200Headers")).toBeUndefined();
		expect(sourceFile.getText()).toContain("X-Deprecated");
		expect(
			sourceFile
				.getInterfaces()
				.some((iface) => iface.getName().endsWith("InlineCallbackRequest")),
		).toBe(true);
	});
});
