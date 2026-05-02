import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { parsePathsMetadata } from '../../src/routes/parse.js';

describe('parsePathsMetadata', () => {
    it('should return undefined if sourceFile is missing', () => {
        expect(parsePathsMetadata(null as any)).toBeUndefined();
    });

    it('should return undefined if API_PATHS is not present', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('paths.ts', 'export const OTHER_VAR = {};');

        expect(parsePathsMetadata(sourceFile)).toBeUndefined();
    });

    it('should return undefined if API_PATHS has no initializer', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('paths.ts', 'export declare const API_PATHS: any;');

        expect(parsePathsMetadata(sourceFile)).toBeUndefined();
    });

    it('should return undefined if API_PATHS cannot be parsed', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('paths.ts', 'export const API_PATHS = someFunctionCall();');

        expect(parsePathsMetadata(sourceFile)).toBeUndefined();
    });

    it('should return undefined if parsed API_PATHS evaluates to string or null', () => {
        const project = new Project();
        const sourceFile1 = project.createSourceFile('paths1.ts', 'export const API_PATHS = "hello";');
        expect(parsePathsMetadata(sourceFile1)).toBeUndefined();

        const sourceFile2 = project.createSourceFile('paths2.ts', 'export const API_PATHS = null;');
        expect(parsePathsMetadata(sourceFile2)).toBeUndefined();
    });

    it('should correctly parse API_PATHS metadata', () => {
        const project = new Project();
        const metadata = {
            '/pet': {
                summary: 'Pet operations',
                description: 'Operations related to pets',
            },
        };
        const sourceFile = project.createSourceFile(
            'paths.ts',
            `export const API_PATHS = ${JSON.stringify(metadata, null, 2)};`,
        );

        const result = parsePathsMetadata(sourceFile);
        expect(result).toEqual(metadata);
    });
});
