import { Project } from 'ts-morph';
import * as path from 'node:path';
import { SwaggerParser } from '@src/openapi/parse.js';
import { GeneratorConfig, PathInfo } from '@src/core/types/index.js';
import { AbstractClientGenerator } from '../../core/generator.js';
import { FetchClientGenerator } from '../fetch/fetch-client.generator.js';
import { camelCase, pascalCase } from '@src/functions/utils.js';

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

        const hooksDir = path.join(outputRoot, 'hooks');
        const hooksIndex = project.createSourceFile(path.join(hooksDir, 'index.ts'), '', { overwrite: true });

        const operationsByController = groupPathsByCanonicalController(parser);

        for (const controllerName of Object.keys(operationsByController)) {
            const serviceName = `${pascalCase(controllerName)}Service`;
            const hookName = `use${serviceName}`;
            const fileName = `${camelCase(controllerName)}.hook.ts`;
            const filePath = path.join(hooksDir, fileName);

            const hookFile = project.createSourceFile(filePath, '', { overwrite: true });

            hookFile.addImportDeclarations([
                {
                    moduleSpecifier: 'react',
                    namedImports: ['useMemo'],
                },
                {
                    moduleSpecifier: `../services/${camelCase(controllerName)}.service.js`,
                    namedImports: [serviceName],
                },
            ]);

            hookFile.addFunction({
                name: hookName,
                isExported: true,
                statements: `return useMemo(() => new ${serviceName}(), []);`,
            });
            hookFile.formatText();

            hooksIndex.addExportDeclaration({
                moduleSpecifier: `./${fileName.replace('.ts', '.js')}`,
                namedExports: [hookName],
            });
        }
        hooksIndex.formatText();
    }
}
