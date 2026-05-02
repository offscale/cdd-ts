import { describe, it, expect } from 'vitest';
import { emitJSDoc } from '../../src/docstrings/emit.js';

describe('emitJSDoc', () => {
    it('should return an empty string when no options are provided', () => {
        expect(emitJSDoc({})).toBe('');
    });

    it('should emit a single-line description', () => {
        const result = emitJSDoc({ description: 'Hello world', singleLine: true });
        expect(result).toBe('/** Hello world */');
    });

    it('should emit a multi-line description if singleLine is false', () => {
        const result = emitJSDoc({ description: 'Hello world' });
        expect(result).toBe('/**\n * Hello world\n */');
    });

    it('should emit a description with multiple lines', () => {
        const result = emitJSDoc({ description: 'Hello\nworld' });
        expect(result).toBe('/**\n * Hello\n * world\n */');
    });

    it('should emit tags without description', () => {
        const result = emitJSDoc({
            tags: [
                { tagName: 'param', text: 'id The identifier' },
                { tagName: 'returns', text: 'A user object' },
            ],
        });
        expect(result).toBe('/**\n * @param id The identifier\n * @returns A user object\n */');
    });

    it('should emit both description and tags separated by a blank line', () => {
        const result = emitJSDoc({
            description: 'Retrieves a user.',
            tags: [{ tagName: 'param', text: 'id The user ID' }],
        });
        expect(result).toBe('/**\n * Retrieves a user.\n *\n * @param id The user ID\n */');
    });

    it('should sanitize descriptions and tags', () => {
        const result = emitJSDoc({
            description: 'Hello <script>alert("hack")</script>',
            tags: [{ tagName: 'param', text: 'val */ inject' }],
        });
        expect(result).toBe('/**\n * Hello\n *\n * @param val *\\/ inject\n */');
    });

    it('should omit description entirely if sanitizeComment makes it empty', () => {
        const result = emitJSDoc({
            description: '<script>alert("hack")</script>',
            tags: [{ tagName: 'param', text: 'val' }],
        });
        expect(result).toBe('/**\n * @param val\n */');
    });

    it('should handle tags with no text', () => {
        const result = emitJSDoc({
            tags: [{ tagName: 'deprecated' }],
        });
        expect(result).toBe('/**\n * @deprecated\n */');
    });
});
