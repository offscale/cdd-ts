import type { GeneratorConfig } from "@src/core/types/index.js";
import { ServiceMethodAnalyzer } from "@src/functions/parse_analyzer.js";
import { camelCase } from "@src/functions/utils.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { IntegrationTestGenerator } from "@src/vendors/angular/test/integration-test.generator.js";
import { ServiceTestGenerator } from "@src/vendors/angular/test/service-test-generator.js";
import { Project } from "ts-morph";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	branchCoverageSpec,
	coverageSpec,
	finalCoveragePushSpec,
} from "../fixtures/coverage.fixture.js";
import { type TestValue, testCast } from "../shared/helpers.js";

/**
 * Propagates op.operationId to op.methodName if missing
 */
function setOperationMethodNames(operations: unknown) {
	for (const op of testCast<TestValue[]>(operations)) {
		if (op?.operationId && !op.methodName) {
			op.methodName = testCast(camelCase(testCast<string>(op.operationId)));
		}
	}
}

describe("Generated Code: Service Test Generators", () => {
	let project: Project;
	let config: GeneratorConfig;

	beforeEach(() => {
		project = new Project({ useInMemoryFileSystem: true });
		config = {
			input: "",
			output: "",
			options: {
				dateType: "string",
				enumStyle: "enum",
			},
		};
	});

	/**
	 * Setup function that always sets methodName on operations as needed.
	 */

	const setupTestGen = (specPart: TestValue) => {
		const specClone = testCast(JSON.parse(JSON.stringify(specPart)));
		const spec = {
			openapi: "3.0.0",
			info: { title: "Test Gen", version: "1.0" },

			paths: {
				"/dummy": { get: { responses: { "204": { description: "ok" } } } },

				...specClone.paths,
			},

			components: specClone.components || {},
		};
		const parser = new SwaggerParser(testCast(spec), config);
		const analyzer = new ServiceMethodAnalyzer(config, parser);
		const testGen = new ServiceTestGenerator(parser, project, config);
		return { parser, analyzer, testGen };
	};

	describe("ServiceTestGenerator", () => {
		it("should generate a basic service test file", () => {
			const { parser, testGen } = setupTestGen(testCast(coverageSpec));
			const userOps = parser.operations.filter((op) =>
				op.tags?.includes("Users"),
			);

			setOperationMethodNames(testCast(userOps));

			// Check that we actually found operations to test
			expect(userOps.length).toBeGreaterThan(0);

			testGen.generateServiceTestFile("users", testCast(userOps), "/");
			const sourceFile = project.getSourceFileOrThrow("/users.service.spec.ts");
			const classText = sourceFile.getFullText();
			expect(classText).toContain(
				'import { TestBed } from "@angular/core/testing";',
			);
			expect(classText).toContain("describe('UsersService'");
			expect(classText).toContain("it('should be created'");
			expect(classText).toContain("service.getUsers(");
			expect(classText).toContain("expect(response).toEqual(mockResponse)");
		});

		it("should handle primitive request/response types and param refs", () => {
			const { parser, testGen } = setupTestGen(testCast(finalCoveragePushSpec));
			const operations = [
				parser.operations.find((o) => o.operationId === "getPrimitive"),
				parser.operations.find((o) => o.operationId === "postPrimitive"),
				parser.operations.find(
					(o) => o.operationId === "getWithPrimitiveParam",
				),
			].filter(Boolean);
			setOperationMethodNames(testCast<TestValue>(operations));

			expect(operations.length).toBe(3);

			testGen.generateServiceTestFile("service", testCast(operations), "/");
			const sourceFile = project.getSourceFileOrThrow(
				"/service.service.spec.ts",
			);
			const text = sourceFile.getFullText();

			// getPrimitive returns number
			expect(text).toContain(`service.getPrimitive().subscribe({`);
			expect(text).toContain("const mockResponse = 123;");

			// postPrimitive takes string body
			expect(text).toContain(`service.postPrimitive(body).subscribe({`);
			// Primitive string body declaration coverage
			expect(text).toContain(
				"const body = 'test-body' as string | number | boolean | object | undefined | null as string;",
			);

			expect(text).toContain(`service.getWithPrimitiveParam(id).subscribe({`);
		});

		it("should handle operations with no parameters", () => {
			const { parser, testGen } = setupTestGen(testCast(branchCoverageSpec));
			const op = parser.operations.find((op) => op.operationId === "getRoot");
			expect(op).toBeDefined();

			if (!op?.methodName) op!.methodName = camelCase(op?.operationId!);

			testGen.generateServiceTestFile("no-params", testCast([op]), "/");
			const sourceFile = project.getSourceFileOrThrow(
				"/noParams.service.spec.ts",
			);
			const text = sourceFile.getFullText();

			expect(text).toContain("service.getRoot().subscribe({");
		});

		it("should hit branch conditions for test mock string evaluation and parameter sort", () => {
			const stringMockSpec = {
				openapi: "3.0.0",
				info: { title: "StringMock", version: "1.0" },
				components: {
					schemas: {
						StringAlias: { type: "string", example: "example-string" },
					},
				},
				paths: {
					"/test": {
						post: {
							operationId: "testStringMocks",
							parameters: [
								{
									name: "opt1",
									in: "query",
									schema: { type: "string" },
									required: false,
								},
								{
									name: "req1",
									in: "query",
									schema: { type: "string" },
									required: true,
								},
								{
									name: "opt2",
									in: "query",
									schema: { type: "string" },
									required: false,
								},
								{
									name: "req2",
									in: "query",
									schema: { type: "string" },
									required: true,
								},
							],
							requestBody: {
								required: true,
								content: {
									"application/json": {
										schema: { $ref: "#/components/schemas/StringAlias" },
									},
								},
							},
							responses: {
								"200": {
									description: "Single string model",
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/StringAlias" },
										},
									},
								},
								"201": {
									description: "Array of string model",
									content: {
										"application/json": {
											schema: {
												type: "array",
												items: { $ref: "#/components/schemas/StringAlias" },
											},
										},
									},
								},
							},
						},
					},
					"/test-array": {
						post: {
							operationId: "testStringMocksArray",
							responses: {
								"200": {
									description: "Array of string model",
									content: {
										"application/json": {
											schema: {
												type: "array",
												items: { $ref: "#/components/schemas/StringAlias" },
											},
										},
									},
								},
							},
						},
					},
				},
			};

			const { parser, testGen } = setupTestGen(testCast(stringMockSpec));

			// Direct mock data generator coverage
			const mockGen = testCast(testGen).mockDataGenerator;
			expect(mockGen.extractRefName("")).toBeUndefined();
			expect(
				mockGen.extractRefName("http://example.com/schema.json"),
			).toBeUndefined();
			expect(mockGen.extractRefName("#/")).toBeUndefined();

			mockGen.generate("lower-case-schema"); // Missed schemaName !== normalizedName branch
			mockGen.generateValue(
				{ $ref: "http://example.com/schema.json" },
				new Set(),
				5,
			); // Missed fallback branch

			const ops = parser.operations.filter(
				(op) =>
					op.operationId === "testStringMocks" ||
					op.operationId === "testStringMocksArray",
			);
			ops.forEach((op) => {
				op.methodName = testCast(op.operationId);
			});

			testGen.generateServiceTestFile("default", testCast(ops), "/");

			const sourceFile = project.getSourceFileOrThrow(
				"/default.service.spec.ts",
			);
			const text = sourceFile.getFullText();

			// We expect req params to be sorted before opt params
			expect(text).toContain("const req1 =");
			expect(text).toContain("const req2 =");
			expect(text).toContain("const opt1 =");
			expect(text).toContain("const opt2 =");
			expect(text).toContain('const body = "example-string"');
		});

		it("should handle named body models", () => {
			const spec = {
				openapi: "3.0.0",
				info: { title: "Edge", version: "1" },
				paths: {
					"/post-named": {
						post: {
							operationId: "postNamed",
							requestBody: {
								content: {
									"application/json": {
										schema: { $ref: "#/components/schemas/NamedModel" },
									},
								},
							},
							responses: { "200": { description: "ok" } },
						},
					},
				},
				components: {
					schemas: {
						NamedModel: {
							type: "object",
							properties: { id: { type: "integer" } },
						},
					},
				},
			};
			const { parser, testGen } = setupTestGen(testCast(spec));
			const ops = parser.operations;
			setOperationMethodNames(testCast<TestValue>(ops));

			testGen.generateServiceTestFile("named", testCast(ops), "/");
			const sourceFile = project.getSourceFileOrThrow("/named.service.spec.ts");
			const text = sourceFile.getFullText();

			expect(text).toContain(
				'const namedModel = { "id": 123 } as string | number | boolean | object | undefined | null as NamedModel;',
			);
			expect(text).toContain("service.postNamed(namedModel).subscribe({");
		});

		it("should handle edge case responses (string, boolean, model arrays) and non-model mixed bodies", () => {
			// Create specialized parser for edge cases covering remaining branches
			const edgeCaseSpec = {
				openapi: "3.0.0",
				info: { title: "Edge", version: "1" },
				paths: {
					"/return-string": {
						get: {
							operationId: "returnString",
							responses: {
								"200": {
									description: "ok",
									content: {
										"application/json": { schema: { type: "string" } },
									},
								},
							},
						},
					},
					"/return-bool": {
						get: {
							operationId: "returnBool",
							responses: {
								"200": {
									description: "ok",
									content: {
										"application/json": { schema: { type: "boolean" } },
									},
								},
							},
						},
					},
					"/return-model-array": {
						get: {
							operationId: "returnModelArray",
							responses: {
								"200": {
									description: "ok",
									content: {
										"application/json": {
											schema: {
												type: "array",
												items: { $ref: "#/components/schemas/TestModel" },
											},
										},
									},
								},
							},
						},
					},
					"/post-generic-object": {
						post: {
							operationId: "postGeneric",
							requestBody: {
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: { arbitrary: { type: "string" } },
										},
									},
								},
							},
							responses: { "200": { description: "ok" } },
						},
					},
					"/post-primitive-body": {
						post: {
							operationId: "postPrimitiveBody",
							requestBody: {
								content: {
									"application/json": {
										schema: { type: "string" },
									},
								},
							},
							responses: { "200": { description: "ok" } },
						},
					},
				},
				components: {
					schemas: {
						TestModel: {
							type: "object",
							properties: { id: { type: "integer" } },
						},
					},
				},
			};

			const { parser, testGen } = setupTestGen(testCast(edgeCaseSpec));
			const ops = parser.operations;
			setOperationMethodNames(testCast<TestValue>(ops));

			testGen.generateServiceTestFile("edge", testCast(ops), "/");
			const sourceFile = project.getSourceFileOrThrow("/edge.service.spec.ts");
			const text = sourceFile.getFullText();

			// String response
			expect(text).toContain("const mockResponse = 'test-string';");

			// Boolean response
			expect(text).toContain("const mockResponse = true;");

			// Array Model response: explicit array type validation
			// Matches `if (responseType.endsWith('[]'))`
			expect(text).toContain("const mockResponse: TestModel[] = [");

			// Generic Object Body: schema is object but no interface generated -> string | number | boolean | object | undefined | null model
			// Matches `} else if (bodyParam) {` fallback for non-primitive, non-model bodies
			expect(text).toContain(
				"const body = { data: 'test-body' } as string | number | boolean | object | undefined | null as { arbitrary?: string };",
			);

			expect(text).toContain(
				"const body = 'test-body' as string | number | boolean | object | undefined | null as string;",
			);
		});

		it("should safe-guard against null operations in internal imports collection method", () => {
			// Directly access private method to test defensive coding branch without crashing public API
			const { testGen } = setupTestGen(testCast({ paths: testCast({}) }));
			const result = testCast<{
				collectModelImports: (o: unknown) => Set<string>;
			}>(testGen).collectModelImports(null);

			expect(result).toBeDefined();
			expect(result.size).toBe(0);
		});

		it("should use parameter example value if provided in spec", () => {
			const exampleSpec = {
				openapi: "3.0.0",
				info: { title: "Param Example", version: "1.0" },
				paths: {
					"/example/{id}": {
						get: {
							operationId: "getWithExample",
							parameters: [
								{
									name: "id",
									in: "path",
									required: true,
									schema: { type: "string" },
									example: "user-123",
								},
							],
							responses: { "200": { description: "ok" } },
						},
					},
				},
			};

			const { parser, testGen } = setupTestGen(testCast(exampleSpec));
			const ops = parser.operations;
			setOperationMethodNames(testCast<TestValue>(ops));

			testGen.generateServiceTestFile("example", testCast(ops), "/");
			const sourceFile = project.getSourceFileOrThrow(
				"/example.service.spec.ts",
			);
			const text = sourceFile.getFullText();

			// Should use 'user-123' instead of generic 'test-id'
			expect(text).toContain(
				"const id = 'user-123' as string | number | boolean | object | undefined | null as string;",
			);
		});

		it("should fallback to examples map if example field is missing", () => {
			const examplesSpec = {
				openapi: "3.0.0",
				info: { title: "Params Examples Map", version: "1.0" },
				paths: {
					"/examples-map": {
						get: {
							operationId: "getWithExamplesMap",
							parameters: [
								{
									name: "status",
									in: "query",
									schema: { type: "string" },
									examples: {
										active: { value: "active-status" },
										inactive: { value: "inactive-status" },
									},
								},
							],
							responses: { "200": { description: "ok" } },
						},
					},
				},
			};

			const { parser, testGen } = setupTestGen(testCast(examplesSpec));
			const ops = parser.operations;
			setOperationMethodNames(testCast<TestValue>(ops));

			testGen.generateServiceTestFile("examples", testCast(ops), "/");
			const sourceFile = project.getSourceFileOrThrow(
				"/examples.service.spec.ts",
			);
			const text = sourceFile.getFullText();

			// Should use first example 'active-status'
			expect(text).toContain(
				"const status = 'active-status' as string | number | boolean | object | undefined | null as string;",
			);
		});

		it("should use OAS 3.2 dataValue from parameter examples", () => {
			const oas32Spec = {
				openapi: "3.2.0",
				info: { title: "OAS 3.2 Params", version: "1.0" },
				paths: {
					"/data-val": {
						get: {
							operationId: "getDataVal",
							parameters: [
								{
									name: "filter",
									in: "query",
									schema: { type: "string" },
									examples: {
										valid: {
											summary: "A valid filter",
											dataValue: "active_filter",
											serializedValue: "ignore_me",
										},
									},
								},
							],
							responses: { "200": { description: "ok" } },
						},
					},
				},
			};

			const { parser, testGen } = setupTestGen(testCast(oas32Spec));
			const ops = parser.operations;
			setOperationMethodNames(testCast<TestValue>(ops));

			testGen.generateServiceTestFile("example", testCast(ops), "/");
			const sourceFile = project.getSourceFileOrThrow(
				"/example.service.spec.ts",
			);
			const text = sourceFile.getFullText();

			// Should use 'active_filter' from dataValue
			expect(text).toContain(
				"const filter = 'active_filter' as string | number | boolean | object | undefined | null as string;",
			);
			expect(text).not.toContain("ignore_me");
		});

		it("should generate mock data for model parameters", () => {
			const modelParamSpec = {
				openapi: "3.0.0",
				info: { title: "Model Param", version: "1.0" },
				paths: {
					"/with-model": {
						get: {
							operationId: "getWithModel",
							parameters: [
								{
									name: "filter",
									in: "query",
									schema: { $ref: "#/components/schemas/Filter" },
								},
							],
							responses: { "200": { description: "ok" } },
						},
					},
				},
				components: {
					schemas: {
						Filter: { type: "object", properties: { id: { type: "string" } } },
					},
				},
			};

			const { parser, testGen } = setupTestGen(testCast(modelParamSpec));
			const ops = parser.operations;
			setOperationMethodNames(testCast<TestValue>(ops));

			testGen.generateServiceTestFile("model", testCast(ops), "/");
			const sourceFile = project.getSourceFileOrThrow("/model.service.spec.ts");
			const text = sourceFile.getFullText();

			expect(text).toContain(
				'const filter = { "id": "string-value" } as string | number | boolean | object | undefined | null as Filter;',
			);
		});

		it("should cover example extraction branches directly", () => {
			const { parser, testGen } = setupTestGen(
				testCast({ paths: testCast({}) }),
			);

			// examples map with dataValue/value/serializedValue
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { dataValue: "dv" } },
				}),
			).toBe("'dv'");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { value: "val" } },
				}),
			).toBe("'val'");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { serializedValue: "ser" } },
				}),
			).toBe("'ser'");

			const resolveSpy = vi
				.spyOn(parser, "resolveReference")
				.mockReturnValueOnce({ dataValue: "rdv" })
				.mockReturnValueOnce({ value: "rval" })
				.mockReturnValueOnce({ serializedValue: "rser" });

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { $ref: "#/components/examples/Example" } },
				}),
			).toBe("'rdv'");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { $ref: "#/components/examples/Example" } },
				}),
			).toBe("'rval'");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { $ref: "#/components/examples/Example" } },
				}),
			).toBe("'rser'");

			resolveSpy.mockRestore();

			// examples map with empty object (no keys)
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: {},
				}),
			).toBeUndefined();

			// examples map object missing known example keys
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { note: "missing" } },
				}),
			).toBeUndefined();

			const unresolvedSpy = vi
				.spyOn(parser, "resolveReference")
				.mockReturnValueOnce(undefined);
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { $ref: "#/components/examples/Missing" } },
				}),
			).toBeUndefined();
			unresolvedSpy.mockRestore();

			// examples map literal value
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: testCast("literal") },
				}),
			).toBe("'literal'");

			// schema-based examples
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string", dataValue: "sdv" },
				}),
			).toBe("'sdv'");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string", example: "sex" },
				}),
			).toBe("'sex'");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string", examples: ["ex1"] },
				}),
			).toBe("'ex1'");

			// schema $ref should skip schema example branch
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { $ref: "#/components/schemas/RefType" },
				}),
			).toBeUndefined();

			// content examples
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: { "application/json": { example: { a: 1 } } },
				}),
			).toBe(JSON.stringify({ a: 1 }));

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: {},
				}),
			).toBeUndefined();

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: { "application/json": {} },
				}),
			).toBeUndefined();

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: { "application/json": { examples: {} } },
				}),
			).toBeUndefined();

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: {
						"application/json": { examples: { a: testCast("literal") } },
					},
				}),
			).toBeUndefined();

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: {
						"application/json": {
							examples: { a: { dataValue: "cdv" } },
						},
					},
				}),
			).toBe("'cdv'");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: {
						"application/json": {
							examples: { a: { value: 42 } },
						},
					},
				}),
			).toBe("42");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: {
						"application/json": {
							examples: { a: { serializedValue: "cser" } },
						},
					},
				}),
			).toBe("'cser'");
		});

		it("should cover example fallthroughs without value keys", () => {
			const { parser, testGen } = setupTestGen(
				testCast({ paths: testCast({}) }),
			);

			const resolvedSerialized = testCast(Object.create(null));

			resolvedSerialized.serializedValue = testCast("rser-null");

			const resolveSpy = vi
				.spyOn(parser, "resolveReference")
				.mockReturnValueOnce(resolvedSerialized);
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { $ref: "#/components/examples/Example" } },
				}),
			).toBe("'rser-null'");
			resolveSpy.mockRestore();

			const emptyExamples = testCast(Object.create(null));
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },

					examples: emptyExamples,
				}),
			).toBeUndefined();

			const contentSerialized = testCast(Object.create(null));

			contentSerialized.serializedValue = testCast("cser-null");
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: {
						"application/json": {
							examples: { a: contentSerialized },
						},
					},
				}),
			).toBe("'cser-null'");
		});

		it("should cover serializedValue fallbacks for resolved and content examples", () => {
			const { parser, testGen } = setupTestGen(
				testCast({ paths: testCast({}) }),
			);

			const resolvedSpy = vi
				.spyOn(parser, "resolveReference")
				.mockReturnValueOnce({ serializedValue: "only" });
			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: { a: { $ref: "#/components/examples/Example" } },
				}),
			).toBe("'only'");
			resolvedSpy.mockRestore();

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					content: {
						"application/json": {
							examples: { a: { serializedValue: "only-content" } },
						},
					},
				}),
			).toBe("'only-content'");

			expect(
				testGen.getParameterExampleValue({
					name: "p",
					in: "query",
					schema: { type: "string" },
					examples: {},
				}),
			).toBeUndefined();
		});

		it("should handle undefined parameters in internal helpers", () => {
			const { testGen } = setupTestGen(testCast({ paths: testCast({}) }));

			const output = testGen.generateMethodTests([
				{
					methodName: "doThing",
					method: "GET",
					path: "/things/{id}",
					responses: { "200": { description: "ok" } },
					parameters: undefined,
				},
			]);

			expect(output.join("\n")).toContain("doThing");

			const imports = testGen.collectModelImports([
				{
					method: "GET",
					path: "/things/{id}",
					responses: { "200": { description: "ok" } },
					parameters: undefined,
				},
			]);

			expect(imports.size).toBe(0);
		});

		it("should handle primitive defaults in generateDefaultPrimitiveValue", () => {
			const { testGen } = setupTestGen(testCast({ paths: testCast({}) }));

			expect(
				testGen.generateDefaultPrimitiveValue({
					type: "integer",
				}),
			).toBe("123");

			expect(
				testGen.generateDefaultPrimitiveValue({
					type: "boolean",
				}),
			).toBe("true");

			expect(
				testGen.generateDefaultPrimitiveValue({
					type: "string",
				}),
			).toBe("'test-value'");

			expect(
				testGen.generateDefaultPrimitiveValue(
					{ type: "string", format: "binary" },
					"File",
				),
			).toBe('new File([""], "test.txt")');

			expect(
				testGen.generateDefaultPrimitiveValue(
					{ type: "string", format: "binary" },
					"Blob",
				),
			).toBe('new Blob([""])');

			expect(
				testGen.generateDefaultPrimitiveValue({
					type: "null",
				}),
			).toBe("'test-value'");
		});

		it("should generate arrays of mock data for array models", () => {
			const arrSpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0" },
				components: {
					schemas: {
						User: {
							type: "object",
							properties: {
								name: { type: "string" },
							},
						},
					},
				},
				paths: {
					"/users": {
						post: {
							operationId: "createUsers",
							parameters: [
								{
									name: "queryUsers",
									in: "query",
									schema: {
										type: "array",
										items: { $ref: "#/components/schemas/User" },
									},
								},
							],
							requestBody: {
								content: {
									"application/json": {
										schema: {
											type: "array",
											items: { $ref: "#/components/schemas/User" },
										},
									},
								},
							},
							responses: { "200": { description: "ok" } },
						},
					},
				},
			};

			const { parser, testGen } = setupTestGen(testCast(arrSpec));
			const ops = parser.operations;
			setOperationMethodNames(testCast<TestValue>(ops));

			testGen.generateServiceTestFile("user", testCast(ops), "/");
			const sourceFile = project.getSourceFileOrThrow("/user.service.spec.ts");
			const text = sourceFile.getFullText();

			// The query arg should be generated as an array
			expect(text).toContain(
				'const queryUsers = [{ "name": "string-value" }] as string | number | boolean | object | undefined | null as User[];',
			);
			// The body arg should be generated as an array
			expect(text).toContain("expect(req.request.body).toEqual(user);");
		});
		it("collectModelImports should include response, body, and parameter models", () => {
			const spec = {
				openapi: "3.0.0",
				info: { title: "Imports", version: "1.0" },
				paths: {
					"/with-models": {
						post: {
							operationId: "postModels",
							parameters: [
								{
									name: "filter",
									in: "query",
									schema: { $ref: "#/components/schemas/Filter" },
								},
							],
							requestBody: {
								content: {
									"application/json": {
										schema: { $ref: "#/components/schemas/BodyModel" },
									},
								},
							},
							responses: {
								"200": {
									description: "ok",
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/Resp" },
										},
									},
								},
							},
						},
					},
				},
				components: {
					schemas: {
						Filter: { type: "object", properties: { id: { type: "string" } } },
						BodyModel: {
							type: "object",
							properties: { name: { type: "string" } },
						},
						Resp: { type: "object", properties: { ok: { type: "boolean" } } },
					},
				},
			};

			const { parser, testGen } = setupTestGen(testCast(spec));

			// Set methodNames which is needed by test generator to find the schema correctly from op properties (it simulates group behavior)
			for (const op of parser.operations) {
				if (!op.methodName && op.operationId) op.methodName = op.operationId;
			}

			const imports = testGen.collectModelImports(parser.operations);

			expect(imports.has("Filter")).toBe(true);

			expect(imports.has("BodyModel")).toBe(true);

			expect(imports.has("Resp")).toBe(true);
		});

		it("should cover fallback branches in IntegrationTestGenerator", () => {
			const spec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0" },
				paths: {},
			};
			const parser = new SwaggerParser(testCast(spec), config);
			const intGen = new IntegrationTestGenerator(parser, project);
			intGen.generate(
				{
					items: [
						testCast({
							method: "post",
							path: "/items",
							requestBody: {
								content: {},
							},
						}),
						testCast({
							method: "put",
							path: "/items/{id}",
							operationId: "update_item",
							parameters: [
								{
									name: "id",
									in: "path",
									required: true,
								},
							],
							requestBody: {
								content: {
									"application/json": {
										schema: { name: "ItemPayload", type: "object" },
									},
								},
							},
						}),
					],
				},
				"/out",
			);
			const intFile = project.getSourceFileOrThrow("/out/integration.spec.ts");
			expect(intFile.getFullText()).toContain(
				"should call unknown successfully",
			);
			expect(intFile.getFullText()).toContain(
				"should call updateItem successfully",
			);
		});
	});
});
