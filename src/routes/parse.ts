import { SourceFile } from 'ts-morph';
import type { PathItem } from '../core/types/index.js';

/**
 * Parses the \`paths.ts\` file to extract path-level metadata that was previously emitted.
 * This supports the bidirectionality feature of CDD.
 *
 * @param sourceFile - The ts-morph SourceFile representing \`paths.ts\`.
 * @returns A record of path keys to PathItem metadata, or undefined if the \`API_PATHS\` variable is not found or cannot be parsed.
 */
export function parsePathsMetadata(sourceFile: SourceFile): Record<string, PathItem> | undefined {
    if (!sourceFile) {
        return undefined;
    }

    const apiPathsVar = sourceFile.getVariableDeclaration('API_PATHS');
    if (!apiPathsVar) {
        return undefined;
    }

    const initializer = apiPathsVar.getInitializer();
    if (!initializer) {
        return undefined;
    }

    try {
        const text = initializer.getText();

        // In emit.ts, it's generated as JSON.stringify(registry, null, 2) which outputs a raw object literal in TS
        // E.g. const API_PATHS = { "/pet": { ... } };
        // We evaluate it securely using Function constructor since we are dealing with our own generated AST node
        // and we only extract data.
        const parsed = new Function(`return ${text}`)();

        if (typeof parsed === 'object' && parsed !== null) {
            return parsed as Record<string, PathItem>;
        }
        return undefined;
    } catch (e) {
        return undefined;
    }
}
