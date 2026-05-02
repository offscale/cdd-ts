import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { parseTests } from '../../src/tests/parse.js';

describe('parseTests', () => {
    it('should return an empty array if sourceFile is missing', () => {
        expect(parseTests(null as any)).toEqual([]);
    });

    it('should return an empty array if no tests are present', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('test.ts', 'const a = 1;');
        expect(parseTests(sourceFile)).toEqual([]);
    });

    it('should parse a single describe block with it block', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile(
            'test.ts',
            "describe('My Component', () => { " +
                "    it('should do something', () => { " +
                '        expect(true).toBe(true); ' +
                '    }); ' +
                '});',
        );
        const result = parseTests(sourceFile);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            description: 'My Component',
            type: 'describe',
            children: [
                {
                    description: 'should do something',
                    type: 'it',
                },
            ],
        });
    });

    it('should parse isolated it and test blocks', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile(
            'test.ts',
            "test('test 1', () => {}); " + "it('test 2', () => {});",
        );
        const result = parseTests(sourceFile);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ description: 'test 1', type: 'test' });
        expect(result[1]).toEqual({ description: 'test 2', type: 'it' });
    });

    it('should handle non-literal descriptions gracefully', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile(
            'test.ts',
            "const name = 'test'; " + 'describe(name, () => { ' + '    it(`should ${name}`, () => {}); ' + '});',
        );
        const result = parseTests(sourceFile);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('name');
        expect(result[0].children?.[0].description).toBe('`should ${name}`');
    });

    it('should ignore describe without enough arguments', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile('test.ts', "describe('only description');");
        const result = parseTests(sourceFile);
        expect(result).toEqual([]);
    });

    it('should handle describe without arrow function or function expression', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile(
            'test.ts',
            'const myFn = () => {}; ' + "describe('My Component', myFn);",
        );
        const result = parseTests(sourceFile);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            description: 'My Component',
            type: 'describe',
        });
    });

    it('should handle nested describe and hit processedNodes check', () => {
        const project = new Project();
        const sourceFile = project.createSourceFile(
            'test.ts',
            "describe('outer', function() { " +
                "    describe('inner', function() { " +
                "        it('works', () => { expect(1).toBe(1); }); " +
                '    }); ' +
                "    it('works outer', () => {}); " +
                '});',
        );
        const result = parseTests(sourceFile);
        expect(result).toHaveLength(1);
        expect(result[0].children).toHaveLength(2);
        expect(result[0].children![0].description).toBe('inner');
        expect(result[0].children![1].description).toBe('works outer');
    });
});
