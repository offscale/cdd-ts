/**
 * Generates the Express server entrypoint (`server.ts`) and its test suite (`server.spec.ts`).
 *
 * @module vendors/express/express-entrypoint.generator
 */
import path from "node:path";
import type { CodeBlockWriter, Project } from "ts-morph";
import type { SwaggerParser } from "../../openapi/parse.js";
import { generateAdvancedMiddlewares } from "./advanced-mock-middlewares.js";

/**
 * Generates the Express server entrypoint (`server.ts`) and its test suite (`server.spec.ts`).
 *
 * @param project - The `ts-morph` project.
 * @param schemas - Entity schema names to wire into Express routes.
 * @param outputDir - Target directory for `server.ts`.
 * @param parser - Optional parsed OpenAPI specification for middleware generation.
 */
export function generateExpressServerEntrypoint(
	project: Project,
	schemas: string[],
	outputDir: string,
	parser?: Pick<SwaggerParser, "spec" | "schemas" | "operations">,
): void {
	if (parser) {
		generateAdvancedMiddlewares(project, parser, outputDir);
	}
	const filePath = path.join(outputDir, "server.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		defaultImport: "express",
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "commander",
		namedImports: ["Command"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./dao/factory.js",
		namedImports: ["DaoFactory"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./db/connection.js",
		namedImports: ["createDatabaseConnection"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./seeder/index.js",
		namedImports: ["DatabaseSeeder"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./middlewares/cors.js",
		namedImports: ["corsMiddleware"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./middlewares/validation.js",
		namedImports: ["createValidationMiddleware"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./middlewares/auth.js",
		namedImports: ["createAuthMiddleware"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./webhooks.routes.js",
		namedImports: ["createWebhooksRouter"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./auth.routes.js",
		namedImports: ["createAuthRouter"],
	});

	for (const schema of schemas) {
		const fileName = schema.toLowerCase();
		sourceFile.addImportDeclaration({
			moduleSpecifier: `./routes/${fileName}.routes.js`,
			namedImports: [`create${schema}Router`],
		});
	}

	const authSchema =
		schemas.find((s) => s.toLowerCase() === "user") ?? schemas[0];

	sourceFile.addFunction({
		isExported: true,
		isAsync: true,
		name: "startServer",
		returnType: "Promise<express.Application>",
		docs: [
			{
				description:
					"Main server entrypoint. Handles CLI flags, database connection, fake data seeding, and router initialization.",
			},
		],
		parameters: [
			{
				name: "args",
				type: "string[]",
				initializer: "process.argv",
			},
		],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine("const program = new Command();");
			writer.blankLine();
			writer.writeLine("program");
			writer.indent(() => {
				writer.writeLine('.name("cdd-server")');
				writer.writeLine('.description("CDD Mock Server")');
				writer.writeLine(
					'.option("--ephemeral", "Triggers the Concrete DAOs and overrides DATABASE_URL with a throwaway database.")',
				);
				writer.writeLine(
					'.option("--seed", "Runs the fake data seeder on startup (requires a concrete DB connection).")',
				);
				writer.writeLine(
					'.option("--strict-validation", "Enables strict OpenAPI request validation.")',
				);
				writer.writeLine(
					'.option("--enforce-auth", "Enables strict authentication validation.")',
				);
				writer.writeLine(
					'.option("--start-auth-server", "Starts the integrated Identity Provider (IdP) authentication endpoints.");',
				);
			});
			writer.blankLine();
			writer.writeLine("program.parse(args);");
			writer.writeLine("const options = program.opts();");
			writer.blankLine();
			writer.writeLine("const app = express();");
			writer.writeLine("app.use(express.json());");
			writer.writeLine("app.use(corsMiddleware);");
			writer.blankLine();
			writer.writeLine("const isEphemeral = !!options.ephemeral;");
			writer.writeLine("const isSeed = !!options.seed;");
			writer.writeLine("const isStrict = !!options['strict-validation'];");
			writer.writeLine("const isAuth = !!options['enforce-auth'];");
			writer.writeLine(
				"const isStartAuthServer = !!options['start-auth-server'];",
			);
			writer.writeLine("const dbUrl = process.env.DATABASE_URL;");
			writer.blankLine();
			writer.writeLine("app.use(createValidationMiddleware(isStrict));");
			writer.writeLine("app.use(createAuthMiddleware(isAuth, isEphemeral));");
			writer.blankLine();
			writer.writeLine("const dataSource = await createDatabaseConnection({");
			writer.indent(() => {
				writer.writeLine("databaseUrl: dbUrl,");
				writer.writeLine("ephemeral: isEphemeral");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine("if (isSeed && dataSource) {");
			writer.indent(() => {
				writer.writeLine("const seeder = new DatabaseSeeder();");
				writer.writeLine("await seeder.seedDatabase(dataSource);");
				writer.writeLine('console.log("Database seeded successfully.");');
			});
			writer.writeLine("}");
			writer.blankLine();
			writer.writeLine("app.locals.dataSource = dataSource;");
			writer.writeLine("const factory = new DaoFactory();");
			writer.writeLine("if (isStartAuthServer) {");
			writer.indent(() => {
				if (authSchema) {
					writer.writeLine(
						`app.use(createAuthRouter(factory.get${authSchema}Dao(isEphemeral, dataSource)));`,
					);
				} else {
					writer.writeLine("app.use(createAuthRouter());");
				}
			});
			writer.writeLine("}");
			writer.writeLine("app.use(createWebhooksRouter());");

			for (const schema of schemas) {
				writer.blankLine();
				writer.writeLine("if (dataSource) {");
				writer.indent(() => {
					writer.writeLine(
						`app.use('/${schema.toLowerCase()}', create${schema}Router(dataSource));`,
					);
				});
				writer.writeLine("} else {");
				writer.indent(() => {
					writer.writeLine(
						`app.use('/${schema.toLowerCase()}', express.Router().use((req, res) => res.status(501).json({ error: "Not Implemented (No DB)" })));`,
					);
				});
				writer.writeLine("}");
			}

			writer.blankLine();
			writer.writeLine("return app;");
		},
	});

	sourceFile.addStatements((writer: CodeBlockWriter) => {
		writer.blankLine();
		writer.writeLine("if (require.main === module) {");
		writer.indent(() => {
			writer.writeLine("startServer().then(app => {");
			writer.indent(() => {
				writer.writeLine("const port = process.env.PORT || 3000;");
				writer.writeLine("app.listen(port, () => {");
				writer.indent(() => {
					writer.writeLine(
						"console.log(`Server is listening on port ${port}`);",
					);
				});
				writer.writeLine("});");
			});
			writer.writeLine("}).catch(err => {");
			writer.indent(() => {
				writer.writeLine('console.error("Failed to start server", err);');
				writer.writeLine("process.exit(1);");
			});
			writer.writeLine("});");
		});
		writer.writeLine("}");
	});
	sourceFile.formatText();

	const testPath = path.join(outputDir, "server.spec.ts");
	const testFile = project.createSourceFile(testPath, "", {
		overwrite: true,
	});

	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./server.js",
		namedImports: ["startServer"],
	});

	testFile.addStatements((writer: CodeBlockWriter) => {
		writer.writeLine("describe('Server Entrypoint', () => {");
		writer.indent(() => {
			writer.writeLine(
				"it('should initialize stub mode when no DB args are provided', async () => {",
			);
			writer.indent(() => {
				writer.writeLine("const savedDbUrl = process.env.DATABASE_URL;");
				writer.writeLine("delete process.env.DATABASE_URL;");
				writer.writeLine("try {");
				writer.indent(() => {
					writer.writeLine(
						"const app = await startServer(['node', 'script.js']);",
					);
					writer.writeLine("expect(app).toBeDefined();");
					writer.writeLine(
						"if (app.locals && app.locals.dataSource) await app.locals.dataSource.destroy();",
					);
				});
				writer.writeLine("} finally {");
				writer.indent(() => {
					writer.writeLine(
						"if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;",
					);
				});
				writer.writeLine("}");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"it('should initialize ephemeral mode with --ephemeral', async () => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const app = await startServer(['node', 'script.js', '--ephemeral']);",
				);
				writer.writeLine("expect(app).toBeDefined();");
				writer.writeLine(
					"if (app.locals && app.locals.dataSource) await app.locals.dataSource.destroy();",
				);
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"it('should seed data when --seed and --ephemeral are provided', async () => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const app = await startServer(['node', 'script.js', '--ephemeral', '--seed']);",
				);
				writer.writeLine("expect(app).toBeDefined();");
				writer.writeLine(
					"if (app.locals && app.locals.dataSource) await app.locals.dataSource.destroy();",
				);
			});
			writer.writeLine("});");
		});
		writer.writeLine("});");
	});
	testFile.formatText();
}
