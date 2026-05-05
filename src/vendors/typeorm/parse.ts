import { Project, ClassDeclaration, PropertyDeclaration } from 'ts-morph';
import { SwaggerDefinition } from '../../core/types/openapi.js';
import { IOrmParser } from '../../core/orm/index.js';

/**
 * TypeORM parser implementation.
 * Parses classes decorated with `@Entity()` and converts their properties into OpenAPI schema definitions.
 */
export class TypeOrmParser implements IOrmParser {
    /**
     * Parses the given ts-morph project and returns extracted TypeORM entities as OpenAPI schemas.
     * @param project The active ts-morph project containing the TypeScript TypeORM entities.
     * @returns A dictionary of OpenAPI SwaggerDefinitions extracted from the code.
     */
    public parse(project: Project): Record<string, SwaggerDefinition | boolean> {
        const schemas: Record<string, SwaggerDefinition> = {};
        const sourceFiles = project.getSourceFiles();

        for (const sourceFile of sourceFiles) {
            const classes = sourceFile.getClasses();
            for (const cls of classes) {
                if (this.isEntityClass(cls)) {
                    const schemaName = cls.getName();
                    if (schemaName) {
                        schemas[schemaName] = this.parseEntity(cls);
                    }
                }
            }
        }

        return schemas;
    }

    /**
     * Checks if a class is decorated with `@Entity`.
     * @param cls The class declaration to check.
     * @returns True if the class is a TypeORM entity.
     */
    private isEntityClass(cls: ClassDeclaration): boolean {
        return cls.getDecorators().some(d => d.getName() === 'Entity');
    }

    /**
     * Parses a TypeORM entity class into a SwaggerDefinition.
     * @param cls The class declaration representing the entity.
     * @returns An OpenAPI SwaggerDefinition representing the entity.
     */
    private parseEntity(cls: ClassDeclaration): SwaggerDefinition {
        const schema: SwaggerDefinition = {
            type: 'object',
            properties: {},
            required: [],
        };

        const properties = cls.getProperties();
        for (const prop of properties) {
            if (this.isColumnProperty(prop)) {
                const propName = prop.getName();
                const propType = prop.getType().getText();

                const definition = this.mapTypeToDefinition(propType);
                schema.properties![propName] = definition;

                // If property is not optional (no `?`), it's required
                if (!prop.hasQuestionToken()) {
                    schema.required?.push(propName);
                }
            }
        }

        // Clean up empty required array
        if (schema.required && schema.required.length === 0) {
            delete schema.required;
        }

        return schema;
    }

    /**
     * Checks if a property is a TypeORM column (decorated with `@Column`, `@PrimaryGeneratedColumn`, etc.).
     * @param prop The property declaration to check.
     * @returns True if the property is a TypeORM column.
     */
    private isColumnProperty(prop: PropertyDeclaration): boolean {
        const decoratorNames = [
            'Column',
            'PrimaryGeneratedColumn',
            'PrimaryColumn',
            'CreateDateColumn',
            'UpdateDateColumn',
            'DeleteDateColumn',
            'VersionColumn',
        ];
        return prop.getDecorators().some(d => decoratorNames.includes(d.getName()));
    }

    /**
     * Maps a TypeScript type string to an OpenAPI schema definition.
     * @param tsType The TypeScript type string.
     * @returns An OpenAPI SwaggerDefinition representing the type.
     */
    private mapTypeToDefinition(tsType: string): SwaggerDefinition {
        // Basic mapping
        const typeStr = tsType.toLowerCase();
        if (typeStr.includes('string')) {
            return { type: 'string' };
        } else if (typeStr.includes('number')) {
            return { type: 'number' };
        } else if (typeStr.includes('boolean')) {
            return { type: 'boolean' };
        } else if (typeStr.includes('date')) {
            return { type: 'string', format: 'date-time' };
        }
        return { type: 'object' }; // Fallback
    }
}
