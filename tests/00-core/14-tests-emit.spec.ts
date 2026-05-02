import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { emitTestBlocks } from '../../src/tests/emit.js';

describe('emitTestBlocks', () => {
    it('should handle missing sourceFile', () => {
        // Should not throw
        expect(() => emitTestBlocks(null as any, { suiteName: 'test', cases: [] })).not.toThrow();
    });

    it('should generate a describe block with no test cases into an empty file', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('test.ts', '');

        emitTestBlocks(sourceFile, { suiteName: 'My Suite', cases: [] });

        expect(sourceFile.getText().trim()).toBe("describe('My Suite', () => {\\n});");
    });

    it('should generate a describe block with cases into an empty file', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('test.ts', '');

        emitTestBlocks(sourceFile, {
            suiteName: 'AuthService',
            cases: [
                { description: 'should login', body: 'expect(true).toBe(true);' },
                { description: 'should logout', body: 'const a = 1;\\nexpect(a).toBe(1);' },
            ],
        });

        const expected = [
            "describe('AuthService', () => {",
            "    it('should login', () => {",
            '        expect(true).toBe(true);',
            '    });',
            "    it('should logout', () => {",
            '        const a = 1;',
            '        expect(a).toBe(1);',
            '    });',
            '});',
        ].join('\\n');

        expect(sourceFile.getText().trim()).toBe(expected);
    });

    it('should append describe block to a file with existing content', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('test.ts', 'import { describe, it } from "vitest";\\n');

        emitTestBlocks(sourceFile, {
            suiteName: 'Utils',
            cases: [{ description: 'works', body: 'expect(1).toBe(1);' }],
        });

        const expectedText = sourceFile.getText();
        expect(expectedText).toContain('import { describe, it } from "vitest";');
        expect(expectedText).toContain("describe('Utils', () => {");
        expect(expectedText).toContain("it('works', () => {");
    });
});
