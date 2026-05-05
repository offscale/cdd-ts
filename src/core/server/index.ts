import { Project } from 'ts-morph';

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
     */
    generateEntityRoutes(project: Project, schemaName: string, outputDir: string, orm?: string): void;
}
