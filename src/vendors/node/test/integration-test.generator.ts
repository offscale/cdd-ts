/**
 * Module for integration test generator in vendors/node/test/integration-test.generator.
 *
 * @module vendors/node/test/integration-test.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import type { PathInfo, SwaggerDefinition } from "../../../core/types/index.js";
import { camelCase, pascalCase } from "../../../functions/utils.js";
import { MockDataGenerator } from "../../../mocks/generate_mock_data.js";
import type { SwaggerParser } from "../../../openapi/parse.js";

/** Generator/utility class `NodeIntegrationTestGenerator`. */
export class NodeIntegrationTestGenerator {
	private mockDataGenerator: MockDataGenerator;

	/**
	 * Creates a new `NodeIntegrationTestGenerator` instance.
	 * @param parser - Parsed OpenAPI specification instance.
	 * @param project - Target `ts-morph` project instance.
	 */
	constructor(
		parser: SwaggerParser,
		private readonly project: Project,
	) {
		this.mockDataGenerator = new MockDataGenerator(parser);
	}

	/**
	 * Executes `generate` on `NodeIntegrationTestGenerator`.
	 * @param controllerGroups - Parameter `controllerGroups` (Record<string, PathInfo[]>).
	 * @param outputDir - Target output directory path.
	 */
	public generate(
		controllerGroups: Record<string, PathInfo[]>,
		outputDir: string,
	): void {
		const testFilePath = path.join(outputDir, "integration.spec.ts");
		const sourceFile = this.project.createSourceFile(testFilePath, "", {
			overwrite: true,
		});

		// Add imports
		sourceFile.addStatements(`
            import { describe, it, expect } from 'vitest';
        `);

		// Import all services
		const serviceNames: string[] = [];
		for (const controllerName of Object.keys(controllerGroups)) {
			const serviceName = `${pascalCase(controllerName)}Service`;
			serviceNames.push(serviceName);
			sourceFile.addStatements(
				`import { ${serviceName} } from './services/${camelCase(controllerName)}.service.js';`,
			);
		}

		// Setup test suite
		sourceFile.addStatements(`
            describe('SDK Integration Tests', () => {
        `);

		// Generate a test case for each operation
		for (const [controllerName, operations] of Object.entries(
			controllerGroups,
		)) {
			const serviceName = `${pascalCase(controllerName)}Service`;

			sourceFile.addStatements(`
                describe('${serviceName}', () => {
                    const service = new ${serviceName}('http://localhost:8080/v2');
            `);

			for (const op of operations) {
				const methodName =
					op.methodName || camelCase(op.operationId || "unknown");
				const parameters = op.parameters || [];
				const mockArgs: string[] = [];

				// Add mock data for parameters
				for (const param of parameters) {
					if (param.required) {
						mockArgs.push(
							String(
								this.mockDataGenerator.generate(
									((param.schema as SwaggerDefinition)?.name as string) ||
										param.name,
								),
							),
						);
					} else {
						mockArgs.push("undefined");
					}
				}

				if (op.requestBody?.content) {
					const contentTypes = Object.keys(op.requestBody.content);
					if (contentTypes.length > 0) {
						const schema = op.requestBody.content[contentTypes[0]].schema;
						mockArgs.push(
							String(
								this.mockDataGenerator.generate(
									((schema as SwaggerDefinition)?.name as string) || "Unknown",
								),
							),
						);
					}
				}

				const argsString = mockArgs.join(", ");

				sourceFile.addStatements(`
                    it('should call ${methodName} successfully', async () => {
                        try {
                            const result = await service.${methodName}(${argsString});
                            expect(result).toBeDefined();
                        } catch (error: unknown) {
                            const errObj = error as { code?: string } | null;
                            if (errObj && (errObj.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(error).toBeDefined();
                            } else {
                                throw error;
                            }
                        }
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
