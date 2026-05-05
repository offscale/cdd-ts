import { Project } from 'ts-morph';
import * as path from 'node:path';
import { SwaggerParser } from '@src/openapi/parse.js';
import { GeneratorConfig, PathInfo } from '@src/core/types/index.js';
import { AbstractClientGenerator } from '../../core/generator.js';
import { FetchClientGenerator } from '../fetch/fetch-client.generator.js';
import { camelCase, pascalCase } from '@src/functions/utils.js';
import { ServiceMethodAnalyzer } from '@src/functions/parse_analyzer.js';

function getControllerCanonicalName(op: PathInfo): string {
    if (Array.isArray(op.tags) && op.tags[0]) {
        return pascalCase(op.tags[0].toString());
    }
    const firstSegment = op.path.split('/').filter(Boolean)[0];
    return firstSegment ? pascalCase(firstSegment) : 'Default';
}

function groupPathsByCanonicalController(parser: SwaggerParser): Record<string, PathInfo[]> {
    const groups: Record<string, PathInfo[]> = {};
    for (const op of parser.operations) {
        const group = getControllerCanonicalName(op);
        if (!groups[group]) groups[group] = [];
        groups[group].push(op);
    }
    return groups;
}

/**
 * Generates a React-based API client.
 * It delegates to the Fetch client generation as the foundation,
 * and then generates React-specific hooks for each service.
 */
export class ReactClientGenerator extends AbstractClientGenerator {
    /**
     * Executes the generation pipeline for the React client.
     * @param project The ts-morph Project to use for generation.
     * @param parser The parsed Swagger/OpenAPI model.
     * @param config The generator configuration options.
     * @param outputRoot The target output directory.
     * @returns A promise that resolves when generation finishes.
     */
    public async generate(
        project: Project,
        parser: SwaggerParser,
        config: GeneratorConfig,
        outputRoot: string,
    ): Promise<void> {
        // React utilizes the Fetch client primitives
        const baseGenerator = new FetchClientGenerator();
        await baseGenerator.generate(project, parser, config, outputRoot);

        project.createSourceFile(
            path.join(outputRoot, 'provider.tsx'),
            `
import React, { createContext, useContext, ReactNode } from 'react';

export interface ApiConfig {
    basePath?: string;
    headers?: Record<string, string>;
    server?: number | string;
    serverVariables?: Record<string, string>;
}

const ApiContext = createContext<ApiConfig>({});

export const ApiProvider = ({ config, children }: { config: ApiConfig; children: ReactNode }) => (
    <ApiContext.Provider value={config}>
        {children}
    </ApiContext.Provider>
);

export const useApiContext = () => useContext(ApiContext);
        `.trim(),
            { overwrite: true },
        );

        const hooksDir = path.join(outputRoot, 'hooks');
        const hooksIndex = project.createSourceFile(
            path.join(hooksDir, 'index.ts'),
            `export * from '../provider.js';\n`,
            { overwrite: true },
        );

        const operationsByController = groupPathsByCanonicalController(parser);
        const analyzer = new ServiceMethodAnalyzer(config, parser);

        for (const [controllerName, operations] of Object.entries(operationsByController)) {
            const serviceName = `${pascalCase(controllerName)}Service`;
            const hookName = `use${serviceName}`;
            const fileName = `${camelCase(controllerName)}.hook.ts`;
            const filePath = path.join(hooksDir, fileName);

            const hookFile = project.createSourceFile(filePath, '', { overwrite: true });

            hookFile.addImportDeclarations([
                {
                    moduleSpecifier: 'react',
                    namedImports: ['useState'],
                },
                {
                    moduleSpecifier: 'swr',
                    defaultImport: 'useSWR',
                    namedImports: ['SWRConfiguration'],
                },
                {
                    moduleSpecifier: 'swr/mutation',
                    defaultImport: 'useSWRMutation',
                    namedImports: ['SWRMutationConfiguration'],
                },
                {
                    moduleSpecifier: `../services/${camelCase(controllerName)}.service.js`,
                    namedImports: [serviceName],
                },
                {
                    moduleSpecifier: '../provider.js',
                    namedImports: ['useApiContext'],
                },
            ]);

            hookFile.addFunction({
                name: hookName,
                isExported: true,
                statements: `const [service] = useState(() => new ${serviceName}());\nreturn service;`,
            });

            const usedNames = new Set<string>();

            for (const op of operations) {
                let suggestedName =
                    op.methodName ||
                    op.operationId ||
                    camelCase(op.method.toLowerCase() + '_' + op.path.replace(/[^\w]/g, ' '));
                if (suggestedName.includes('-') || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(suggestedName)) {
                    suggestedName = camelCase(suggestedName.replace(/[^\w]/g, ' '));
                }

                let finalName = suggestedName;
                let counter = 2;
                while (usedNames.has(finalName)) {
                    finalName = `${suggestedName}${counter++}`;
                }
                usedNames.add(finalName);
                op.methodName = finalName;

                const model = analyzer.analyze(op)!;

                const isGet = model.httpMethod.toLowerCase() === 'get';
                const methodHookName = `use${pascalCase(model.methodName)}`;
                const returnType = model.responseType; // Note: may need actual types imported

                const paramList = model.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
                const paramArgs = model.parameters.map(p => p.name).join(', ');
                const cacheKey = `['${model.methodName}', ${paramArgs ? paramArgs : "''"}]`;
                const executionArgs = paramArgs ? `${paramArgs}, apiConfig` : 'apiConfig';

                if (isGet) {
                    hookFile.addFunction({
                        name: methodHookName,
                        isExported: true,
                        parameters: [
                            ...model.parameters,
                            { name: 'config', type: `SWRConfiguration<${returnType}, any>`, hasQuestionToken: true },
                        ],
                        statements: `
                            const [service] = useState(() => new ${serviceName}());
                            const apiConfig = useApiContext();
                            return useSWR(
                                ${cacheKey},
                                () => service.${model.methodName}(${executionArgs}),
                                config
                            );
                        `,
                    });
                } else {
                    hookFile.addFunction({
                        name: methodHookName,
                        isExported: true,
                        parameters: [
                            {
                                name: 'config',
                                type: `SWRMutationConfiguration<${returnType}, any, any, any>`,
                                hasQuestionToken: true,
                            },
                        ],
                        statements: `
                            const [service] = useState(() => new ${serviceName}());
                            const apiConfig = useApiContext();
                            return useSWRMutation(
                                '${model.methodName}',
                                (key, { arg }: { arg: { ${paramList} } }) => service.${model.methodName}(${model.parameters.map(p => `arg.${p.name}`).join(', ') || ''}${model.parameters.length > 0 ? ', apiConfig' : 'apiConfig'}),
                                config
                            );
                        `,
                    });
                }
            }

            hookFile.formatText();

            hooksIndex.addExportDeclaration({
                moduleSpecifier: `./${fileName.replace('.ts', '.js')}`,
                namedExports: [hookName],
            });
        }
        hooksIndex.formatText();
    }
}
