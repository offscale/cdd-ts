/**
 * Module for service test generator in vendors/angular/test/service-test-generator.
 *
 * @module vendors/angular/test/service-test-generator
 */
// src/generators/angular/test/service-test-generator.ts

import * as path from "node:path";
import type { Project, SourceFile } from "ts-morph";
import {
	type ExampleObject,
	type GeneratorConfig,
	type OpenApiValue,
	type Parameter,
	type PathInfo,
	type ReferenceLike,
	type SwaggerDefinition,
	UNKNOWN_PAYLOAD_TYPE,
} from "../../../core/types/index.js";
import {
	camelCase,
	getBasePathTokenName,
	getTypeScriptType,
	isDataTypeInterface,
	pascalCase,
} from "../../../functions/utils.js";
import type { SwaggerParser } from "../../../openapi/parse.js";

import { MockDataGenerator } from "./mock-data.generator.js";

/** Generator/utility class `ServiceTestGenerator`. */
export class ServiceTestGenerator {
	/** Mock data generator instance used for test fixture synthesis. */
	public mockDataGenerator: MockDataGenerator;

	/**
	 * Creates a new `ServiceTestGenerator` instance.
	 * @param parser - Parsed OpenAPI specification instance.
	 * @param project - Target `ts-morph` project instance.
	 * @param config - Active generator configuration.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,

		private readonly config: GeneratorConfig,
	) {
		this.mockDataGenerator = new MockDataGenerator(parser);
	}

	/**
	 * Executes `generateServiceTestFile` on `ServiceTestGenerator`.
	 * @param controllerName - Logical controller or tag group name.
	 * @param operations - Operations belonging to the controller or resource.
	 * @param outputDir - Target output directory path.
	 */
	public generateServiceTestFile(
		controllerName: string,
		operations: PathInfo[],
		outputDir: string,
	): void {
		const serviceName = `${pascalCase(controllerName)}Service`;

		const testFileName = `${camelCase(controllerName)}.service.spec.ts`;

		const testFilePath = path.join(outputDir, testFileName);

		const sourceFile = this.project.createSourceFile(testFilePath, "", {
			overwrite: true,
		});

		const modelImports = this.collectModelImports(operations);

		this.addImports(sourceFile, serviceName, Array.from(modelImports));

		sourceFile.addStatements([
			`describe('${serviceName}', () => {`,
			`  let service: ${serviceName};`,
			`  let httpMock: HttpTestingController;`,
			"",
			`  beforeEach(() => {`,
			`    TestBed.configureTestingModule({`,
			`      providers: [`,
			`        provideHttpClient(),`,
			`        provideHttpClientTesting(),`,
			`        ${serviceName},`,
			`        { provide: ${getBasePathTokenName(this.config.clientName)}, useValue: '/api/v1' }`,
			`      ]`,
			`    });`,
			`    service = TestBed.inject(${serviceName});`,
			`    httpMock = TestBed.inject(HttpTestingController);`,
			`  });`,
			"",
			`  afterEach(() => {`,
			`    httpMock.verify();`,
			`  });`,
			"",
			`  it('should be created', () => {`,
			`    expect(service).toBeTruthy();`,
			`  });`,
			...this.generateMethodTests(operations),
			`});`,
		]);

		sourceFile.formatText();
	}

	/**
	 * Executes `generateMethodTests`.
	 * @param operations - Parameter `operations`.
	 * @returns Result of `generateMethodTests`.
	 */
	public generateMethodTests(operations: PathInfo[]): string[] {
		const tests: string[] = [];

		const knownTypes = this.parser.schemas.map((s) => s.name);

		for (const op of operations) {
			if (!op.methodName) continue;

			const {
				responseModel,
				responseType,
				bodyModel,
				bodyType,
				isPrimitiveBody,
			} = this.getMethodTypes(op);

			const params = (op.parameters ?? [])
				.map((p: Parameter) => {
					const name = camelCase(p.name);

					const type = getTypeScriptType(
						p.schema as SwaggerDefinition,
						this.config,
						knownTypes,
					);

					const modelName = isDataTypeInterface(
						type.replace(/\[\]| \| null/g, ""),
					)
						? type.replace(/\[\]| \| null/g, "")
						: undefined;
					let value: string;

					if (modelName) {
						value = this.mockDataGenerator.generate(modelName);

						if (type.includes("[]")) value = `[${value}]`;
					} else {
						value =
							this.getParameterExampleValue(p) ??
							this.generateDefaultPrimitiveValue(p.schema, type);
					}

					return { name, value, type, modelName, required: p.required };
				})

				.sort((a, b) => (a.required ? 0 : 1) - (b.required ? 0 : 1));

			const bodyParam = op.requestBody?.content?.["application/json"]
				? {
						name: isPrimitiveBody
							? "body"
							: bodyModel
								? camelCase(bodyModel)
								: "body",
						model: bodyModel,
						type: bodyType,
						isPrimitive: isPrimitiveBody,
					}
				: null;

			const allArgs = [
				...params.map((p) => p.name),
				...(bodyParam ? [bodyParam.name] : []),
			];

			const declareParams = (): string[] => {
				const lines: string[] = [];

				if (bodyParam?.model) {
					let mockData = this.mockDataGenerator.generate(bodyParam.model);

					if (bodyParam.type.includes("[]") && mockData)
						mockData = `[${mockData}]`;

					mockData = mockData.startsWith('"') ? mockData : String(mockData);

					lines.push(
						`      const ${bodyParam.name} = ${mockData.replace(/"new globalThis\.Date\(\)"/g, "new globalThis.Date()")} as ${bodyParam.type};`,
					);
				} else if (bodyParam?.isPrimitive) {
					lines.push(
						`      const ${bodyParam.name} = 'test-body' as ${bodyParam.type};`,
					);
				} else if (bodyParam) {
					lines.push(
						`      const ${bodyParam.name} = { data: 'test-body' } as ${bodyParam.type};`,
					);
				}

				params.forEach((p) => {
					lines.push(`      const ${p.name} = ${p.value} as ${p.type};`);
				});

				return lines;
			};

			const url = op.path.replace(
				/{(\w+)}/g,
				(_, paramName: string) => `\${${camelCase(paramName)}}`,
			);

			tests.push(`\n  describe('${op.methodName}()', () => {`);

			tests.push(`    it('should return ${responseType} on success', () => {`);

			let mockResponseValue: string = "null";

			if (responseModel) {
				if (responseType.endsWith("[]")) {
					let mockData = this.mockDataGenerator.generate(responseModel);

					mockData = mockData.startsWith('"') ? mockData : String(mockData);

					mockResponseValue = `[${mockData.replace(/"new globalThis\.Date\(\)"/g, "new globalThis.Date()")}]`;
				} else {
					const mockData = this.mockDataGenerator.generate(responseModel);

					mockResponseValue = mockData.startsWith('"')
						? mockData
						: String(mockData);

					mockResponseValue = mockResponseValue.replace(
						/"new globalThis\.Date\(\)"/g,
						"new globalThis.Date()",
					);
				}
			} else if (responseType === "string") {
				mockResponseValue = "'test-string'";
			} else if (responseType === "number") {
				mockResponseValue = "123";
			} else if (responseType === "boolean") {
				mockResponseValue = "true";
			}

			tests.push(
				`      const mockResponse${responseModel ? `: ${responseType}` : ""} = ${mockResponseValue};`,
			);

			tests.push(...declareParams());

			tests.push(
				`      service.${op.methodName}(${allArgs.join(", ")}).subscribe({`,
			);

			tests.push(
				`        next: response => expect(response).toEqual(mockResponse),`,
			);

			tests.push(`        error: err => { throw err; }`);

			tests.push(`      });`);

			tests.push(
				`            const req = httpMock.expectOne(req => req.url.startsWith(\`/api/v1${url}\`));`,
			);

			tests.push(
				`      expect(req.request.method).toBe('${op.method.toUpperCase()}');`,
			);

			if (bodyParam) {
				tests.push(
					`      expect(req.request.body).toEqual(${bodyParam.name});`,
				);
			}

			tests.push(`      req.flush(mockResponse);`);

			tests.push(`    });`);

			tests.push(`    it('should handle a 404 error', () => {`);

			tests.push(...declareParams());

			tests.push(
				`      service.${op.methodName}(${allArgs.join(", ")}).subscribe({`,
			);

			tests.push(
				`        next: () => { throw new globalThis.Error('should have failed with a 404 error'); },`,
			);

			tests.push(`        error: error => expect(error.status).toBe(404),`);

			tests.push(`      });`);

			tests.push(
				`            const req = httpMock.expectOne(req => req.url.startsWith(\`/api/v1${url}\`));`,
			);

			tests.push(
				`      req.flush('Not Found', { status: 404, statusText: 'Not Found' });`,
			);

			tests.push(`    });`);

			tests.push(`  });`);
		}

		return tests;
	}

	/**
	 * Executes `generateDefaultPrimitiveValue`.
	 * @param schema - Parameter `schema`.
	 * @param tsType - Parameter `tsType`.
	 * @returns Result of `generateDefaultPrimitiveValue`.
	 */
	public generateDefaultPrimitiveValue(
		schema: SwaggerDefinition | { $ref: string } | boolean | undefined,
		tsType?: string,
	): string {
		if (tsType === "File") return `new File([""], "test.txt")`;

		if (tsType === "Blob") return `new Blob([""])`;

		const resolvedSchema = this.parser.resolve<SwaggerDefinition>(
			schema as ReferenceLike,
		);

		if (
			resolvedSchema &&
			(resolvedSchema.type === "number" || resolvedSchema.type === "integer")
		) {
			return "123";
		} else if (resolvedSchema && resolvedSchema.type === "boolean") {
			return "true";
		} else {
			return `'test-value'`;
		}
	}

	/**
	 * Executes `getParameterExampleValue`.
	 * @param param - Parameter `param`.
	 * @returns Result of `getParameterExampleValue`.
	 */
	public getParameterExampleValue(param: Parameter): string | undefined {
		let potentialValue: OpenApiValue;

		const pickExampleValue = (
			example: OpenApiValue,
		): {
			found: boolean;
			value: OpenApiValue;
		} => {
			if (!example || typeof example !== "object")
				return { found: false, value: null };

			const exRecord = example as Record<string, OpenApiValue>;

			if (Object.hasOwn(exRecord, "dataValue")) {
				return {
					found: true,
					value: exRecord.dataValue,
				};
			}

			if (Object.hasOwn(exRecord, "value")) {
				return {
					found: true,
					value: exRecord.value,
				};
			}

			if (Object.hasOwn(exRecord, "serializedValue")) {
				return {
					found: true,
					value: exRecord.serializedValue,
				};
			}

			return { found: false, value: null };
		};

		if (param.example !== undefined) {
			potentialValue = param.example;
		} else if (param.examples && typeof param.examples === "object") {
			const firstExample = Object.values(param.examples)[0];

			if (firstExample !== undefined) {
				const directValue = pickExampleValue(firstExample);

				if (directValue.found) {
					potentialValue = directValue.value;
				} else if (
					firstExample &&
					typeof firstExample === "object" &&
					Object.hasOwn(firstExample, "$ref")
				) {
					const resolved = this.parser.resolveReference<ExampleObject>(
						(firstExample as { $ref: string }).$ref,
					);

					const resolvedValue = pickExampleValue(resolved);

					if (resolvedValue.found) potentialValue = resolvedValue.value;
				} else if (firstExample === null || typeof firstExample !== "object") {
					potentialValue = firstExample;
				}
			}
		} else if (
			param.schema &&
			typeof param.schema === "object" &&
			!("$ref" in param.schema)
		) {
			const schema = param.schema as Record<string, OpenApiValue>;

			if (schema.dataValue !== undefined) {
				potentialValue = schema.dataValue;
			} else if (schema.example !== undefined) {
				potentialValue = schema.example;
			} else if (
				schema.examples &&
				Array.isArray(schema.examples) &&
				(schema.examples as OpenApiValue[]).length > 0
			) {
				potentialValue = (schema.examples as OpenApiValue[])[0];
			}
		}

		if (potentialValue === undefined && param.content) {
			const contentType = Object.keys(param.content)[0];

			if (contentType) {
				const media = param.content[contentType];

				if (media && media.example !== undefined) {
					potentialValue = media.example;
				} else if (media?.examples) {
					const keys = Object.keys(media.examples);
					const firstKey = keys[0];

					if (firstKey) {
						const ex = (media.examples as Record<string, OpenApiValue>)[
							firstKey
						];

						const contentValue = pickExampleValue(ex);

						if (contentValue.found) potentialValue = contentValue.value;
					}
				}
			}
		}

		if (potentialValue !== undefined) {
			if (typeof potentialValue === "string") return `'${potentialValue}'`;

			if (typeof potentialValue === "object")
				return JSON.stringify(potentialValue);

			return String(potentialValue);
		}

		return undefined;
	}

	private addImports(
		sourceFile: SourceFile,
		serviceName: string,
		modelImports: string[],
	): void {
		sourceFile.addImportDeclarations([
			{ moduleSpecifier: "@angular/core/testing", namedImports: ["TestBed"] },
			{
				moduleSpecifier: "@angular/common/http",
				namedImports: ["provideHttpClient"],
			},
			{
				moduleSpecifier: "@angular/common/http/testing",
				namedImports: ["HttpTestingController", "provideHttpClientTesting"],
			},
			{
				moduleSpecifier: `./${camelCase(serviceName.replace(/Service$/, ""))}.service`,
				namedImports: [serviceName],
			},
		]);

		if (modelImports.length > 0) {
			sourceFile.addImportDeclaration({
				moduleSpecifier: `../models`,
				namedImports: modelImports,
			});
		}

		sourceFile.addImportDeclaration({
			moduleSpecifier: "../tokens",
			namedImports: [getBasePathTokenName(this.config.clientName)],
		});
	}

	private getMethodTypes(op: PathInfo): {
		responseModel?: string;
		responseType: string;
		bodyModel?: string;
		bodyType: string;
		isPrimitiveBody: boolean;
	} {
		const knownTypes = this.parser.schemas.map((s) => s.name);

		const successResponseSchema =
			op.responses?.["200"]?.content?.["application/json"]?.schema;

		const responseType = successResponseSchema
			? getTypeScriptType(
					successResponseSchema as SwaggerDefinition,
					this.config,
					knownTypes,
				)
			: UNKNOWN_PAYLOAD_TYPE;

		const responseModelType = responseType.replace(/\[\]| \| null/g, "");

		const responseModel = isDataTypeInterface(responseModelType)
			? responseModelType
			: undefined;

		const requestBodySchema =
			op.requestBody?.content?.["application/json"]?.schema;

		const resolvedBodySchema = this.parser.resolve(
			requestBodySchema as SwaggerDefinition,
		);

		const bodyType = requestBodySchema
			? getTypeScriptType(
					requestBodySchema as SwaggerDefinition,
					this.config,
					knownTypes,
				)
			: UNKNOWN_PAYLOAD_TYPE;

		const bodyModelType = bodyType.replace(/\[\]| \| null/g, "");

		const bodyModel = isDataTypeInterface(bodyModelType)
			? bodyModelType
			: undefined;
		const isPrimitiveBody =
			!!resolvedBodySchema &&
			!resolvedBodySchema.properties &&
			["string", "number", "boolean"].includes(
				resolvedBodySchema.type as string,
			);

		return {
			responseType,
			bodyType,
			isPrimitiveBody,
			...(responseModel !== undefined ? { responseModel } : {}),
			...(bodyModel !== undefined ? { bodyModel } : {}),
		};
	}

	/**
	 * Executes `collectModelImports`.
	 * @param operations - Parameter `operations`.
	 * @returns Result of `collectModelImports`.
	 */
	public collectModelImports(
		operations: PathInfo[] | null | undefined,
	): Set<string> {
		const modelImports = new Set<string>();

		const knownTypes = this.parser.schemas.map((s) => s.name);

		if (!operations) {
			return modelImports;
		}

		for (const op of operations) {
			const { responseModel, bodyModel } = this.getMethodTypes(op);

			if (responseModel) modelImports.add(responseModel);

			if (bodyModel) modelImports.add(bodyModel);

			(op.parameters ?? []).forEach((param: Parameter) => {
				const typeName = getTypeScriptType(
					param.schema as SwaggerDefinition,
					this.config,
					knownTypes,
				).replace(/\[\]| \| null/g, "");

				if (isDataTypeInterface(typeName)) {
					modelImports.add(typeName);
				}
			});
		}

		return modelImports;
	}
}
