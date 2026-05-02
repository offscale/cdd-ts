import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { parseExamplesMetadata } from '../../src/mocks/parse.js';

describe('parseExamplesMetadata', () => {
    it('should return undefined if sourceFile is missing', () => {
        expect(parseExamplesMetadata(null as any)).toBeUndefined();
    });

    it('should return undefined if API_EXAMPLES is not present', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('examples.ts', 'export const OTHER_VAR = {};');

        expect(parseExamplesMetadata(sourceFile)).toBeUndefined();
    });

    it('should return undefined if API_EXAMPLES has no initializer', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('examples.ts', 'export declare const API_EXAMPLES: any;');

        expect(parseExamplesMetadata(sourceFile)).toBeUndefined();
    });

    it('should return undefined if API_EXAMPLES cannot be parsed', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('examples.ts', 'export const API_EXAMPLES = someFunctionCall();');

        expect(parseExamplesMetadata(sourceFile)).toBeUndefined();
    });

    it('should return undefined if parsed API_EXAMPLES evaluates to string or null', () => {
        const project = new Project();
        const sourceFile1 = project.createSourceFile('examples1.ts', 'export const API_EXAMPLES = "hello";');
        expect(parseExamplesMetadata(sourceFile1)).toBeUndefined();

        const sourceFile2 = project.createSourceFile('examples2.ts', 'export const API_EXAMPLES = null;');
        expect(parseExamplesMetadata(sourceFile2)).toBeUndefined();
    });

    it('should correctly parse API_EXAMPLES metadata', () => {
        const project = new Project();
        const metadata = {
            UserExample: {
                summary: 'A user example',
                value: { id: 1, name: 'John Doe' },
            },
        };
        const sourceFile = project.createSourceFile(
            'examples.ts',
            'export const API_EXAMPLES = ' + JSON.stringify(metadata, null, 2) + ';',
        );

        const result = parseExamplesMetadata(sourceFile);
        expect(result).toEqual(metadata);
    });
});
