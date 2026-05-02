/* v8 ignore start */
import { Project } from 'ts-morph';
import * as path from 'node:path';
import { SwaggerParser } from '@src/openapi/parse.js';
import { GeneratorConfig, PathInfo } from '@src/core/types/index.js';
import { camelCase, pascalCase } from '@src/functions/utils.js';

export class NodeServiceTestGenerator {
    constructor(
        private readonly parser: SwaggerParser,
        private readonly project: Project,
        private readonly config: GeneratorConfig,
    ) {
        // Prevent unused warnings
        this.parser;
        this.config;
    }

    public generateServiceTestFile(controllerName: string, operations: PathInfo[], servicesDir: string): void {
        const serviceName = `${pascalCase(controllerName)}Service`;
        const fileName = `${camelCase(controllerName)}.service.spec.ts`;
        const filePath = path.join(servicesDir, fileName);

        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addImportDeclarations([
            {
                moduleSpecifier: 'vitest',
                namedImports: ['describe', 'it', 'expect', 'vi', 'beforeEach', 'afterEach'],
            },
            {
                moduleSpecifier: 'https',
                defaultImport: 'https',
            },
            {
                moduleSpecifier: 'http',
                defaultImport: 'http',
            },
            {
                moduleSpecifier: `./${camelCase(controllerName)}.service.js`,
                namedImports: [serviceName],
            },
        ]);

        const testLines: string[] = [];
        testLines.push(`describe('${serviceName}', () => {`);
        testLines.push(`    let service: ${serviceName};`);
        testLines.push(``);
        testLines.push(`    beforeEach(() => {`);
        testLines.push(`        service = new ${serviceName}();`);
        testLines.push(`        vi.spyOn(https, 'request').mockImplementation((...args: any[]) => {`);
        testLines.push(`            const req = {`);
        testLines.push(`                on: vi.fn(),`);
        testLines.push(`                write: vi.fn(),`);
        testLines.push(`                end: vi.fn((cb?: () => void) => {`);
        testLines.push(`                    const res = {`);
        testLines.push(`                        statusCode: 200,`);
        testLines.push(`                        headers: {},`);
        testLines.push(`                        on: (event: string, handler: any) => {`);
        testLines.push(`                            if (event === 'data') handler(Buffer.from('{}'));`);
        testLines.push(`                            if (event === 'end') handler();`);
        testLines.push(`                        }`);
        testLines.push(`                    };`);
        testLines.push(`                    const callback = args.find(arg => typeof arg === 'function');`);
        testLines.push(`                    if (callback) callback(res);`);
        testLines.push(`                    if (cb) cb();`);
        testLines.push(`                })`);
        testLines.push(`            };`);
        testLines.push(`            return req as any;`);
        testLines.push(`        });`);
        testLines.push(`    });`);
        testLines.push(``);
        testLines.push(`    afterEach(() => {`);
        testLines.push(`        vi.restoreAllMocks();`);
        testLines.push(`    });`);
        testLines.push(``);

        for (const op of operations) {
            const methodName =
                op.methodName || camelCase(op.operationId || `${op.method}_${op.path.replace(/[^a-zA-Z0-9]/g, '_')}`);
            testLines.push(`    describe('${methodName}', () => {`);
            testLines.push(
                `        it('should make a ${op.method.toUpperCase()} request to ${op.path}', async () => {`,
            );
            testLines.push(``);

            // Build simple params
            const params: string[] = [];

            if (op.parameters && op.parameters.length > 0) {
                const requiredParams = op.parameters.filter(p => !('in' in p) || p.required);
                for (const p of requiredParams) {
                    params.push(`'test_${p.name}'`);
                }
            }
            if (op.requestBody) {
                params.push(`{}`);
            }

            const paramString = params.join(', ');

            testLines.push(`            const result = await service.${methodName}(${paramString});`);
            testLines.push(`            expect(https.request).toHaveBeenCalled();`);
            testLines.push(`            expect(result).toBeDefined();`);
            testLines.push(`        });`);
            testLines.push(`    });`);
            testLines.push(``);
        }

        testLines.push(`});`);

        sourceFile.addStatements(testLines.join('\n'));
        sourceFile.formatText();
    }
}
/* v8 ignore stop */
