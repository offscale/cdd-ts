import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { TypeOrmParser } from '../../src/vendors/typeorm/parse.js';

describe('TypeOrmParser', () => {
    it('should parse an entity class correctly', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        project.createSourceFile(
            'user.entity.ts',
            `
            import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

            @Entity()
            export class User {
                @PrimaryGeneratedColumn()
                id!: number;

                @Column()
                firstName: string;

                @Column()
                lastName?: string;

                @Column()
                isActive: boolean;

                @Column()
                createdAt: Date;
            }
        `,
        );

        const parser = new TypeOrmParser();
        const schemas = parser.parse(project);

        expect(schemas['User']).toBeDefined();
        const userSchema = schemas['User'] as any;

        expect(userSchema.type).toBe('object');
        expect(userSchema.required).toEqual(['id', 'firstName', 'isActive', 'createdAt']);
        expect(userSchema.properties['id'].type).toBe('number');
        expect(userSchema.properties['firstName'].type).toBe('string');
        expect(userSchema.properties['lastName'].type).toBe('string');
        expect(userSchema.properties['isActive'].type).toBe('boolean');
        expect(userSchema.properties['createdAt'].type).toBe('string');
        expect(userSchema.properties['createdAt'].format).toBe('date-time');
    });

    it('should fall back to object type if type is unknown', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        project.createSourceFile(
            'some.entity.ts',
            `
            import { Entity, Column } from 'typeorm';

            @Entity()
            export class SomeEntity {
                @Column()
                data: UnknownType;
            }
        `,
        );

        const parser = new TypeOrmParser();
        const schemas = parser.parse(project);
        const schema = schemas['SomeEntity'] as any;

        expect(schema.properties['data'].type).toBe('object');
    });

    it('should ignore non-entity classes and non-column properties', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        project.createSourceFile(
            'mixed.ts',
            `
            import { Entity, Column } from 'typeorm';

            export class NotAnEntity {
                prop: string;
            }

            @Entity()
            export class MyEntity {
                @Column()
                id: number;

                notAColumn: string;
            }
        `,
        );

        const parser = new TypeOrmParser();
        const schemas = parser.parse(project);

        expect(schemas['NotAnEntity']).toBeUndefined();

        const myEntity = schemas['MyEntity'] as any;
        expect(myEntity.properties['id']).toBeDefined();
        expect(myEntity.properties['notAColumn']).toBeUndefined();
    });

    it('should clean up required array if empty', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        project.createSourceFile(
            'empty.ts',
            `
            import { Entity, Column } from 'typeorm';

            @Entity()
            export class EmptyEntity {
                @Column()
                optionalProp?: string;
            }
        `,
        );

        const parser = new TypeOrmParser();
        const schemas = parser.parse(project);

        const schema = schemas['EmptyEntity'] as any;
        expect(schema.required).toBeUndefined();
    });

    it('should ignore anonymous entity classes', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        project.createSourceFile(
            'anonymous.ts',
            `
            import { Entity } from 'typeorm';
            export default @Entity() class { }
            `,
        );

        const parser = new TypeOrmParser();
        const schemas = parser.parse(project);
        expect(Object.keys(schemas).length).toBe(0);
    });
});
