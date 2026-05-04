import { SourceFile } from 'ts-morph';
import type { ExampleObject } from '../core/types/index.js';

/**
 * Parses the \`examples.ts\` file to extract mock/example data that was previously emitted.
 * This supports the bidirectionality feature of CDD for examples.
 *
 * @param sourceFile - The ts-morph SourceFile representing \`examples.ts\`.
 * @returns A record of example names to ExampleObject metadata, or undefined if the \`API_EXAMPLES\` variable is not found.
 */
export function parseExamplesMetadata(sourceFile: SourceFile): Record<string, ExampleObject> | undefined {
    if (!sourceFile) {
        return undefined;
    }

    const apiExamplesVar = sourceFile.getVariableDeclaration('API_EXAMPLES');
    if (!apiExamplesVar) {
        return undefined;
    }

    const initializer = apiExamplesVar.getInitializer();
    if (!initializer) {
        return undefined;
    }

    try {
        const text = initializer.getText();

        // Similarly to API_PATHS, API_EXAMPLES is generated using JSON.stringify.
        // We use Function constructor for safe, localized evaluation of the literal.
        const parsed: unknown = new Function('return ' + text)();

        if (typeof parsed === 'object' && parsed !== null) {
            return parsed as Record<string, ExampleObject>;
        }
        return undefined;
    } catch (e) {
        return undefined;
    }
}
