import { Project } from 'ts-morph';
import * as path from 'node:path';
import { SwaggerParser } from '@src/openapi/parse.js';
import { GeneratorConfig, PathInfo } from '@src/core/types/index.js';
import { AbstractClientGenerator } from '../../core/generator.js';
import { FetchClientGenerator } from '../fetch/fetch-client.generator.js';
import { camelCase, pascalCase } from '@src/functions/utils.js';
import { VueAdminGenerator } from './admin/admin.generator.js';

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
 * Generates a Vue-based API client.
 * It delegates to the Fetch client generation as the foundation,
 * and then generates Vue-specific composables for each service.
 */
export class VueClientGenerator extends AbstractClientGenerator {
    /**
     * Executes the generation pipeline for the Vue client.
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
        // Vue utilizes the Fetch client primitives
        const baseGenerator = new FetchClientGenerator();
        await baseGenerator.generate(project, parser, config, outputRoot);

        if (config.options?.admin) {
            await new VueAdminGenerator(parser, project).generate(outputRoot);
        }

        const composablesDir = path.join(outputRoot, 'composables');
        const composablesIndex = project.createSourceFile(path.join(composablesDir, 'index.ts'), '', {
            overwrite: true,
        });

        const pluginFile = project.createSourceFile(path.join(outputRoot, 'plugin.ts'), '', { overwrite: true });
        pluginFile.addImportDeclarations([{ moduleSpecifier: 'vue', namedImports: ['App', 'InjectionKey'] }]);

        const operationsByController = groupPathsByCanonicalController(parser);

        const serviceImports: string[] = [];
        const injectionKeys: string[] = [];
        const provideStatements: string[] = [];

        for (const controllerName of Object.keys(operationsByController)) {
            const serviceName = `${pascalCase(controllerName)}Service`;
            const hookName = `use${serviceName}`;
            const injectionKeyName = `${serviceName}Key`;
            const fileName = `${camelCase(controllerName)}.composable.ts`;
            const filePath = path.join(composablesDir, fileName);

            serviceImports.push(`import { ${serviceName} } from './services/${camelCase(controllerName)}.service.js';`);
            injectionKeys.push(
                `export const ${injectionKeyName}: InjectionKey<${serviceName}> = Symbol('${serviceName}');`,
            );
            provideStatements.push(`app.provide(${injectionKeyName}, new ${serviceName}(options?.config));`);

            const hookFile = project.createSourceFile(filePath, '', { overwrite: true });

            hookFile.addImportDeclarations([
                {
                    moduleSpecifier: 'vue',
                    namedImports: ['inject'],
                },
                {
                    moduleSpecifier: `../plugin.js`,
                    namedImports: [injectionKeyName],
                },
                {
                    moduleSpecifier: `../services/${camelCase(controllerName)}.service.js`,
                    namedImports: [serviceName],
                },
            ]);

            hookFile.addStatements(
                [
                    `/**`,
                    ` * Injects the ${serviceName} instance.`,
                    ` * Ensure the API plugin is installed in your Vue app.`,
                    ` * @returns The ${serviceName} instance.`,
                    ` * @throws If the service is not provided.`,
                    ` */`,
                    `export function ${hookName}(): ${serviceName} {`,
                    `    const service = inject(${injectionKeyName});`,
                    `    if (!service) {`,
                    `        throw new Error('API Client not installed. Please use the ApiClientPlugin in your Vue app.');`,
                    `    }`,
                    `    return service;`,
                    `}`,
                ].join('\n'),
            );
            hookFile.formatText();

            composablesIndex.addExportDeclaration({
                moduleSpecifier: `./${fileName.replace('.ts', '.js')}`,
                namedExports: [hookName],
            });
        }
        composablesIndex.formatText();

        pluginFile.addStatements(`
${serviceImports.join('\n')}

${injectionKeys.join('\n')}

/**
 * Configuration options for the API Client Plugin.
 */
export interface ApiClientPluginOptions {
    /**
     * Optional configuration object to pass to the services.
     */
    config?: any; // Replace with actual config type if available
}

/**
 * Vue Plugin to provide API services.
 */
export const ApiClientPlugin = {
    install(app: App, options?: ApiClientPluginOptions) {
${provideStatements.map(stmt => `        ${stmt}`).join('\n')}
    }
};
        `);
        pluginFile.formatText();

        // Export plugin from main index
        const mainIndexFilePath = path.join(outputRoot, 'index.ts');
        const mainIndexFile = project.getSourceFile(mainIndexFilePath);
        if (mainIndexFile) {
            mainIndexFile.addExportDeclaration({
                moduleSpecifier: './plugin.js',
            });
            mainIndexFile.formatText();
        }
    }
}
