import path from "node:path";
import type { Project } from "ts-morph";
import type { IServerFrameworkGenerator } from "../../core/server/index.js";
import type { GeneratorConfig } from "../../core/types/config.js";
import type { Parameter } from "../../core/types/openapi.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { generateAdvancedMiddlewares } from "./advanced-mock-middlewares.js";

/**
 * Express framework generator implementation.
 * Generates Express.js routers and tests.
 */
export class ExpressServerGenerator implements IServerFrameworkGenerator {
	/**
	 * Generates Express routes and corresponding tests for a given entity.
	 * @param project The ts-morph project.
	 * @param schemaName The name of the schema/entity.
	 * @param outputDir The directory to save the route in.
	 * @param orm The ORM being used, if any.
	 * @param config The generator configuration options.
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

		let statements = `
export function createMcpRouter() {
    const router = Router();
    const server = new McpServer({
        name: '${title}',
        version: '${version}',
    });

    server.resource(
        'openapi_spec',
        'openapi://spec',
        { mimeType: 'application/json', description: 'The complete OpenAPI specification' },
        async (uri) => ({
            contents: [{
                uri: uri.href,
                mimeType: 'application/json',
                text: "{}"
            }]
        })
    );

    server.prompt(
        'analyze_spec',
        {
            query: z.string().optional().describe('Specific query about the API (optional)'),
        } as any,
        async (args: any) => ({
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: \`Please analyze this OpenAPI specification. \${args.query ? \`Focus on: \${args.query}\` : 'Provide a general summary.'}

        Spec:\\n\` + "{}"
                    }
                }
            ]
        } as any)
    );
`;

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

			// basic snake_case
			let toolName = methodName.replace(
				/[A-Z]/g,
				(letter: string) => `_${letter.toLowerCase()}`,
			);
			if (toolName.startsWith("_")) toolName = toolName.slice(1);

			const opDesc = (op.summary || op.description || "").replace(/'/g, "\\'");

			statements += `
    server.tool(
        '${toolName}',
        '${opDesc}',
        {`;

			if (op.parameters) {
				for (const param of op.parameters) {
					const p = param as Parameter;
					if (p.name) {
						const zodType = p.required ? "z.string()" : "z.string().optional()";
						const desc = (p.description || "").replace(/'/g, "\\'");
						statements += `\n            ${p.name}: ${zodType}${desc ? `.describe('${desc}')` : ""},`;
					}
				}
			}
			if (op.requestBody) {
				statements += `\n            body: z.any().optional().describe('JSON request body'),`;
			}

			statements += `
        } as any,
        async (args: any) => {
            try {
                ${
									_config?.options?.generateServices
										? `const client = new services.${serviceName}();
                const res = await client.${methodName}(args as any);`
										: `const res = { message: "Mock MCP execution. Enable --generateServices to bind real clients." };`
								}
                return {
                    content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
                } as any;
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }]
                } as any;
            }
        }
    );
`;
		}

		statements += `
    let transport: SSEServerTransport;

    router.get('/mcp/sse', async (req: Request, res: Response) => {
        transport = new SSEServerTransport('/mcp/messages', res);
        await server.connect(transport);
        
        if (req.headers.authorization) {
            // Forward basic auth/bearer token to context if needed
            (server as any).auth = req.headers.authorization;
        }
        
        await transport.start();
    });

    router.post('/mcp/messages', async (req: Request, res: Response) => {
        if (!transport) {
            res.status(503).json({ error: 'SSE connection not established' });
            return;
        }
        await transport.handlePostMessage(req, res);
    });

    return router;
}
`;
		sourceFile.addStatements(statements);
		sourceFile.formatText();
	}

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

		sourceFile.addStatements(`
	/**
	* Main server entrypoint.
	* Handles CLI flags, database connection, fake data seeding, and router initialization.
	*/
	export async function startServer(args: string[] = process.argv): Promise<express.Application> {
	const program = new Command();

	program
	.name("cdd-server")
	.description("CDD Mock Server")
	.option("--ephemeral", "Triggers the Concrete DAOs and overrides DATABASE_URL with a throwaway database.")
	.option("--seed", "Runs the fake data seeder on startup (requires a concrete DB connection).")
        .option("--strict-validation", "Enables strict OpenAPI request validation.")
        .option("--enforce-auth", "Enables strict authentication validation.");

	program.parse(args);
	const options = program.opts();

	const app = express();
	app.use(express.json());
        app.use(corsMiddleware);

	const isEphemeral = !!options.ephemeral;
	const isSeed = !!options.seed;
        const isStrict = !!options['strict-validation'];
        const isAuth = !!options['enforce-auth'];
	const dbUrl = process.env.DATABASE_URL;

        app.use(createValidationMiddleware(isStrict));
        app.use(createAuthMiddleware(isAuth, isEphemeral));

	// 1. Database Initialization
	const dataSource = await createDatabaseConnection({
	databaseUrl: dbUrl,
	ephemeral: isEphemeral
	});

	// 2. Data Seeding
	if (isSeed && dataSource) {
	const seeder = new DatabaseSeeder();
	await seeder.seedDatabase(dataSource);
	console.log("Database seeded successfully.");
	}

	// 3. Resolve DAOs
	const factory = new DaoFactory();

	// In a full DI implementation, the DAO factory would be passed to routers or services.
	// For now, we pass dataSource directly to the generated TypeORM routes if it exists,
	// otherwise the routes should handle null or we just mock them.
	// (Our routers currently expect a DataSource or use Stubs).

        app.use(createWebhooksRouter());

	${schemas
		.map((schema) => {
			return `
	if (dataSource) {
	app.use('/${schema.toLowerCase()}', create${schema}Router(dataSource));
	} else {
	// Fallback to stub routes or no-op if no DB (the default routes without DB)
	// Note: For full stub mode, your router generator should output stub DAOs.
	app.use('/${schema.toLowerCase()}', create${schema}Router(null as any)); 
	}`;
		})
		.join("\n")}

	return app;
	}

	if (require.main === module) {
	startServer().then(app => {
	const port = process.env.PORT || 3000;
	app.listen(port, () => {
	    console.log(\`Server is listening on port \${port}\`);
	});
	}).catch(err => {
	console.error("Failed to start server", err);
	process.exit(1);
	});
	}
	`);
		sourceFile.formatText();

		// Generate Test
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

		testFile.addStatements(`
	describe('Server Entrypoint', () => {
	it('should initialize stub mode when no DB args are provided', async () => {
	const app = await startServer(['node', 'script.js']);
	expect(app).toBeDefined();
	});

	it('should initialize ephemeral mode with --ephemeral', async () => {
	const app = await startServer(['node', 'script.js', '--ephemeral']);
	expect(app).toBeDefined();
	});

	it('should seed data when --seed and --ephemeral are provided', async () => {
	const app = await startServer(['node', 'script.js', '--ephemeral', '--seed']);
	expect(app).toBeDefined();
	});
	});
	`);
		testFile.formatText();
	}
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

		let fakeFields = "";
		const schemaDef = _parser?.schemas.find(
			(s) => s.name === schemaName,
		)?.definition;
		if (schemaDef && typeof schemaDef === "object" && schemaDef.properties) {
			for (const [propName, propDef] of Object.entries(schemaDef.properties)) {
				if (typeof propDef === "boolean") continue;
				if (propName === "id" || propName === "uuid") continue;

				if (propDef.type === "string") {
					if (propDef.format === "date" || propDef.format === "date-time") {
						fakeFields += `\n        ${propName}: faker.date.past().toISOString() as any,`;
					} else if (propName.toLowerCase().includes("email")) {
						fakeFields += `\n        ${propName}: faker.internet.email() as any,`;
					} else if (
						propName.toLowerCase().includes("name") ||
						propName.toLowerCase() === "first" ||
						propName.toLowerCase() === "last"
					) {
						fakeFields += `\n        ${propName}: faker.person.firstName() as any,`;
					} else {
						fakeFields += `\n        ${propName}: faker.lorem.word() as any,`;
					}
				} else if (propDef.type === "integer" || propDef.type === "number") {
					fakeFields += `\n        ${propName}: faker.number.int({ min: 1, max: 1000 }) as any,`;
				} else if (propDef.type === "boolean") {
					fakeFields += `\n        ${propName}: faker.datatype.boolean() as any,`;
				} else if (propDef.type === "array") {
					fakeFields += `\n        ${propName}: [] as any,`;
				} else {
					fakeFields += `\n        ${propName}: {} as any,`;
				}
			}
		}

		sourceFile.addStatements(`
	/**
	* Generates a fake ${schemaName} mock.
	*/
	export function fake${schemaName}(): Partial<${schemaName}> {
	return {${fakeFields}
	};
	}
	`);
		sourceFile.formatText();
	}

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

			sourceFile.addStatements(`
/**
 * Creates an Express Router for the ${schemaName} entity.
 * @param dataSource The active TypeORM DataSource.
 * @returns An Express Router instance.
 */
export function create${schemaName}Router(dataSource: DataSource): Router {
    const router = Router();
    const repository = dataSource.getRepository(${schemaName});

    /**
     * GET /
     * Retrieves all ${schemaName} entities.
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const entities = await repository.find();
            res.json(entities);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /
     * Creates a new ${schemaName} entity.
     */
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            // TODO: Validate req.body against the ${schemaName} schema before saving to prevent Mass Assignment
            const entity = repository.create(req.body);
            const saved = await repository.save(entity);
            res.status(201).json(saved);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
            `);
		} else {
			sourceFile.addImportDeclaration({
				moduleSpecifier: `../mocks/${fileName}.mock.js`,
				namedImports: [`fake${schemaName}`],
			});

			sourceFile.addStatements(`
/**
 * Creates an Express Router for the ${schemaName} entity.
 * @returns An Express Router instance.
 */
export function create${schemaName}Router(): Router {
    const router = Router();

    /**
     * GET /
     * Retrieves all ${schemaName} entities.
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.json([fake${schemaName}()]);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
            `);
		}

		sourceFile.formatText();
	}

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

		sourceFile.addStatements(`import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { create${schemaName}Router } from './${fileName}.routes.js';\n`);

		if (orm === "typeorm") {
			sourceFile.addStatements(`import { DataSource } from 'typeorm';

describe('${schemaName} Routes (Unit)', () => {
    let app: express.Application;
    let mockRepository: any;
    let mockDataSource: any;

    beforeEach(() => {
        mockRepository = {
            find: vi.fn().mockResolvedValue([{ id: 1 }]),
            create: vi.fn().mockImplementation((data: any) => data),
            save: vi.fn().mockImplementation(async (data: any) => ({ id: 1, ...data }))
        };

        mockDataSource = {
            getRepository: vi.fn().mockReturnValue(mockRepository)
        } as unknown as DataSource;

        app = express();
        app.use(express.json());
        app.use('/${fileName}', create${schemaName}Router(mockDataSource));
    });

    it('GET /${fileName} should return entities', async () => {
        const res = await request(app).get('/${fileName}');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ id: 1 }]);
        expect(mockRepository.find).toHaveBeenCalled();
    });

    it('POST /${fileName} should create an entity', async () => {
        const res = await request(app).post('/${fileName}').send({ someData: 'test' });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ id: 1, someData: 'test' });
        expect(mockRepository.save).toHaveBeenCalled();
    });
});
            `);
		} else {
			sourceFile.addStatements(`
describe('${schemaName} Routes (Unit)', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/${fileName}', create${schemaName}Router());
    });

    it('GET /${fileName} should return entities', async () => {
        const res = await request(app).get('/${fileName}');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([expect.any(Object)]);
    });
});
            `);
		}

		sourceFile.formatText();
	}

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
			sourceFile.addStatements(`
		import { describe, it, expect, beforeAll, afterAll } from 'vitest';
		import request from 'supertest';
		import express from 'express';
		import { DataSource } from 'typeorm';
		import { ${schemaName} } from '../entities/${fileName}.entity.js';
		import { create${schemaName}Router } from './${fileName}.routes.js';
		import { fake${schemaName} } from '../mocks/${fileName}.mock.js';

		describe('${schemaName} E2E (Routes + Storage)', () => {
		let app: express.Application;
		let dataSource: DataSource;

		beforeAll(async () => {
		dataSource = new DataSource({
		type: 'sqlite',
		database: ':memory:',
		entities: [${schemaName}],
		synchronize: true,
		logging: false
		});
		await dataSource.initialize();

		app = express();
		app.use(express.json());
		app.use('/${fileName}', create${schemaName}Router(dataSource));
		});

		afterAll(async () => {
		await dataSource.destroy();
		});

		it('should perform CRUD operations on ${schemaName}', async () => {
		let res = await request(app).get('/${fileName}');
		expect(res.status).toBe(200);
		expect(res.body).toEqual([]);

		res = await request(app).post('/${fileName}').send(fake${schemaName}());
		expect(res.status).toBe(201);
		expect(res.body).toHaveProperty('id');

		res = await request(app).get('/${fileName}');
		expect(res.status).toBe(200);
		expect(res.body.length).toBe(1);
		});
		});
		`);
		} else {
			sourceFile.addStatements(`
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { create${schemaName}Router } from './${fileName}.routes.js';

describe('${schemaName} E2E (Routes)', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/${fileName}', create${schemaName}Router());
    });

    it('should perform GET on ${schemaName}', async () => {
        const res = await request(app).get('/${fileName}');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([expect.any(Object)]);
    });
});
            `);
		}

		sourceFile.formatText();
	}
}
