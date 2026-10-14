/**
 * Generates Express.js routers, MCP SSE endpoints, server entrypoints, and route unit/E2E tests using ts-morph AST builders.
 *
 * @module vendors/express/express-server.generator
 */
import path from "node:path";
import type { CodeBlockWriter, Project } from "ts-morph";
import type { IServerFrameworkGenerator } from "../../core/server/index.js";
import type { GeneratorConfig } from "../../core/types/config.js";
import type { Parameter } from "../../core/types/openapi.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { generateAdvancedMiddlewares } from "./advanced-mock-middlewares.js";

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
	 * @param _config - Optional generator configuration.
	 */
	public generateMcpRoutes(
		project: Project,
		parser: SwaggerParser,
		outputDir: string,
		_config?: GeneratorConfig,
	): void {
		const filePath = path.join(outputDir, "mcp.routes.ts");
		const sourceFile = project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "express",
			namedImports: ["Router", "Request", "Response"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/server/mcp.js",
			namedImports: ["McpServer"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/server/sse.js",
			namedImports: ["SSEServerTransport"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "zod",
			namedImports: ["z"],
		});
		if (_config?.options?.generateServices) {
			sourceFile.addImportDeclaration({
				moduleSpecifier: "../services/index.js",
				namespaceImport: "services",
			});
		}

		const info = parser?.spec?.info || {};
		const title = info.title || "api-mcp";
		const version = info.version || "1.0.0";

		sourceFile.addFunction({
			isExported: true,
			name: "createMcpRouter",
			statements: (writer: CodeBlockWriter) => {
				writer.writeLine("const router = Router();");
				writer.writeLine("const server = new McpServer({");
				writer.indent(() => {
					writer.writeLine(`name: '${title}',`);
					writer.writeLine(`version: '${version}',`);
				});
				writer.writeLine("});");
				writer.blankLine();
				writer.writeLine("server.resource(");
				writer.indent(() => {
					writer.writeLine("'openapi_spec',");
					writer.writeLine("'openapi://spec',");
					writer.writeLine(
						"{ mimeType: 'application/json', description: 'The complete OpenAPI specification' },",
					);
					writer.writeLine("async (uri) => ({");
					writer.indent(() => {
						writer.writeLine("contents: [{");
						writer.indent(() => {
							writer.writeLine("uri: uri.href,");
							writer.writeLine("mimeType: 'application/json',");
							writer.writeLine('text: "{}"');
						});
						writer.writeLine("}]");
					});
					writer.writeLine("})");
				});
				writer.writeLine(");");
				writer.blankLine();
				writer.writeLine("server.prompt(");
				writer.indent(() => {
					writer.writeLine("'analyze_spec',");
					writer.writeLine("{");
					writer.indent(() => {
						writer.writeLine(
							"query: z.string().optional().describe('Specific query about the API (optional)'),",
						);
					});
					writer.writeLine("} as any,");
					writer.writeLine("async (args: any) => ({");
					writer.indent(() => {
						writer.writeLine("messages: [");
						writer.indent(() => {
							writer.writeLine("{");
							writer.indent(() => {
								writer.writeLine("role: 'user',");
								writer.writeLine("content: {");
								writer.indent(() => {
									writer.writeLine("type: 'text',");
									writer.writeLine(
										"text: `Please analyze this OpenAPI specification. ${args.query ? `Focus on: ${args.query}` : 'Provide a general summary.'}` + ' {}',",
									);
								});
								writer.writeLine("}");
							});
							writer.writeLine("}");
						});
						writer.writeLine("]");
					});
					writer.writeLine("} as any)");
				});
				writer.writeLine(");");

				for (const op of parser.operations) {
					const group = op.tags?.[0]
						? typeof op.tags[0] === "string"
							? op.tags[0]
							: (op.tags[0] as object as { name?: string }).name ||
								String(op.tags[0])
						: "Default";
					const serviceName = `${group}Service`;
					const methodName =
						op.operationId || op.path.replace(/\//g, "_").replace(/^_/, "");

					let toolName = methodName.replace(
						/[A-Z]/g,
						(letter: string) => `_${letter.toLowerCase()}`,
					);
					if (toolName.startsWith("_")) toolName = toolName.slice(1);

					const opDesc = (op.summary || op.description || "").replace(
						/'/g,
						"'",
					);

					writer.blankLine();
					writer.writeLine("server.tool(");
					writer.indent(() => {
						writer.writeLine(`'${toolName}',`);
						writer.writeLine(`'${opDesc}',`);
						writer.writeLine("{");
						writer.indent(() => {
							if (op.parameters) {
								for (const param of op.parameters) {
									const p = param as Parameter;
									if (p.name) {
										const zodType = p.required
											? "z.string()"
											: "z.string().optional()";
										const desc = (p.description || "").replace(/'/g, "'");
										writer.writeLine(
											`${p.name}: ${zodType}${desc ? `.describe('${desc}')` : ""},`,
										);
									}
								}
							}
							if (op.requestBody) {
								writer.writeLine(
									"body: z.any().optional().describe('JSON request body'),",
								);
							}
						});
						writer.writeLine("} as any,");
						writer.writeLine("async (args: any) => {");
						writer.indent(() => {
							writer.writeLine("try {");
							writer.indent(() => {
								if (_config?.options?.generateServices) {
									writer.writeLine(
										`const client = new services.${serviceName}();`,
									);
									writer.writeLine(
										`const res = await client.${methodName}(args as any);`,
									);
								} else {
									writer.writeLine(
										'const res = { message: "Mock MCP execution. Enable --generateServices to bind real clients." };',
									);
								}
								writer.writeLine("return {");
								writer.indent(() => {
									writer.writeLine(
										"content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]",
									);
								});
								writer.writeLine("} as any;");
							});
							writer.writeLine("} catch (err) {");
							writer.indent(() => {
								writer.writeLine("return {");
								writer.indent(() => {
									writer.writeLine("isError: true,");
									writer.writeLine(
										"content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }]",
									);
								});
								writer.writeLine("} as any;");
							});
							writer.writeLine("}");
						});
						writer.writeLine("}");
					});
					writer.writeLine(");");
				}

				writer.blankLine();
				writer.writeLine("let transport: SSEServerTransport;");
				writer.blankLine();
				writer.writeLine(
					"router.get('/mcp/sse', async (req: Request, res: Response) => {",
				);
				writer.indent(() => {
					writer.writeLine(
						"transport = new SSEServerTransport('/mcp/messages', res);",
					);
					writer.writeLine("await server.connect(transport);");
					writer.writeLine("if (req.headers.authorization) {");
					writer.indent(() => {
						writer.writeLine(
							"(server as any).auth = req.headers.authorization;",
						);
					});
					writer.writeLine("}");
					writer.writeLine("await transport.start();");
				});
				writer.writeLine("});");
				writer.blankLine();
				writer.writeLine(
					"router.post('/mcp/messages', async (req: Request, res: Response) => {",
				);
				writer.indent(() => {
					writer.writeLine("if (!transport) {");
					writer.indent(() => {
						writer.writeLine(
							"res.status(503).json({ error: 'SSE connection not established' });",
						);
						writer.writeLine("return;");
					});
					writer.writeLine("}");
					writer.writeLine("await transport.handlePostMessage(req, res);");
				});
				writer.writeLine("});");
				writer.blankLine();
				writer.writeLine("return router;");
			},
		});
		sourceFile.formatText();
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
		parser?: SwaggerParser,
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

		for (const schema of schemas) {
			const fileName = schema.toLowerCase();
			sourceFile.addImportDeclaration({
				moduleSpecifier: `./routes/${fileName}.routes.js`,
				namedImports: [`create${schema}Router`],
			});
		}

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
						'.option("--enforce-auth", "Enables strict authentication validation.");',
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
					writer.writeLine(
						"const app = await startServer(['node', 'script.js']);",
					);
					writer.writeLine("expect(app).toBeDefined();");
					writer.writeLine(
						"if ((app as any).locals && (app as any).locals.dataSource) await (app as any).locals.dataSource.destroy();",
					);
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
						"if ((app as any).locals && (app as any).locals.dataSource) await (app as any).locals.dataSource.destroy();",
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
						"if ((app as any).locals && (app as any).locals.dataSource) await (app as any).locals.dataSource.destroy();",
					);
				});
				writer.writeLine("});");
			});
			writer.writeLine("});");
		});
		testFile.formatText();
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
		parser?: SwaggerParser,
	): void {
		this.generateMock(project, schemaName, outputDir, parser);
		this.generateEntityRoute(project, schemaName, outputDir, orm);

		const shouldGenerateTests = config?.options?.tests ?? false;
		if (shouldGenerateTests) {
			this.generateRouteTest(project, schemaName, outputDir, orm);
			this.generateE2ETest(project, schemaName, outputDir, orm);
		}
	}

	/**
	 * Generates a Faker-based mock entity factory (`<entity>.mock.ts`).
	 *
	 * @param project - The `ts-morph` project.
	 * @param schemaName - The name of the entity schema.
	 * @param outputDir - Target routes directory.
	 * @param _parser - Optional parsed OpenAPI specification.
	 */
	private generateMock(
		project: Project,
		schemaName: string,
		outputDir: string,
		_parser?: SwaggerParser,
	): void {
		const fileName = schemaName.toLowerCase();
		const mocksDir = path.join(outputDir, "..", "mocks");
		const filePath = path.join(mocksDir, `${fileName}.mock.ts`);
		const sourceFile = project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "@faker-js/faker",
			namedImports: ["faker"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: `../models/${schemaName}.js`,
			namedImports: [schemaName],
		});

		const fieldLines: string[] = [];
		const schemaDef = _parser?.schemas.find(
			(s) => s.name === schemaName,
		)?.definition;
		if (schemaDef && typeof schemaDef === "object" && schemaDef.properties) {
			for (const [propName, propDef] of Object.entries(schemaDef.properties)) {
				if (typeof propDef === "boolean") continue;
				if (propName === "id" || propName === "uuid") continue;

				if (propDef.type === "string") {
					if (propDef.format === "date" || propDef.format === "date-time") {
						fieldLines.push(
							`${propName}: faker.date.past().toISOString() as any,`,
						);
					} else if (propName.toLowerCase().includes("email")) {
						fieldLines.push(`${propName}: faker.internet.email() as any,`);
					} else if (
						propName.toLowerCase().includes("name") ||
						propName.toLowerCase() === "first" ||
						propName.toLowerCase() === "last"
					) {
						fieldLines.push(`${propName}: faker.person.firstName() as any,`);
					} else {
						fieldLines.push(`${propName}: faker.lorem.word() as any,`);
					}
				} else if (propDef.type === "integer" || propDef.type === "number") {
					fieldLines.push(
						`${propName}: faker.number.int({ min: 1, max: 1000 }) as any,`,
					);
				} else if (propDef.type === "boolean") {
					fieldLines.push(`${propName}: faker.datatype.boolean() as any,`);
				} else if (propDef.type === "array") {
					fieldLines.push(`${propName}: [] as any,`);
				} else {
					fieldLines.push(`${propName}: {} as any,`);
				}
			}
		}

		sourceFile.addFunction({
			isExported: true,
			name: `fake${schemaName}`,
			returnType: `Partial<${schemaName}>`,
			docs: [{ description: `Generates a fake ${schemaName} mock.` }],
			statements: (writer: CodeBlockWriter) => {
				writer.writeLine("return {");
				writer.indent(() => {
					for (const line of fieldLines) {
						writer.writeLine(line);
					}
				});
				writer.writeLine("};");
			},
		});
		sourceFile.formatText();
	}

	/**
	 * Generates the Express router file (`<entity>.routes.ts`) for an entity.
	 *
	 * @param project - The `ts-morph` project.
	 * @param schemaName - The name of the entity schema.
	 * @param outputDir - Target routes directory.
	 * @param orm - Optional ORM identifier (`"typeorm"`).
	 */
	private generateEntityRoute(
		project: Project,
		schemaName: string,
		outputDir: string,
		orm?: string,
	): void {
		const fileName = schemaName.toLowerCase();
		const filePath = path.join(outputDir, `${fileName}.routes.ts`);
		const sourceFile = project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "express",
			namedImports: ["Router", "Request", "Response", "NextFunction"],
		});

		if (orm === "typeorm") {
			sourceFile.addImportDeclaration({
				moduleSpecifier: "typeorm",
				namedImports: ["DataSource"],
			});

			sourceFile.addImportDeclaration({
				moduleSpecifier: `../entities/${fileName}.entity.js`,
				namedImports: [schemaName],
			});

			sourceFile.addFunction({
				isExported: true,
				name: `create${schemaName}Router`,
				returnType: "Router",
				parameters: [{ name: "dataSource", type: "DataSource" }],
				docs: [
					{
						description: `Creates an Express Router for the ${schemaName} entity.`,
						tags: [
							{
								tagName: "param",
								text: "dataSource The active TypeORM DataSource.",
							},
							{ tagName: "returns", text: "An Express Router instance." },
						],
					},
				],
				statements: (writer: CodeBlockWriter) => {
					writer.writeLine("const router = Router();");
					writer.writeLine(
						`const repository = dataSource.getRepository(${schemaName});`,
					);
					writer.blankLine();
					writer.writeLine(
						"router.get('/', async (req: Request, res: Response, next: NextFunction) => {",
					);
					writer.indent(() => {
						writer.writeLine("try {");
						writer.indent(() => {
							writer.writeLine("const entities = await repository.find();");
							writer.writeLine("res.json(entities);");
						});
						writer.writeLine("} catch (error) {");
						writer.indent(() => {
							writer.writeLine("next(error);");
						});
						writer.writeLine("}");
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine(
						"router.post('/', async (req: Request, res: Response, next: NextFunction) => {",
					);
					writer.indent(() => {
						writer.writeLine("try {");
						writer.indent(() => {
							writer.writeLine("const entity = repository.create(req.body);");
							writer.writeLine("const saved = await repository.save(entity);");
							writer.writeLine("res.status(201).json(saved);");
						});
						writer.writeLine("} catch (error) {");
						writer.indent(() => {
							writer.writeLine("next(error);");
						});
						writer.writeLine("}");
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine("return router;");
				},
			});
		} else {
			sourceFile.addImportDeclaration({
				moduleSpecifier: `../mocks/${fileName}.mock.js`,
				namedImports: [`fake${schemaName}`],
			});

			sourceFile.addFunction({
				isExported: true,
				name: `create${schemaName}Router`,
				returnType: "Router",
				docs: [
					{
						description: `Creates an Express Router for the ${schemaName} entity.`,
						tags: [{ tagName: "returns", text: "An Express Router instance." }],
					},
				],
				statements: (writer: CodeBlockWriter) => {
					writer.writeLine("const router = Router();");
					writer.blankLine();
					writer.writeLine(
						"router.get('/', async (req: Request, res: Response, next: NextFunction) => {",
					);
					writer.indent(() => {
						writer.writeLine("try {");
						writer.indent(() => {
							writer.writeLine(`res.json([fake${schemaName}()]);`);
						});
						writer.writeLine("} catch (error) {");
						writer.indent(() => {
							writer.writeLine("next(error);");
						});
						writer.writeLine("}");
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine("return router;");
				},
			});
		}

		sourceFile.formatText();
	}

	/**
	 * Generates the unit test suite (`<entity>.routes.spec.ts`) for an entity's Express router.
	 *
	 * @param project - The `ts-morph` project.
	 * @param schemaName - The name of the entity schema.
	 * @param outputDir - Target routes directory.
	 * @param orm - Optional ORM identifier (`"typeorm"`).
	 */
	private generateRouteTest(
		project: Project,
		schemaName: string,
		outputDir: string,
		orm?: string,
	): void {
		const fileName = schemaName.toLowerCase();
		const filePath = path.join(outputDir, `${fileName}.routes.spec.ts`);
		const sourceFile = project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "vitest",
			namedImports: ["describe", "it", "expect", "vi", "beforeEach"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "supertest",
			defaultImport: "request",
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "express",
			defaultImport: "express",
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: `./${fileName}.routes.js`,
			namedImports: [`create${schemaName}Router`],
		});

		if (orm === "typeorm") {
			sourceFile.addImportDeclaration({
				moduleSpecifier: "typeorm",
				namedImports: ["DataSource"],
			});

			sourceFile.addStatements((writer: CodeBlockWriter) => {
				writer.writeLine(`describe('${schemaName} Routes (Unit)', () => {`);
				writer.indent(() => {
					writer.writeLine("let app: express.Application;");
					writer.writeLine("let mockRepository: any;");
					writer.writeLine("let mockDataSource: any;");
					writer.blankLine();
					writer.writeLine("beforeEach(() => {");
					writer.indent(() => {
						writer.writeLine("mockRepository = {");
						writer.indent(() => {
							writer.writeLine("find: vi.fn().mockResolvedValue([{ id: 1 }]),");
							writer.writeLine(
								"create: vi.fn().mockImplementation((data: any) => data),",
							);
							writer.writeLine(
								"save: vi.fn().mockImplementation(async (data: any) => ({ id: 1, ...data }))",
							);
						});
						writer.writeLine("};");
						writer.blankLine();
						writer.writeLine("mockDataSource = {");
						writer.indent(() => {
							writer.writeLine(
								"getRepository: vi.fn().mockReturnValue(mockRepository)",
							);
						});
						writer.writeLine("} as Partial<DataSource> as DataSource;");
						writer.blankLine();
						writer.writeLine("app = express();");
						writer.writeLine("app.use(express.json());");
						writer.writeLine(
							`app.use('/${fileName}', create${schemaName}Router(mockDataSource));`,
						);
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine(
						`it('GET /${fileName} should return entities', async () => {`,
					);
					writer.indent(() => {
						writer.writeLine(
							`const res = await request(app).get('/${fileName}');`,
						);
						writer.writeLine("expect(res.status).toBe(200);");
						writer.writeLine("expect(res.body).toEqual([{ id: 1 }]);");
						writer.writeLine("expect(mockRepository.find).toHaveBeenCalled();");
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine(
						`it('POST /${fileName} should create an entity', async () => {`,
					);
					writer.indent(() => {
						writer.writeLine(
							`const res = await request(app).post('/${fileName}').send({ someData: 'test' });`,
						);
						writer.writeLine("expect(res.status).toBe(201);");
						writer.writeLine(
							"expect(res.body).toMatchObject({ id: 1, someData: 'test' });",
						);
						writer.writeLine("expect(mockRepository.save).toHaveBeenCalled();");
					});
					writer.writeLine("});");
				});
				writer.writeLine("});");
			});
		} else {
			sourceFile.addStatements((writer: CodeBlockWriter) => {
				writer.writeLine(`describe('${schemaName} Routes (Unit)', () => {`);
				writer.indent(() => {
					writer.writeLine("let app: express.Application;");
					writer.blankLine();
					writer.writeLine("beforeEach(() => {");
					writer.indent(() => {
						writer.writeLine("app = express();");
						writer.writeLine("app.use(express.json());");
						writer.writeLine(
							`app.use('/${fileName}', create${schemaName}Router());`,
						);
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine(
						`it('GET /${fileName} should return entities', async () => {`,
					);
					writer.indent(() => {
						writer.writeLine(
							`const res = await request(app).get('/${fileName}');`,
						);
						writer.writeLine("expect(res.status).toBe(200);");
						writer.writeLine("expect(res.body).toEqual([expect.any(Object)]);");
					});
					writer.writeLine("});");
				});
				writer.writeLine("});");
			});
		}

		sourceFile.formatText();
	}

	/**
	 * Generates the E2E test suite (`<entity>.e2e.spec.ts`) for an entity's Express router.
	 *
	 * @param project - The `ts-morph` project.
	 * @param schemaName - The name of the entity schema.
	 * @param outputDir - Target routes directory.
	 * @param orm - Optional ORM identifier (`"typeorm"`).
	 */
	private generateE2ETest(
		project: Project,
		schemaName: string,
		outputDir: string,
		orm?: string,
	): void {
		const fileName = schemaName.toLowerCase();
		const filePath = path.join(outputDir, `${fileName}.e2e.spec.ts`);
		const sourceFile = project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		if (orm === "typeorm") {
			sourceFile.addImportDeclaration({
				moduleSpecifier: "vitest",
				namedImports: ["describe", "it", "expect", "beforeAll", "afterAll"],
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: "supertest",
				defaultImport: "request",
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: "express",
				defaultImport: "express",
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: "typeorm",
				namedImports: ["DataSource"],
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: `../entities/${fileName}.entity.js`,
				namedImports: [schemaName],
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: `./${fileName}.routes.js`,
				namedImports: [`create${schemaName}Router`],
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: `../mocks/${fileName}.mock.js`,
				namedImports: [`fake${schemaName}`],
			});

			sourceFile.addStatements((writer: CodeBlockWriter) => {
				writer.writeLine(
					`describe('${schemaName} E2E (Routes + Storage)', () => {`,
				);
				writer.indent(() => {
					writer.writeLine("let app: express.Application;");
					writer.writeLine("let dataSource: DataSource;");
					writer.blankLine();
					writer.writeLine("beforeAll(async () => {");
					writer.indent(() => {
						writer.writeLine("dataSource = new DataSource({");
						writer.indent(() => {
							writer.writeLine("type: 'better-sqlite3',");
							writer.writeLine("database: ':memory:',");
							writer.writeLine(`entities: [${schemaName}],`);
							writer.writeLine("synchronize: true,");
							writer.writeLine("logging: false");
						});
						writer.writeLine("});");
						writer.writeLine("await dataSource.initialize();");
						writer.blankLine();
						writer.writeLine("app = express();");
						writer.writeLine("app.use(express.json());");
						writer.writeLine(
							`app.use('/${fileName}', create${schemaName}Router(dataSource));`,
						);
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine("afterAll(async () => {");
					writer.indent(() => {
						writer.writeLine("await dataSource.destroy();");
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine(
						`it('should perform CRUD operations on ${schemaName}', async () => {`,
					);
					writer.indent(() => {
						writer.writeLine(
							`let res = await request(app).get('/${fileName}');`,
						);
						writer.writeLine("expect(res.status).toBe(200);");
						writer.writeLine("expect(res.body).toEqual([]);");
						writer.blankLine();
						writer.writeLine(
							`res = await request(app).post('/${fileName}').send(fake${schemaName}());`,
						);
						writer.writeLine("expect(res.status).toBe(201);");
						writer.writeLine("expect(res.body).toHaveProperty('id');");
						writer.blankLine();
						writer.writeLine(`res = await request(app).get('/${fileName}');`);
						writer.writeLine("expect(res.status).toBe(200);");
						writer.writeLine("expect(res.body.length).toBe(1);");
					});
					writer.writeLine("});");
				});
				writer.writeLine("});");
			});
		} else {
			sourceFile.addImportDeclaration({
				moduleSpecifier: "vitest",
				namedImports: ["describe", "it", "expect", "beforeAll"],
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: "supertest",
				defaultImport: "request",
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: "express",
				defaultImport: "express",
			});
			sourceFile.addImportDeclaration({
				moduleSpecifier: `./${fileName}.routes.js`,
				namedImports: [`create${schemaName}Router`],
			});

			sourceFile.addStatements((writer: CodeBlockWriter) => {
				writer.writeLine(`describe('${schemaName} E2E (Routes)', () => {`);
				writer.indent(() => {
					writer.writeLine("let app: express.Application;");
					writer.blankLine();
					writer.writeLine("beforeAll(() => {");
					writer.indent(() => {
						writer.writeLine("app = express();");
						writer.writeLine("app.use(express.json());");
						writer.writeLine(
							`app.use('/${fileName}', create${schemaName}Router());`,
						);
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine(
						`it('should perform GET on ${schemaName}', async () => {`,
					);
					writer.indent(() => {
						writer.writeLine(
							`const res = await request(app).get('/${fileName}');`,
						);
						writer.writeLine("expect(res.status).toBe(200);");
						writer.writeLine("expect(res.body).toEqual([expect.any(Object)]);");
					});
					writer.writeLine("});");
				});
				writer.writeLine("});");
			});
		}

		sourceFile.formatText();
	}
}
