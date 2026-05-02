import { describe, it, expect } from 'vitest';
import { parseJSDoc } from '../../src/docstrings/parse.js';

describe('parseJSDoc', () => {
    it('should return an empty object for empty or invalid input', () => {
        expect(parseJSDoc('')).toEqual({});
        expect(parseJSDoc(undefined as unknown as string)).toEqual({});
    });

    it('should parse a single-line description', () => {
        const result = parseJSDoc('/** Hello world */');
        expect(result).toEqual({ description: 'Hello world' });
    });

    it('should parse a multi-line description', () => {
        const result = parseJSDoc('/**\n * Hello\n * world\n */');
        expect(result).toEqual({ description: 'Hello\nworld' });
    });

    it('should parse tags without description', () => {
        const result = parseJSDoc('/**\n * @param id The identifier\n * @returns A user object\n */');
        expect(result).toEqual({
            tags: [
                { tagName: 'param', text: 'id The identifier' },
                { tagName: 'returns', text: 'A user object' },
            ],
        });
    });

    it('should parse both description and tags', () => {
        const result = parseJSDoc('/**\n * Retrieves a user.\n *\n * @param id The user ID\n */');
        expect(result).toEqual({
            description: 'Retrieves a user.',
            tags: [{ tagName: 'param', text: 'id The user ID' }],
        });
    });

    it('should parse tags with multiline text', () => {
        const result = parseJSDoc('/**\n * @example\n * const a = 1;\n * const b = 2;\n */');
        expect(result).toEqual({
            tags: [{ tagName: 'example', text: 'const a = 1;\nconst b = 2;' }],
        });
    });

    it('should handle tags with no text', () => {
        const result = parseJSDoc('/**\n * @deprecated\n */');
        expect(result).toEqual({
            tags: [{ tagName: 'deprecated' }],
        });
    });

    it('should handle consecutive tags where first tag has empty text array', () => {
        const result = parseJSDoc('/**\n * @tag1\n * @tag2 val\n */');
        expect(result).toEqual({
            tags: [{ tagName: 'tag1' }, { tagName: 'tag2', text: 'val' }],
        });
    });

    it('should handle typical JSDoc wrappers correctly', () => {
        const doc = `/**
                      * Main summary.
                      * 
                      * @param userId The ID
                      */`;
        const result = parseJSDoc(doc);
        expect(result).toEqual({
            description: 'Main summary.',
            tags: [{ tagName: 'param', text: 'userId The ID' }],
        });
    });
});
