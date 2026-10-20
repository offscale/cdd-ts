/**
 * Generates Express.js routers, MCP SSE endpoints, server entrypoints, and route unit/E2E tests using ts-morph AST builders.
 *
 * @module vendors/express/express-server.generator
 */
import type { Project } from "ts-morph";
import type { IServerFrameworkGenerator } from "../../core/server/index.js";
import type { GeneratorConfig } from "../../core/types/config.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { generateExpressServerEntrypoint } from "./express-entrypoint.generator.js";
import { generateExpressMcpRoutes } from "./express-mcp.generator.js";
import { generateExpressEntityMock } from "./express-mocks.generator.js";
import { generateExpressEntityRoute } from "./express-routes.generator.js";
import {
	generateExpressE2ETest,
	generateExpressRouteTest,
} from "./express-tests.generator.js";

/**
 * Express framework generator implementation.
 * Generates Express.js routers, MCP SSE endpoints, server entrypoints, and tests.
 */
export class ExpressServerGenerator implements IServerFrameworkGenerator {
	/**
	 * Generates Express routes for Model Context Protocol (MCP) SSE and message handling.
	 *
	 * @param project - The `ts-morph` project.
	 * @param parser - The parsed OpenAPI specification.
	 * @param outputDir - Target directory for `mcp.routes.ts`.
	 * @param config - Optional generator configuration.
	 */
	public generateMcpRoutes(
		project: Project,
		parser: {
			spec?: SwaggerParser["spec"] | undefined;
			operations: SwaggerParser["operations"];
		},
		outputDir: string,
		config?: GeneratorConfig,
	): void {
		generateExpressMcpRoutes(project, parser, outputDir, config);
	}

	/**
	 * Generates the Express server entrypoint (`server.ts`) and its test suite (`server.spec.ts`).
	 *
	 * @param project - The `ts-morph` project.
	 * @param schemas - Entity schema names to wire into Express routes.
	 * @param outputDir - Target directory for `server.ts`.
	 * @param parser - Optional parsed OpenAPI specification for middleware generation.
	 */
	public generateServerEntrypoint(
		project: Project,
		schemas: string[],
		outputDir: string,
		parser?: Pick<SwaggerParser, "spec" | "schemas" | "operations">,
	): void {
		generateExpressServerEntrypoint(project, schemas, outputDir, parser);
	}

	/**
	 * Generates Express entity routes, mock data factories, and optional unit/E2E route test suites.
	 *
	 * @param project - The `ts-morph` project.
	 * @param schemaName - The name of the entity schema.
	 * @param outputDir - Target directory for route files.
	 * @param orm - Optional ORM identifier (`"typeorm"`).
	 * @param config - Optional generator configuration.
	 * @param parser - Optional parsed OpenAPI specification.
	 */
	public generateEntityRoutes(
		project: Project,
		schemaName: string,
		outputDir: string,
		orm?: string,
		config?: GeneratorConfig,
		parser?: Pick<SwaggerParser, "schemas">,
	): void {
		generateExpressEntityMock(project, schemaName, outputDir, parser);
		generateExpressEntityRoute(project, schemaName, outputDir, orm);

		const shouldGenerateTests = config?.options?.tests ?? false;
		if (shouldGenerateTests) {
			generateExpressRouteTest(project, schemaName, outputDir, orm);
			generateExpressE2ETest(project, schemaName, outputDir, orm);
		}
	}
}
