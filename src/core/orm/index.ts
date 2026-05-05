import { Project } from 'ts-morph';
import { SwaggerDefinition } from '../types/openapi.js';
import { SwaggerParser } from '../../openapi/parse.js';
import { GeneratorConfig } from '../types/config.js';

/**
 * Interface representing an ORM Parser.
 * It is responsible for parsing ORM-specific decorators and syntax from a given project
 * into generic OpenAPI schema definitions.
 */
export interface IOrmParser {
    /**
     * Parses the given ts-morph project and returns extracted schemas.
     * @param project The active ts-morph project containing the TypeScript models/entities.
     * @returns A dictionary of OpenAPI SwaggerDefinitions extracted from the code.
     */
    parse(project: Project): Record<string, SwaggerDefinition | boolean>;
}

/**
 * Interface representing an ORM Generator (Emitter).
 * It is responsible for generating ORM-specific entity classes from an OpenAPI specification.
 */
export interface IOrmGenerator {
    /**
     * Executes the generation process for ORM models.
     * @param project The active ts-morph project where the files will be written.
     * @param parser The parsed OpenAPI specification containing the models.
     * @param config The generation configuration.
     * @param outputDir The directory where the ORM models should be saved.
     * @returns A promise that resolves when the generation is complete.
     */
    generate(project: Project, parser: SwaggerParser, config: GeneratorConfig, outputDir: string): Promise<void>;
}
