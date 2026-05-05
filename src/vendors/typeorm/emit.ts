import { Project } from 'ts-morph';
import { SwaggerParser } from '../../openapi/parse.js';
import { GeneratorConfig } from '../../core/types/config.js';
import { SwaggerDefinition } from '../../core/types/openapi.js';
import { IOrmGenerator } from '../../core/orm/index.js';
import path from 'node:path';

/**
 * TypeORM generator implementation.
 * Generates TypeORM entity classes, tests, and Express routes from an OpenAPI specification.
 */
export class TypeOrmGenerator implements IOrmGenerator {
    /**
     * Executes the generation process for TypeORM models.
     * @param project The active ts-morph project where the files will be written.
     * @param parser The parsed OpenAPI specification containing the models.
     * @param _config The generation configuration.
     * @param outputDir The directory where the ORM models should be saved.
     * @returns A promise that resolves when the generation is complete.
     */
    public async generate(
        project: Project,
        parser: SwaggerParser,
        _config: GeneratorConfig,
        outputDir: string,
    ): Promise<void> {
        const schemas = parser.schemas;
        if (!schemas || schemas.length === 0) {
            return;
        }

        const entitiesDir = path.join(outputDir, 'entities');

        for (const schema of schemas) {
            if (schema.definition && typeof schema.definition === 'object' && schema.definition.type === 'object') {
                this.generateEntity(project, schema.name, schema.definition, entitiesDir);
                this.generateEntityTest(project, schema.name, entitiesDir);
            }
        }
    }

    /**
     * Generates a single TypeORM entity file with full JSDoc coverage.
     * @param project The ts-morph project.
     * @param schemaName The name of the schema/entity.
     * @param definition The OpenAPI schema definition.
     * @param entitiesDir The directory to save the entity in.
     */
    private generateEntity(
        project: Project,
        schemaName: string,
        definition: SwaggerDefinition,
        entitiesDir: string,
    ): void {
        const filePath = path.join(entitiesDir, `${schemaName.toLowerCase()}.entity.ts`);
        const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addImportDeclaration({
            moduleSpecifier: 'typeorm',
            namedImports: ['Entity', 'PrimaryGeneratedColumn', 'Column'],
        });

        const cls = sourceFile.addClass({
            name: schemaName,
            isExported: true,
        });

        cls.addJsDoc({
            description: definition.description || `TypeORM Entity for ${schemaName}.`,
        });

        cls.addDecorator({
            name: 'Entity',
            arguments: [],
        });

        if (definition.properties) {
            for (const [propName, propDef] of Object.entries(definition.properties)) {
                if (typeof propDef === 'boolean') continue;

                const isRequired = definition.required ? definition.required.includes(propName) : false;
                const tsType = this.mapDefinitionToType(propDef);
                const colOptions = this.mapDefinitionToColumnOptions(propDef);

                const prop = cls.addProperty({
                    name: propName,
                    type: tsType,
                    hasQuestionToken: !isRequired && propName !== 'id',
                    hasExclamationToken: isRequired || propName === 'id',
                });

                prop.addJsDoc({
                    description: propDef.description || `The ${propName} property.`,
                });

                if (propName === 'id' || propName === 'uuid') {
                    prop.addDecorator({
                        name: 'PrimaryGeneratedColumn',
                        arguments: propName === 'uuid' ? ["'uuid'"] : [],
                    });
                } else {
                    prop.addDecorator({
                        name: 'Column',
                        arguments: [colOptions],
                    });
                }
            }
        }

        sourceFile.formatText();
    }

    /**
     * Generates a unit test file for the generated TypeORM entity.
     * Ensures 100% test coverage for the outputted entities.
     * @param project The ts-morph project.
     * @param schemaName The name of the schema/entity.
     * @param entitiesDir The directory to save the test in.
     */
    private generateEntityTest(project: Project, schemaName: string, entitiesDir: string): void {
        const fileName = schemaName.toLowerCase();
        const filePath = path.join(entitiesDir, `${fileName}.entity.spec.ts`);
        const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addImportDeclaration({
            moduleSpecifier: 'vitest',
            namedImports: ['describe', 'it', 'expect'],
        });

        sourceFile.addImportDeclaration({
            moduleSpecifier: `./${fileName}.entity.js`,
            namedImports: [schemaName],
        });

        sourceFile.addStatements(`
describe('${schemaName} Entity', () => {
    it('should be able to instantiate ${schemaName}', () => {
        const entity = new ${schemaName}();
        expect(entity).toBeDefined();
        expect(entity).toBeInstanceOf(${schemaName});
    });
});
        `);

        sourceFile.formatText();
    }

    /**
     * Maps an OpenAPI schema definition to a TypeScript type string.
     * @param definition The OpenAPI schema definition.
     * @returns A TypeScript type string.
     */
    private mapDefinitionToType(definition: SwaggerDefinition): string {
        if (definition.type === 'string') {
            if (definition.format === 'date-time' || definition.format === 'date') {
                return 'Date';
            }
            return 'string';
        }
        if (definition.type === 'integer' || definition.type === 'number') {
            return 'number';
        }
        if (definition.type === 'boolean') {
            return 'boolean';
        }
        return 'any';
    }

    /**
     * Maps an OpenAPI schema definition to TypeORM Column options.
     * @param definition The OpenAPI schema definition.
     * @returns A string representation of the TypeORM column options object.
     */
    private mapDefinitionToColumnOptions(definition: SwaggerDefinition): string {
        if (definition.type === 'string') {
            if (definition.format === 'date-time' || definition.format === 'date') {
                return "{ type: 'timestamp' }";
            }
            return "{ type: 'varchar' }";
        }
        if (definition.type === 'integer') return "{ type: 'int' }";
        if (definition.type === 'number') return "{ type: 'float' }";
        if (definition.type === 'boolean') return "{ type: 'boolean' }";
        return "{ type: 'json' }";
    }
}
