import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import type { IOrmParser } from "../../src/core/orm/index.js";
import type { SwaggerDefinition } from "../../src/core/types/openapi.js";
import { TypeOrmParser } from "../../src/vendors/typeorm/parse.js";

describe("TypeOrmParser", () => {
	it("should parse an entity class correctly including arrays and custom entity reference types", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		project.createSourceFile(
			"user.entity.ts",
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

                @Column()
                tags: string[];

                @Column()
                scores: Array<number>;

                @Column()
                phone: PhoneNumber;

                @Column()
                nullableNote: string | null;

                @Column()
                untypedProp;
            }
        `,
		);

		const parser: IOrmParser = new TypeOrmParser();
		const schemas = parser.parse(project);

		expect(schemas.User).toBeDefined();
		const userSchema = schemas.User as SwaggerDefinition;

		expect(userSchema.type).toBe("object");
		expect(userSchema.required).toEqual([
			"id",
			"firstName",
			"isActive",
			"createdAt",
			"tags",
			"scores",
			"phone",
			"nullableNote",
			"untypedProp",
		]);
		expect(
			(userSchema.properties?.id as SwaggerDefinition | undefined)?.type,
		).toBe("number");
		expect(
			(userSchema.properties?.firstName as SwaggerDefinition | undefined)?.type,
		).toBe("string");
		expect(
			(userSchema.properties?.lastName as SwaggerDefinition | undefined)?.type,
		).toBe("string");
		expect(
			(userSchema.properties?.isActive as SwaggerDefinition | undefined)?.type,
		).toBe("boolean");
		expect(
			(userSchema.properties?.createdAt as SwaggerDefinition | undefined)?.type,
		).toBe("string");
		expect(
			(userSchema.properties?.createdAt as SwaggerDefinition | undefined)
				?.format,
		).toBe("date-time");
		expect(
			(userSchema.properties?.tags as SwaggerDefinition | undefined)?.type,
		).toBe("array");
		expect(
			(
				(userSchema.properties?.tags as SwaggerDefinition | undefined)?.items as
					| SwaggerDefinition
					| undefined
			)?.type,
		).toBe("string");
		expect(
			(userSchema.properties?.scores as SwaggerDefinition | undefined)?.type,
		).toBe("array");
		expect(
			(
				(userSchema.properties?.scores as SwaggerDefinition | undefined)
					?.items as SwaggerDefinition | undefined
			)?.type,
		).toBe("number");
		// PhoneNumber should NOT be misclassified as "number"
		expect(
			(userSchema.properties?.phone as SwaggerDefinition | undefined)?.type,
		).toBe("object");
		expect(
			(userSchema.properties?.untypedProp as SwaggerDefinition | undefined)
				?.type,
		).toBe("object");
	});

	it("should fall back to object type if type is unknown", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		project.createSourceFile(
			"some.entity.ts",
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
		const schema = schemas.SomeEntity as SwaggerDefinition;

		expect(
			(schema.properties?.data as SwaggerDefinition | undefined)?.type,
		).toBe("object");
	});

	it("should ignore non-entity classes and non-column properties", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		project.createSourceFile(
			"mixed.ts",
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

		expect(schemas.NotAnEntity).toBeUndefined();

		const myEntity = schemas.MyEntity as SwaggerDefinition;
		expect(myEntity.properties?.id).toBeDefined();
		expect(myEntity.properties?.notAColumn).toBeUndefined();
	});

	it("should clean up required array if empty", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		project.createSourceFile(
			"empty.ts",
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

		const schema = schemas.EmptyEntity as SwaggerDefinition;
		expect(schema.required).toBeUndefined();
	});

	it("should ignore anonymous entity classes", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		project.createSourceFile(
			"anonymous.ts",
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
