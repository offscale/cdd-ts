/**
 * Generates Angular `TestBed` integration test suites for generated SDK services.
 *
 * @module vendors/angular/test/integration-test.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import type { PathInfo, SwaggerDefinition } from "../../../core/types/index.js";
import {
	camelCase,
	getBasePathTokenName,
	pascalCase,
} from "../../../functions/utils.js";
import type { SwaggerParser } from "../../../openapi/parse.js";
import { MockDataGenerator } from "./mock-data.generator.js";

/**
 * Generates `integration.spec.ts` for Angular SDK clients.
 */
export class IntegrationTestGenerator {
	private mockDataGenerator: MockDataGenerator;

	/**
	 * Creates a new `IntegrationTestGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The target `ts-morph` project.
	 */
	constructor(
		parser: SwaggerParser,
		private readonly project: Project,
	) {
		this.mockDataGenerator = new MockDataGenerator(parser);
	}

	/**
	 * Generates `integration.spec.ts` in the specified output directory.
	 *
	 * @param controllerGroups - Operations grouped by controller name.
	 * @param outputDir - Target output directory.
	 * @param clientName - Optional client identifier for multi-client setups.
	 */
	public generate(
		controllerGroups: Record<string, PathInfo[]>,
		outputDir: string,
		clientName?: string,
	): void {
		const testFilePath = path.join(outputDir, "integration.spec.ts");
		const sourceFile = this.project.createSourceFile(testFilePath, "", {
			overwrite: true,
		});

		sourceFile.addStatements(`
            import { TestBed } from '@angular/core/testing';
            import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
            import { firstValueFrom } from 'rxjs';
        `);

		const serviceNames: string[] = [];
		for (const controllerName of Object.keys(controllerGroups)) {
			const serviceName = `${pascalCase(controllerName)}Service`;
			serviceNames.push(serviceName);
			sourceFile.addStatements(
				`import { ${serviceName} } from './services/${camelCase(controllerName)}.service';`,
			);
		}

		const basePathTokenName = getBasePathTokenName(clientName || "default");

		sourceFile.addStatements(
			`import { ${basePathTokenName} } from './tokens';`,
		);

		sourceFile.addStatements(`
            describe('SDK Integration Tests', () => {
                let httpMock: HttpTestingController;

                beforeEach(() => {
                    TestBed.configureTestingModule({
                        imports: [HttpClientTestingModule],
                        providers: [
                            ${serviceNames.join(`,${String.fromCharCode(10)}                            `)},
                            { provide: ${basePathTokenName}, useValue: 'http://localhost:8080/v2' }
                        ]
                    });
                    httpMock = TestBed.inject(HttpTestingController);
                });

                afterEach(() => {
                    httpMock.verify();
                });
        `);

		for (const [controllerName, operations] of Object.entries(
			controllerGroups,
		)) {
			const serviceName = `${pascalCase(controllerName)}Service`;

			sourceFile.addStatements(`
                describe('${serviceName}', () => {
            `);

			for (const op of operations) {
				const methodName =
					op.methodName || camelCase(op.operationId || "unknown");
				const parameters = op.parameters || [];
				const mockArgs: string[] = [];

				for (const param of parameters) {
					if (param.required) {
						const schemaDef = (param.schema || param) as SwaggerDefinition;
						const schemaName = schemaDef?.name || param.name;
						mockArgs.push(
							`${this.mockDataGenerator.generate(String(schemaName))} as never`,
						);
					} else {
						mockArgs.push("null as never");
					}
				}

				if (op.requestBody?.content) {
					const contentTypes = Object.keys(op.requestBody.content);
					if (contentTypes.length > 0) {
						const schema = op.requestBody.content[contentTypes[0]!]?.schema;
						const schemaDef = schema as SwaggerDefinition;
						const schemaName = schemaDef?.name ? schemaDef.name : "Unknown";
						mockArgs.push(
							`${this.mockDataGenerator.generate(String(schemaName))} as never`,
						);
					}
				}

				const argsString = mockArgs.join(", ");

				sourceFile.addStatements(`
                    it('should call ${methodName} successfully', async () => {
                        const service = TestBed.inject(${serviceName});
                        const mockResponse = {};
                        const resultPromise = firstValueFrom(service.${methodName}(${argsString}));
                        const req = httpMock.expectOne((r) => r.method === '${op.method.toUpperCase()}');
                        req.flush(mockResponse);
                        const result = await resultPromise;
                        expect(result).toEqual(mockResponse);
                    });
                `);
			}

			sourceFile.addStatements(`
                });
            `);
		}

		sourceFile.addStatements(`
            });
        `);
	}
}
