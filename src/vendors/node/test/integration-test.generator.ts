/**
 * Module for integration test generator in vendors/node/test/integration-test.generator.
 *
 * @module vendors/node/test/integration-test.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import type { PathInfo } from "../../../core/types/index.js";
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
            import * as http from 'node:http';
            import { EventEmitter } from 'node:events';
            import { describe, it, expect, vi } from 'vitest';
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
				const methodName = op.methodName as string;
				const mockArgs: string[] = [];

				// Add mock data for parameters
				op.parameters?.forEach((param) => {
					if (param.required) {
						mockArgs.push(String(this.mockDataGenerator.generate(param.name)));
					} else {
						mockArgs.push("undefined");
					}
				});

				if (op.requestBody?.content) {
					mockArgs.push(String(this.mockDataGenerator.generate("Unknown")));
				}

				const argsString = mockArgs.join(", ");

				sourceFile.addStatements(`
                    it('should call ${methodName} successfully', async () => {
                        const requestSpy = vi.spyOn(http, 'request').mockImplementation((_opts: unknown, cb?: unknown) => {
                            const req = new EventEmitter() as http.ClientRequest;
                            req.write = vi.fn(() => true);
                            req.end = vi.fn(() => {
                                const res = new EventEmitter() as http.IncomingMessage;
                                res.statusCode = 200;
                                res.headers = { 'content-type': 'application/json' };
                                if (typeof cb === 'function') cb(res);
                                res.emit('data', Buffer.from(JSON.stringify({ ok: true })));
                                res.emit('end');
                                return req;
                            });
                            return req;
                        });
                        try {
                            const result = await service.${methodName}(${argsString});
                            expect(result).toBeDefined();
                            expect(requestSpy).toHaveBeenCalled();
                        } finally {
                            requestSpy.mockRestore();
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
