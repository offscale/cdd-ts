import { TypeGenerator } from "@src/classes/emit.js";
import type { GeneratorConfig } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { testCast } from "../shared/helpers.js";

describe("Emitter: TypeGenerator (Extra Coverage)", () => {
	const setup = (schemas: Record<string, unknown>) => {
		const project = new Project({ useInMemoryFileSystem: true });
		const config: GeneratorConfig = { input: "", output: "/out", options: {} };
		const parser = new SwaggerParser(
			testCast({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
				components: { schemas },
			}),
			config,
		);
		new TypeGenerator(parser, project, config).generate("/out");
		return project.createSourceFile(
			"/out/combined.ts",
			project
				.getSourceFiles()
				.filter((f) => f.getFilePath().includes("/out/models/"))
				.map((f) => f.getFullText().replace(/import type .+\n/g, ""))
				.join("\n"),
			{ overwrite: true },
		);
	};

	it("should generate JSDoc @see tag for externalDocs without description", () => {
		const sourceFile = setup({
			DocModel: testCast({
				type: testCast("object"),
				externalDocs: testCast({ url: testCast("http://example.com") }),
			}),
		});
		const doc = sourceFile
			.getInterfaceOrThrow("DocModel")
			.getJsDocs()[0]
			.getText();
		expect(doc).toContain("@see http://example.com");
		expect(doc).not.toContain(" - ");
	});

	it("should generate JSDoc @deprecated tag without description", () => {
		const sourceFile = setup({
			OldModel: testCast({
				type: testCast("object"),
				deprecated: testCast(true),
			}),
		});
		const doc = sourceFile
			.getInterfaceOrThrow("OldModel")
			.getJsDocs()[0]
			.getText();
		expect(doc).toContain("@deprecated");
		expect(doc).not.toContain("undefined");
	});

	it("should generate JSDoc @default tag", () => {
		const sourceFile = setup({
			Config: testCast({
				type: testCast("object"),
				properties: testCast({
					retries: testCast({
						type: testCast("integer"),
						default: testCast(3),
					}),
				}),
			}),
		});
		const prop = sourceFile
			.getInterfaceOrThrow("Config")
			.getPropertyOrThrow("retries");
		expect(prop.getJsDocs()[0].getText()).toContain("@default 3");
	});

	it("should generate JSDoc @example tag", () => {
		const sourceFile = setup({
			Data: testCast({
				type: testCast("string"),
				example: testCast("sample"),
			}),
		});
		// Type alias docs
		const alias = sourceFile.getTypeAliasOrThrow("Data");
		expect(alias.getJsDocs()[0].getText()).toContain('@example "sample"');
	});

	it("should generate JSDoc tags for schema x- extensions", () => {
		const sourceFile = setup({
			ExtModel: testCast({
				type: testCast("object"),
				"x-entity": testCast("internal"),
				"x-meta": testCast({ role: testCast("system") }),
				properties: testCast({
					id: testCast({ type: testCast("string"), "x-prop": testCast(true) }),
				}),
			}),
		});

		const doc = sourceFile
			.getInterfaceOrThrow("ExtModel")
			.getJsDocs()[0]
			.getText();
		expect(doc).toContain('@x-entity "internal"');
		expect(doc).toContain('@x-meta {"role":"system"}');

		const propDoc = sourceFile
			.getInterfaceOrThrow("ExtModel")
			.getPropertyOrThrow("id")
			.getJsDocs()[0]
			.getText();
		expect(propDoc).toContain("@x-prop true");
	});

	it("should generate JSDoc tags for schema constraints and metadata", () => {
		const sourceFile = testCast(
			setup({
				Constrained: {
					type: testCast("object"),
					minProperties: testCast(1),
					maxProperties: testCast(5),
					propertyNames: testCast({ pattern: testCast("^[a-z]+$") }),
					properties: {
						name: testCast({
							type: "string",
							minLength: 2,
							maxLength: 5,
							pattern: "^[a-z]+$",
							format: "uuid",
						}),
						count: testCast({
							type: testCast("number"),
							minimum: testCast(1),
							maximum: testCast(10),
							exclusiveMinimum: testCast(0),
							multipleOf: testCast(0.5),
						}),
						tags: testCast({
							type: testCast("array"),
							minItems: testCast(1),
							maxItems: testCast(3),
							uniqueItems: testCast(true),
						}),
						values: testCast({
							type: testCast("array"),
							contains: testCast({ type: testCast("string") }),
							minContains: testCast(1),
							maxContains: testCast(2),
						}),
						readSecret: testCast({
							type: testCast("string"),
							readOnly: testCast(true),
						}),
						writeSecret: testCast({
							type: testCast("string"),
							writeOnly: testCast(true),
						}),
						payload: {
							type: testCast("string"),
							contentMediaType: testCast("application/json"),
							contentSchema: testCast({
								type: testCast("object"),
								properties: testCast({
									id: testCast({ type: testCast("string") }),
								}),
							}),
						},
						binary: testCast({
							type: testCast("string"),
							contentMediaType: testCast("image/png"),
							contentEncoding: testCast("base64"),
						}),
						xmlValue: testCast({
							type: testCast("string"),
							xml: testCast({
								name: "value",
								namespace: testCast("https://example.com"),
								prefix: testCast("ex"),
							}),
						}),
					},
				},
				SchemaMeta: {
					type: testCast("object"),
					$schema: testCast("https://spec.openapis.org/oas/3.1/dialect/base"),
					$id: testCast("https://example.com/schemas/SchemaMeta"),
					$anchor: testCast("SchemaMetaAnchor"),
					$dynamicAnchor: testCast("SchemaMetaDynamic"),
					patternProperties: testCast({
						"^x-": testCast({ type: testCast("string") }),
					}),
					dependentSchemas: {
						paymentMethod: testCast({
							properties: testCast({
								cardNumber: testCast({ type: testCast("string") }),
							}),
							required: testCast(["cardNumber"]),
						}),
					},
					dependentRequired: testCast({
						paymentMethod: testCast(["cardNumber"]),
					}),
					unevaluatedProperties: testCast(false),
					unevaluatedItems: testCast({ type: testCast("string") }),
					properties: testCast({
						paymentMethod: testCast({ type: testCast("string") }),
					}),
				},
			}),
		);

		const modelDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getJsDocs()[0]
			.getText();
		expect(modelDoc).toContain("@minProperties 1");
		expect(modelDoc).toContain("@maxProperties 5");
		expect(modelDoc).toContain('@propertyNames {"pattern":"^[a-z]+$"}');

		const nameDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getPropertyOrThrow("name")
			.getJsDocs()[0]
			.getText();
		expect(nameDoc).toContain("@minLength 2");
		expect(nameDoc).toContain("@maxLength 5");
		expect(nameDoc).toContain("@pattern ^[a-z]+$");
		expect(nameDoc).toContain("@format uuid");

		const countDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getPropertyOrThrow("count")
			.getJsDocs()[0]
			.getText();
		expect(countDoc).toContain("@minimum 1");
		expect(countDoc).toContain("@maximum 10");
		expect(countDoc).toContain("@exclusiveMinimum 0");
		expect(countDoc).toContain("@multipleOf 0.5");

		const tagsDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getPropertyOrThrow("tags")
			.getJsDocs()[0]
			.getText();
		expect(tagsDoc).toContain("@minItems 1");
		expect(tagsDoc).toContain("@maxItems 3");
		expect(tagsDoc).toContain("@uniqueItems true");

		const valuesDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getPropertyOrThrow("values")
			.getJsDocs()[0]
			.getText();
		expect(valuesDoc).toContain('@contains {"type":"string"}');
		expect(valuesDoc).toContain("@minContains 1");
		expect(valuesDoc).toContain("@maxContains 2");

		const readSecretDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getPropertyOrThrow("readSecret")
			.getJsDocs()[0]
			.getText();
		expect(readSecretDoc).toContain("@readOnly");

		const writeSecretDoc = sourceFile
			.getInterfaceOrThrow("ConstrainedRequest")
			.getPropertyOrThrow("writeSecret")
			.getJsDocs()[0]
			.getText();
		expect(writeSecretDoc).toContain("@writeOnly");

		const payloadDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getPropertyOrThrow("payload")
			.getJsDocs()[0]
			.getText();
		expect(payloadDoc).toContain("@contentMediaType application/json");
		expect(payloadDoc).toContain(
			'@contentSchema {"type":"object","properties":{"id":{"type":"string"}}}',
		);

		const binaryDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getPropertyOrThrow("binary")
			.getJsDocs()[0]
			.getText();
		expect(binaryDoc).toContain("@contentMediaType image/png");
		expect(binaryDoc).toContain("@contentEncoding base64");

		const xmlDoc = sourceFile
			.getInterfaceOrThrow("Constrained")
			.getPropertyOrThrow("xmlValue")
			.getJsDocs()[0]
			.getText();
		expect(xmlDoc).toContain(
			'@xml {"name":"value","namespace":"https://example.com","prefix":"ex"}',
		);

		const schemaMetaNode =
			sourceFile.getInterface("SchemaMeta") ??
			sourceFile.getTypeAliasOrThrow("SchemaMeta");
		const schemaMetaDoc = schemaMetaNode.getJsDocs()[0].getText();
		expect(schemaMetaDoc).toContain(
			"@schemaDialect https://spec.openapis.org/oas/3.1/dialect/base",
		);
		expect(schemaMetaDoc).toContain(
			"@schemaId https://example.com/schemas/SchemaMeta",
		);
		expect(schemaMetaDoc).toContain("@schemaAnchor SchemaMetaAnchor");
		expect(schemaMetaDoc).toContain("@schemaDynamicAnchor SchemaMetaDynamic");
		expect(schemaMetaDoc).toContain(
			'@patternProperties {"^x-":{"type":"string"}}',
		);
		expect(schemaMetaDoc).toContain(
			'@dependentSchemas {"paymentMethod":{"properties":{"cardNumber":{"type":"string"}},"required":["cardNumber"]}}',
		);
		expect(schemaMetaDoc).toContain(
			'@dependentRequired {"paymentMethod":["cardNumber"]}',
		);
		expect(schemaMetaDoc).toContain("@unevaluatedProperties false");
		expect(schemaMetaDoc).toContain('@unevaluatedItems {"type":"string"}');
	});

	it("should generate JSDoc tags for conditional, const, and union keywords", () => {
		const sourceFile = testCast(
			setup({
				Conditional: {
					type: testCast("object"),
					if: testCast({
						properties: testCast({ kind: testCast({ const: testCast("A") }) }),
					}),
					then: testCast({ required: testCast(["a"]) }),
					else: testCast({ required: testCast(["b"]) }),
					not: testCast({
						properties: testCast({
							banned: testCast({ type: testCast("string") }),
						}),
					}),
					properties: testCast({
						kind: testCast({ type: testCast("string") }),
						a: testCast({ type: testCast("string") }),
						b: testCast({ type: testCast("string") }),
					}),
				},
				ConstObject: testCast({
					const: testCast({ status: testCast("fixed"), count: testCast(1) }),
				}),
				OneOfSchema: testCast({
					oneOf: testCast([
						{ type: testCast("string") },
						{ type: testCast("number") },
					]),
				}),
				AnyOfSchema: testCast({
					anyOf: testCast([
						{ type: testCast("string") },
						{ type: testCast("number") },
					]),
				}),
			}),
		);

		const conditionalDoc = sourceFile
			.getInterfaceOrThrow("Conditional")
			.getJsDocs()[0]
			.getText();
		expect(conditionalDoc).toContain(
			'@if {"properties":{"kind":{"const":"A"}}}',
		);
		expect(conditionalDoc).toContain('@then {"required":["a"]}');
		expect(conditionalDoc).toContain('@else {"required":["b"]}');
		expect(conditionalDoc).toContain(
			'@not {"properties":{"banned":{"type":"string"}}}',
		);

		const constDoc = sourceFile
			.getTypeAliasOrThrow("ConstObject")
			.getJsDocs()[0]
			.getText();
		expect(constDoc).toContain('@const {"status":"fixed","count":1}');

		const oneOfDoc = sourceFile
			.getTypeAliasOrThrow("OneOfSchema")
			.getJsDocs()[0]
			.getText();
		expect(oneOfDoc).toContain('@oneOf [{"type":"string"},{"type":"number"}]');

		const anyOfDoc = sourceFile
			.getTypeAliasOrThrow("AnyOfSchema")
			.getJsDocs()[0]
			.getText();
		expect(anyOfDoc).toContain('@anyOf [{"type":"string"},{"type":"number"}]');
	});

	it("should generate JSDoc @discriminator tag for schemas with discriminators", () => {
		const sourceFile = setup({
			Pet: testCast({
				type: testCast("object"),
				discriminator: testCast({
					propertyName: testCast("petType"),
					mapping: testCast({ cat: testCast("#/components/schemas/Cat") }),
				}),
				oneOf: testCast([{ $ref: testCast("#/components/schemas/Cat") }]),
				properties: testCast({
					petType: testCast({ type: testCast("string") }),
				}),
				required: testCast(["petType"]),
			}),
			Cat: testCast({
				type: testCast("object"),
				properties: testCast({
					petType: testCast({ const: testCast("cat") }),
				}),
			}),
		});

		const petNode =
			sourceFile.getInterface("Pet") ?? sourceFile.getTypeAliasOrThrow("Pet");
		const doc = petNode.getJsDocs()[0].getText();
		expect(doc).toContain(
			'@discriminator {"propertyName":"petType","mapping":{"cat":"#/components/schemas/Cat"}}',
		);
	});
});
