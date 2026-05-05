import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { TypeOrmGenerator } from '../../src/vendors/typeorm/emit.js';
import { SwaggerParser } from '../../src/openapi/parse.js';

describe('TypeOrmGenerator', () => {
    it('should generate an entity file correctly with explicit types and JSDoc', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new TypeOrmGenerator();

        const mockParser = {
            schemas: [
                {
                    name: 'User',
                    definition: {
                        type: 'object',
                        description: 'A mock user entity',
                        required: ['id', 'email', 'isActive'],
                        properties: {
                            id: { type: 'integer', description: 'Primary Key' },
                            uuid: { type: 'string', format: 'uuid' },
                            email: { type: 'string' },
                            createdAt: { type: 'string', format: 'date-time' },
                            isActive: { type: 'boolean' },
                            metadata: { type: 'object' },
                            skippedProp: true, // Testing the boolean fallback exclusion
                            price: { type: 'number' },
                            publishDate: { type: 'string', format: 'date' },
                        },
                    },
                },
            ],
        } as unknown as SwaggerParser;

        await generator.generate(project, mockParser, { options: {} } as any, '/out');

        const file = project.getSourceFileOrThrow('/out/entities/user.entity.ts');
        const text = file.getFullText();

        expect(text).toContain('import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";');
        expect(text).toContain('/** A mock user entity */');
        expect(text).toContain('@Entity()');
        expect(text).toContain('export class User {');

        expect(text).toContain('/** Primary Key */');
        expect(text).toContain('@PrimaryGeneratedColumn()');
        expect(text).toContain('id!: number;');

        expect(text).toContain("@PrimaryGeneratedColumn('uuid')");
        expect(text).toContain('uuid?: string;');

        expect(text).toContain("@Column({ type: 'varchar' })");
        expect(text).toContain('email!: string;');

        expect(text).toContain("@Column({ type: 'timestamp' })");
        expect(text).toContain('createdAt?: Date;');

        expect(text).toContain("@Column({ type: 'boolean' })");
        expect(text).toContain('isActive!: boolean;');

        expect(text).toContain("@Column({ type: 'json' })");
        expect(text).toContain('metadata?: any;');

        expect(text).toContain("@Column({ type: 'float' })");
        expect(text).toContain('price?: number;');

        expect(text).toContain("@Column({ type: 'timestamp' })");
        expect(text).toContain('publishDate?: Date;');

        expect(text).not.toContain('skippedProp');

        // Check test file generation
        const testFile = project.getSourceFileOrThrow('/out/entities/user.entity.spec.ts');
        const testText = testFile.getFullText();
        expect(testText).toContain("describe('User Entity', () => {");
        expect(testText).toContain('const entity = new User();');
    });

    it('should handle empty schemas safely', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new TypeOrmGenerator();

        const mockParser = { schemas: undefined } as unknown as SwaggerParser;
        await generator.generate(project, mockParser, { options: {} } as any, '/out');
        expect(project.getSourceFiles().length).toBe(0);

        const mockParser2 = { schemas: [] } as unknown as SwaggerParser;
        await generator.generate(project, mockParser2, { options: {} } as any, '/out');
        expect(project.getSourceFiles().length).toBe(0);
    });

    it('should skip non-object schemas', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new TypeOrmGenerator();

        const mockParser = {
            schemas: [
                {
                    name: 'StringAlias',
                    definition: { type: 'string' },
                },
            ],
        } as unknown as SwaggerParser;

        await generator.generate(project, mockParser, { options: {} } as any, '/out');
        // It shouldn't create entities directory or files for non-object schemas
        expect(project.getSourceFiles().length).toBe(0);
    });

    it('should handle schemas without properties safely', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new TypeOrmGenerator();

        const mockParser = {
            schemas: [
                {
                    name: 'NoProps',
                    definition: { type: 'object' }, // no properties
                },
            ],
        } as unknown as SwaggerParser;

        await generator.generate(project, mockParser, { options: {} } as any, '/out');
        const file = project.getSourceFileOrThrow('/out/entities/noprops.entity.ts');
        const text = file.getFullText();
        expect(text).toContain('export class NoProps {');
    });

    it('should handle optional id and missing required array', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new TypeOrmGenerator();

        const mockParser = {
            schemas: [
                {
                    name: 'OptionalId',
                    definition: {
                        type: 'object',
                        // missing 'required' array
                        properties: {
                            id: { type: 'integer' }, // id is optional
                            name: { type: 'string' },
                        },
                    },
                },
            ],
        } as unknown as SwaggerParser;

        await generator.generate(project, mockParser, { options: {} } as any, '/out');
        const file = project.getSourceFileOrThrow('/out/entities/optionalid.entity.ts');
        const text = file.getFullText();

        expect(text).toContain('id!: number;'); // id still gets exclamation mark due to hasExclamationToken: isRequired || propName === 'id'
        expect(text).toContain('name?: string;');
    });
});
