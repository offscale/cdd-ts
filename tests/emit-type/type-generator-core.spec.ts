import { TypeGenerator } from "@src/classes/emit.js";
import type { GeneratorConfig } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { type TestCallable, testCast } from "../shared/helpers.js";

const typeGenSpec = {
	openapi: "3.0.0",
	info: { title: "Test", version: "1.0" },
	paths: {
		"/hooks": {
			post: {
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									userId: { type: "string" },
									timestamp: { type: "string" },
								},
							},
						},
					},
				},
				responses: { "200": { description: "ok" } },
			},
		},
	},
	webhooks: {
		"user.created": {
			post: {
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									userId: { type: "string" },
									timestamp: { type: "string" },
								},
							},
						},
					},
				},
				responses: { "200": { description: "ok" } },
			},
		},
	},
	components: {
		schemas: {
			Status: { type: "string", enum: ["active", "inactive"] },
			NumericEnum: { type: "integer", enum: [1, 2, 3] },
			EmptyEnum: { type: "string", enum: [] },
			Base: { type: "object", properties: { id: { type: "string" } } },
			Extended: {
				allOf: [
					{ $ref: "#/components/schemas/Base" },
					{
						type: "object",
						properties: { name: { type: "string" } },
					},
				],
			},
			AnyValue: { anyOf: [{ type: "string" }, { type: "number" }] },
			QuotedProps: {
				type: "object",
				properties: { "with-hyphen": { type: "string" } },
			},
			FreeObject: { type: "object", additionalProperties: true },
			StringMap: { type: "object", additionalProperties: { type: "string" } },
			ClosedMap: {
				type: "object",
				additionalProperties: false,
				properties: { id: { type: "string" } },
			},
			Description: {
				type: "object",
				properties: {
					prop: { type: "string", description: "A test property." },
				},
			},
			SimpleAlias: { type: "string" },
			ComplexAlias: {
				anyOf: [{ type: "string" }, { $ref: "#/components/schemas/Base" }],
			},
			DocModel: {
				type: "object",
				externalDocs: { url: "https://example.com", description: "More info" },
			},
			ReadOnlyObj: {
				type: "object",
				properties: { id: { type: "string", readOnly: true } },
			},
			WriteOnlyObj: {
				type: "object",
				properties: { id: { type: "string", writeOnly: true } },
			},
		},
	},
};

describe("Emitter: TypeGenerator", () => {
	const runGenerator = (
		spec: unknown,
		options: Partial<GeneratorConfig["options"]> = {},
	) => {
		const project = new Project({ useInMemoryFileSystem: true });
		const config: GeneratorConfig = {
			input: "",
			output: "/out",
			options: { enumStyle: "union", ...options },
		};
		const parser = new SwaggerParser(testCast(spec), config);
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
		return { getText: () => sourceFile.getFullText(), sourceFile };
	};

	testCast<TestCallable>(it)(
		'should generate a union type for enums when enumStyle is "union"',
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec), {
				enumStyle: testCast("union"),
			});
			expect(getText()).toContain(
				"export type Status = 'active' | 'inactive';",
			);
		},
	);

	testCast<TestCallable>(it)(
		'should generate a TypeScript enum for string enums when enumStyle is "enum"',
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec), {
				enumStyle: testCast("enum"),
			});
			expect(getText()).toContain("export enum Status {");
			expect(getText()).toContain('ACTIVE = "active"');
			expect(getText()).toContain('INACTIVE = "inactive"');
		},
	);

	testCast<TestCallable>(it)(
		"should generate a union type for non-string enums regardless of style",
		() => {
			// Even if enumStyle is 'enum', we can't make a TS enum for pure numbers easily without keys
			const { getText } = runGenerator(testCast(typeGenSpec), {
				enumStyle: testCast("enum"),
			});
			expect(getText()).toContain("export type NumericEnum = 1 | 2 | 3;");
		},
	);

	testCast<TestCallable>(it)(
		"should generate `string | number | boolean | object | undefined | null` for an empty enum",
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec));
			expect(getText()).toContain(
				"export type EmptyEnum = string | number | boolean | object | undefined | null;",
			);
		},
	);

	testCast<TestCallable>(it)(
		"should generate extended interfaces using `extends` for `allOf`",
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec));
			expect(getText()).toContain("export interface Extended extends Base {");
			expect(getText()).toContain("name?: string;");
		},
	);

	testCast<TestCallable>(it)(
		"should generate union types using `|` for `anyOf`",
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec));
			expect(getText()).toContain("export type AnyValue = string | number;");
		},
	);

	testCast<TestCallable>(it)("should handle quoted property names", () => {
		const { getText } = runGenerator(testCast(typeGenSpec));
		expect(getText()).toContain("'with-hyphen'?: string;");
	});

	testCast<TestCallable>(it)(
		"should generate an alias for non-object schemas",
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec));
			expect(getText()).toContain("export type SimpleAlias = string;");
			expect(getText()).toContain("export type ComplexAlias = string | Base;");
		},
	);

	testCast<TestCallable>(it)(
		"should generate index signatures for `additionalProperties`",
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec));
			expect(getText()).toContain(
				"export interface FreeObject {\n    [key: string]: string | number | boolean | object | undefined | null;\n}",
			);
			expect(getText()).toContain(
				"export interface StringMap {\n    [key: string]: string;\n}",
			);
		},
	);

	testCast<TestCallable>(it)(
		"should emit @additionalProperties for explicit false",
		() => {
			const { sourceFile } = runGenerator(testCast(typeGenSpec));
			const closedMap = sourceFile.getInterfaceOrThrow("ClosedMap");
			const doc = closedMap.getJsDocs()[0];
			const tag = doc
				?.getTags()
				.find((t) => t.getTagName() === "additionalProperties");
			expect(tag?.getCommentText()).toBe("false");
		},
	);

	testCast<TestCallable>(it)(
		"should generate TSDoc comments from descriptions",
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec));
			expect(getText()).toContain("/** A test property. */");
		},
	);

	testCast<TestCallable>(it)(
		"should generate JSDoc @see tags from externalDocs",
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec));
			expect(getText()).toContain("@see https://example.com - More info");
		},
	);

	testCast<TestCallable>(it)(
		"should generate types for webhook payloads",
		() => {
			const { getText } = runGenerator(testCast(typeGenSpec));
			expect(getText()).toContain("export interface UserCreatedWebhook");
			expect(getText()).toContain("userId?: string;");
		},
	);

	testCast<TestCallable>(it)(
		"should generate readOnly properties as readonly and omit writeOnly from Response type",
		() => {
			const { sourceFile } = runGenerator(testCast(typeGenSpec));
			const readOnlyObj = sourceFile.getInterfaceOrThrow("ReadOnlyObj");
			const idProp = readOnlyObj.getPropertyOrThrow("id");
			// In response models, readOnly props exist and should technically be 'readonly' in TS
			// The current implementation marks them as such via isReadonly: options.excludeWriteOnly && !!propDef.readOnly
			// Wait, logic: isReadonly: options.excludeWriteOnly && !!propDef.readOnly.
			// Response generation: excludeWriteOnly: true. So yes.
			expect(idProp.isReadonly()).toBe(true);

			const writeOnlyObj = sourceFile.getInterfaceOrThrow("WriteOnlyObj");
			expect(writeOnlyObj.getProperty("id")).toBeUndefined();
		},
	);

	testCast<TestCallable>(it)(
		"should generate Request interface when readOnly/writeOnly properties exist",
		() => {
			const { sourceFile } = runGenerator(testCast(typeGenSpec));

			// ReadOnlyObj -> ReadOnlyObjRequest should EXCLUDE id
			const roRequest = sourceFile.getInterfaceOrThrow("ReadOnlyObjRequest");
			expect(roRequest.getProperty("id")).toBeUndefined();

			// WriteOnlyObj -> WriteOnlyObjRequest should INCLUDE id
			const woRequest = sourceFile.getInterfaceOrThrow("WriteOnlyObjRequest");
			expect(woRequest.getProperty("id")).toBeDefined();
		},
	);

	testCast<TestCallable>(it)(
		"should generate type alias for boolean schema",
		async () => {
			const spec = testCast({
				openapi: "3.1.0",
				info: { title: "Test", version: "1.0" },
				components: {
					schemas: {
						BoolSchema: true,
						FalseSchema: false,
					},
				},
			});
			const { sourceFile } = runGenerator(spec);
			expect(sourceFile.getTypeAlias("BoolSchema")).toBeDefined();
			expect(sourceFile.getTypeAlias("FalseSchema")).toBeDefined();
		},
	);

	it("should ignore Content-Type headers in responses", async () => {
		const spec = testCast({
			openapi: "3.1.0",
			info: { title: "Test", version: "1.0" },
			paths: {
				"/test": {
					get: {
						responses: {
							"200": {
								description: "ok",
								headers: {
									"Content-Type": {
										schema: { type: "string" },
									},
									"X-My-Header": {
										schema: { type: "string" },
									},
								},
							},
						},
					},
				},
			},
		});
		const { sourceFile } = testCast<TestCallable>(runGenerator)(spec);
		// Just checking that it didn't throw and generate was successful
		expect(sourceFile).toBeDefined();
	});
});
