import { SwaggerParser } from '../openapi/parse.js';
import { GeneratorConfig } from '../core/types/index.js';
import { pascalCase, camelCase } from './utils.js';
import { PathInfo } from '../core/types/analysis.js';

/** Options for generating docs. */
export interface DocsOptions {
    /** Whether to include import statements. */
    imports?: boolean;
    /** Whether to wrap in a function. */
    wrapping?: boolean;
}

/** Represents a single documented operation. */
export interface DocOperation {
    /** HTTP Method */
    method: string;
    /** URL Path */
    path: string;
    /** Operation ID */
    operationId?: string;
    /** Code snippets */
    code: {
        /** Import statements */
        imports?: string;
        /** Wrapper start code */
        wrapper_start?: string;
        /** Main code snippet */
        snippet: string;
        /** Wrapper end code */
        wrapper_end?: string;
    };
}

/** Represents a language and its operations. */
export interface DocLanguage {
    /** Target language name */
    language: string;
    /** Operations for this language */
    operations: DocOperation[];
}

/**
 * Converts a string to a valid TS identifier.
 * @param name The original name.
 * @returns The camelCase valid identifier.
 */
function toTsIdentifier(name: string): string {
    return camelCase(name.replace(/[^\w]/g, ' '));
}

/**
 * Gets the canonical controller name for an operation.
 * @param op The path info operation.
 * @returns The controller name.
 */
function getControllerCanonicalName(op: PathInfo): string {
    if (Array.isArray(op.tags) && op.tags[0]) {
        return pascalCase(op.tags[0].toString());
    }

    const firstSegment = op.path.split('/').filter(Boolean)[0];

    return firstSegment ? pascalCase(firstSegment) : 'Default';
}

/**
 * Determines the method name for a given operation.
 * @param op The parsed path info operation.
 * @param config The generator configuration.
 * @returns The suggested TS method name.
 */
function getMethodName(op: PathInfo, config: GeneratorConfig): string {
    let suggestedName = op.methodName;

    if (config.options?.customizeMethodName && op.operationId) {
        suggestedName = config.options.customizeMethodName(op.operationId);
    }

    if (!suggestedName) {
        if (op.operationId) {
            suggestedName = toTsIdentifier(op.operationId);
        } else {
            suggestedName = toTsIdentifier(op.method.toLowerCase() + '_' + op.path);
        }
    } else if (suggestedName.includes('-') || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(suggestedName)) {
        suggestedName = toTsIdentifier(suggestedName);
    }

    return suggestedName;
}

/**
 * Generates API documentation usage snippets in JSON format.
 * @param parser The parsed openapi specification.
 * @param config The current generator configuration.
 * @param options Options for code snippet format.
 * @returns An array of DocLanguage objects.
 */

export function generateDocsJson(
    parser: SwaggerParser,
    config: GeneratorConfig,
    options: DocsOptions,
): { endpoints: Record<string, Record<string, string>> } {
    const useImports = options.imports ?? false;
    const useWrapping = options.wrapping ?? false;

    const endpoints: Record<string, Record<string, string>> = {};
    const usedNames = new Set<string>();

    for (const op of parser.operations) {
        const controller = getControllerCanonicalName(op);
        const serviceName = `${controller}Service`;

        let suggestedName = getMethodName(op, config);
        let finalName = suggestedName;
        let counter = 2;
        while (usedNames.has(`${controller}_${finalName}`)) {
            finalName = `${suggestedName}${counter++}`;
        }
        usedNames.add(`${controller}_${finalName}`);
        const methodName = finalName;

        let args = '';
        if ((op.parameters && op.parameters.length > 0) || op.requestBody) {
            args = '{ /* arguments */ }';
        }

        const method = op.method.toLowerCase();
        const path = op.path;

        if (!endpoints[path]) {
            endpoints[path] = {};
        }

        let finalCode = '';

        if (useImports) {
            if (config.options.framework === 'react') {
                finalCode += `import { use${serviceName} } from './api/services/${controller.toLowerCase()}.service';\n\n`;
            } else if (config.options.framework === 'vue') {
                finalCode += `import { use${serviceName} } from './api/services/${controller.toLowerCase()}.service';\n\n`;
            } else {
                finalCode += `import { Component, inject } from '@angular/core';\nimport { ${serviceName} } from './api/services/${controller.toLowerCase()}.service';\n\n`;
            }
        }

        if (useWrapping) {
            if (config.options.framework === 'react') {
                finalCode += `export function ExampleComponent() {\n    const service = use${serviceName}();\n\n    async function execute() {\n`;
            } else if (config.options.framework === 'vue') {
                finalCode += `<script setup>\nimport { onMounted } from 'vue';\n\nconst service = use${serviceName}();\n\nasync function execute() {\n`;
            } else {
                finalCode += `@Component({\n    selector: 'app-example',\n    template: ''\n})\nexport class ExampleComponent {\n    private service = inject(${serviceName});\n\n    async execute() {\n`;
            }
        }

        let innerCode = `const response = await this.service.${methodName}(${args});\nconsole.log(response);`;
        if (config.options.framework === 'react' || config.options.framework === 'vue') {
            innerCode = `const response = await service.${methodName}(${args});\nconsole.log(response);`;
        }
        if (useWrapping) {
            innerCode = innerCode
                .split('\n')
                .map(l => `        ${l}`)
                .join('\n');
        }

        finalCode += innerCode;

        if (useWrapping) {
            if (config.options.framework === 'vue') {
                finalCode += `\n}\n</script>`;
            } else {
                finalCode += `\n    }\n}`;
            }
        }

        endpoints[path][method] = finalCode;
    }

    return { endpoints };
}
