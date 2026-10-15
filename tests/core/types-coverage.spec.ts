import { parseGeneratedModels } from "@src/classes/parse.js";
import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import {
	buildOpenApiSpecFromScan,
	scanTypeScriptProject,
} from "@src/functions/parse.js";
import {
	applyReverseMetadata,
	parseGeneratedMetadata,
} from "@src/openapi/emit.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import {
	isDynamicReferenceObject,
	isOpenApiObject,
	isParameterObject,
	isReferenceObject,
	isSwaggerDefinition,
} from "@src/openapi/type_guards.js";
import { AngularClientGenerator } from "@src/vendors/angular/angular-client.generator.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

describe("Core: Types, Type Guards & OpenAPI 3.1/3.2 Round-Trip Coverage", () => {
	it("should validate runtime type guards (isOpenApiObject, isReferenceObject, isDynamicReferenceObject, isSwaggerDefinition, isParameterObject)", () => {
		expect(isOpenApiObject({ a: 1 })).toBe(true);
		expect(isOpenApiObject(null)).toBe(false);
		expect(isOpenApiObject(undefined)).toBe(false);
		expect(isOpenApiObject("str")).toBe(false);
		expect(isOpenApiObject([1, 2])).toBe(false);

		expect(isReferenceObject({ $ref: "#/components/schemas/User" })).toBe(true);
		expect(isReferenceObject({ $ref: "" })).toBe(false);
		expect(isReferenceObject({ type: "string" })).toBe(false);
		expect(isReferenceObject(null)).toBe(false);

		expect(isDynamicReferenceObject({ $dynamicRef: "#meta" })).toBe(true);
		expect(isDynamicReferenceObject({ $dynamicRef: "" })).toBe(false);
		expect(isDynamicReferenceObject({ $ref: "#/a" })).toBe(false);
		expect(isDynamicReferenceObject(undefined)).toBe(false);

		expect(isSwaggerDefinition({ type: "object" })).toBe(true);
		expect(isSwaggerDefinition(true)).toBe(false);
		expect(isSwaggerDefinition(null)).toBe(false);

		expect(isParameterObject({ name: "id", in: "path" })).toBe(true);
		expect(isParameterObject({ name: "q", in: "query" })).toBe(true);
		expect(isParameterObject({ name: "raw", in: "querystring" })).toBe(true);
		expect(isParameterObject({ name: "", in: "query" })).toBe(false);
		expect(isParameterObject({ name: "id", in: "invalid" })).toBe(false);
		expect(isParameterObject(null)).toBe(false);
	});

	it("should parse and round-trip OAS 3.1/3.2 SPDX license identifier, summary, webhooks, jsonSchemaDialect, and boolean schemas through SwaggerParser and emitOpenApiSpec", () => {
		const spec: SwaggerSpec = {
			openapi: "3.1.0",
			jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base",
			info: {
				title: "SPDX & Dialect API",
				summary: "Short summary of the API",
				version: "1.0.0",
				license: {
					name: "Apache 2.0",
					identifier: "Apache-2.0",
				},
			},
			webhooks: {
				newPet: {
					post: {
						operationId: "onNewPet",
						requestBody: {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Pet" },
								},
							},
						},
						responses: {
							"200": {
								description: "Webhook processed",
							},
						},
					},
				},
			},
			paths: {
				"/pets": {
					get: {
						operationId: "listPets",
						responses: {
							"200": {
								description: "ok",
								content: {
									"application/json": {
										schema: { $ref: "#/components/schemas/Pet" },
									},
								},
							},
						},
					},
				},
			},
			components: {
				schemas: {
					Pet: {
						type: ["object", "null"],
						$schema: "https://json-schema.org/draft/2020-12/schema",
						const: "dog",
						examples: ["dog", "cat"],
						exclusiveMinimum: 0,
						exclusiveMaximum: 100,
						contentEncoding: "base64",
						contentMediaType: "image/png",
						properties: {
							name: { type: "string" },
						},
					},
					AllowAny: true,
					AllowNone: false,
				},
			},
		};

		const config: GeneratorConfig = {
			input: "memory://spec.json",
			output: "/out",
			options: { framework: "angular" },
		};

		const parser = new SwaggerParser(spec, config);
		expect(parser.spec.info.summary).toBe("Short summary of the API");
		expect(parser.spec.info.license?.identifier).toBe("Apache-2.0");
		expect(parser.webhooks).toHaveLength(1);
		expect(parser.webhooks[0]?.operationId).toBe("onNewPet");
		expect(parser.getJsonSchemaDialect()).toBe(
			"https://spec.openapis.org/oas/3.1/dialect/base",
		);

		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new AngularClientGenerator();
		generator.generate(project, parser, config, "/out");
		project.saveSync();

		const fsHost = project.getFileSystem();
		const fsAdapter = {
			statSync: (p: string) => ({
				isFile: () => fsHost.fileExistsSync(p),
				isDirectory: () => fsHost.directoryExistsSync(p),
			}),
			existsSync: (p: string) =>
				fsHost.fileExistsSync(p) || fsHost.directoryExistsSync(p),
			readFileSync: (p: string) => fsHost.readFileSync(p),
			readdirSync: (p: string) =>
				fsHost
					.readDirSync(p)
					.map((entry) => entry.name.replace(/\/$/, "").split("/").pop() ?? ""),
		};

		const models = parseGeneratedModels("/out", fsAdapter);
		expect(models.AllowAny).toBe(true);
		expect(models.AllowNone).toBe(false);

		const scan = scanTypeScriptProject("/out", fsAdapter);
		const baseSpec = buildOpenApiSpecFromScan(scan);
		const metadata = parseGeneratedMetadata("/out", fsAdapter);
		const roundTripped = applyReverseMetadata(baseSpec, metadata);

		expect(roundTripped.info.summary).toBe("Short summary of the API");
		expect(roundTripped.info.license?.identifier).toBe("Apache-2.0");
		expect(roundTripped.jsonSchemaDialect).toBe(
			"https://spec.openapis.org/oas/3.1/dialect/base",
		);
		expect(roundTripped.webhooks?.newPet).toBeDefined();
		expect(roundTripped.components?.schemas?.AllowAny).toBe(true);
		expect(roundTripped.components?.schemas?.AllowNone).toBe(false);
	});
});
