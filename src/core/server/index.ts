import { Project } from 'ts-morph';
import { GeneratorConfig } from '../types/config.js';

/**
 * Interface representing a Server Framework Generator.
 * Responsible for generating server-side routing logic and associated tests.
 */
export interface IServerFrameworkGenerator {
    /**
     * Generates the routing logic, route tests, and E2E tests for a specific entity/model.
     * @param project The active ts-morph project where the files will be written.
     * @param schemaName The name of the schema/entity.
     * @param outputDir The directory where the server code should be saved.
     * @param orm The ORM being used, if any.
     * @param config The generator configuration options.
     */
    generateEntityRoutes(
        project: Project,
        schemaName: string,
        outputDir: string,
        orm?: string,
        config?: GeneratorConfig,
    ): void;
}
