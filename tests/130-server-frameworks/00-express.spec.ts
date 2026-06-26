import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { ExpressServerGenerator } from "../../src/vendors/express/express-server.generator.js";

describe("ExpressServerGenerator", () => {
	it("should generate routes, route tests, and E2E tests for TypeORM configuration", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();

		generator.generateEntityRoutes(project, "User", "/out/routes", "typeorm", {
			options: { tests: true },
		} as any);

		// Check router file generation
		const routeFile = project.getSourceFileOrThrow(
			"/out/routes/user.routes.ts",
		);
		const routeText = routeFile.getFullText();
		expect(routeText).toContain(
			"export function createUserRouter(dataSource: DataSource): Router {",
		);
		expect(routeText).toContain(
			"const repository = dataSource.getRepository(User);",
		);

		// Check route unit test file generation
		const routeTestFile = project.getSourceFileOrThrow(
			"/out/routes/user.routes.spec.ts",
		);
		const routeTestText = routeTestFile.getFullText();
		expect(routeTestText).toContain("describe('User Routes (Unit)', () => {");
		expect(routeTestText).toContain(
			"expect(mockRepository.find).toHaveBeenCalled();",
		);

		// Check E2E test file generation
		const e2eTestFile = project.getSourceFileOrThrow(
			"/out/routes/user.e2e.spec.ts",
		);
		const e2eTestText = e2eTestFile.getFullText();
		expect(e2eTestText).toContain(
			"describe('User E2E (Routes + Storage)', () => {",
		);
		expect(e2eTestText).toContain("type: 'better-sqlite3',");
		expect(e2eTestText).toContain("entities: [User],");
	});

	it("should generate dummy routes, route tests, and E2E tests without ORM configuration", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();

		const mockParser = {
			schemas: [
				{
					name: "User",
					definition: {
						type: "object",
						properties: {
							id: { type: "integer" },
							uuid: { type: "string" },
							name: { type: "string" },
							email: { type: "string" },
							first: { type: "string" },
							last: { type: "string" },
							description: { type: "string" },
							age: { type: "integer" },
							createdAt: { type: "string", format: "date-time" },
							isActive: { type: "boolean" },
							tags: { type: "array" },
							metadata: { type: "object" },
							skippedProp: true,
						},
					},
				},
			],
		} as any;

		generator.generateEntityRoutes(
			project,
			"User",
			"/out/routes",
			undefined,
			{
				options: { tests: true },
			} as any,
			mockParser,
		);

		// Check mock file generation
		const mockFile = project.getSourceFileOrThrow("/out/mocks/user.mock.ts");
		const mockText = mockFile.getFullText();
		expect(mockText).toContain("name: faker.person.firstName() as any,");
		expect(mockText).toContain("email: faker.internet.email() as any,");
		expect(mockText).toContain(
			"age: faker.number.int({ min: 1, max: 1000 }) as any,",
		);
		expect(mockText).toContain(
			"createdAt: faker.date.past().toISOString() as any,",
		);
		expect(mockText).toContain("isActive: faker.datatype.boolean() as any,");
		expect(mockText).toContain("tags: [] as any,");
		expect(mockText).toContain("metadata: {} as any,");

		// Check router file generation
		const routeFile = project.getSourceFileOrThrow(
			"/out/routes/user.routes.ts",
		);
		const routeText = routeFile.getFullText();
		expect(routeText).toContain("export function createUserRouter(): Router {");
		expect(routeText).toContain("res.json([fakeUser()]);");

		// Check route unit test file generation
		const routeTestFile = project.getSourceFileOrThrow(
			"/out/routes/user.routes.spec.ts",
		);
		const routeTestText = routeTestFile.getFullText();
		expect(routeTestText).toContain("describe('User Routes (Unit)', () => {");
		expect(routeTestText).not.toContain("mockRepository");

		// Check E2E test file generation
		const e2eTestFile = project.getSourceFileOrThrow(
			"/out/routes/user.e2e.spec.ts",
		);
		const e2eTestText = e2eTestFile.getFullText();
		expect(e2eTestText).toContain("describe('User E2E (Routes)', () => {");
		expect(e2eTestText).not.toContain("DataSource");
	});

	it("should respect config.options.tests being false", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();
		const config: any = { options: { tests: false } };

		generator.generateEntityRoutes(
			project,
			"User",
			"/out/routes",
			undefined,
			config,
		);

		// route file generated
		expect(project.getSourceFile("/out/routes/user.routes.ts")).toBeDefined();

		// test files omitted
		expect(
			project.getSourceFile("/out/routes/user.routes.spec.ts"),
		).toBeUndefined();
		expect(
			project.getSourceFile("/out/routes/user.e2e.spec.ts"),
		).toBeUndefined();
	});

	it("should default to no tests if config is omitted", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();

		generator.generateEntityRoutes(project, "User", "/out/routes", undefined);

		// route file generated
		expect(project.getSourceFile("/out/routes/user.routes.ts")).toBeDefined();

		// test files omitted
		expect(
			project.getSourceFile("/out/routes/user.routes.spec.ts"),
		).toBeUndefined();
		expect(
			project.getSourceFile("/out/routes/user.e2e.spec.ts"),
		).toBeUndefined();
	});

	it("should generate MCP integration routes", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();
		const parser = {
			spec: {
				info: { title: "Test API", version: "2.0.0" },
			},
			operations: [
				{
					tags: ["TestTag"],
					operationId: "testOp",
					path: "/test",
					summary: "A test operation",
					parameters: [
						{ name: "param1", required: true, description: "first param" },
						{ name: "param2", required: false },
						{
							/* nameless parameter should be ignored */
						},
					],
					requestBody: {},
				},
				{
					// No tags, no operationId, no parameters, no body
					path: "/fallback",
				},
				{
					// Tags as objects
					tags: [{ name: "ObjTag" }],
					path: "/obj",
				},
				{
					// Capital start letter
					operationId: "TestCapital",
					path: "/cap",
				},
				{
					// Tag as object without name
					tags: [{}],
					path: "/objnoname",
				},
			],
		};
		generator.generateMcpRoutes(project, parser as any, "/output");

		const mcpFile = project.getSourceFile("/output/mcp.routes.ts");
		expect(mcpFile).toBeDefined();

		const text = mcpFile?.getFullText();
		expect(text).toContain("export function createMcpRouter()");
		expect(text).toContain("server.connect(transport)");
		expect(text).toContain("router.get('/mcp/sse'");
		expect(text).toContain("router.post('/mcp/messages'");
		expect(text).toContain("'test_op'");

		expect(text).toContain("server.prompt(");
		expect(text).toContain("'analyze_spec'");
		expect(text).toContain("query: z.string().optional()");
	});

	it("should fall back to defaults if parser info is missing in generateMcpRoutes", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();
		const parser = {
			spec: { info: {} },
			operations: [],
		};
		generator.generateMcpRoutes(project, parser as any, "/output2");
		const mcpFile = project.getSourceFile("/output2/mcp.routes.ts");
		const text = mcpFile?.getFullText();
		expect(text).toContain("name: 'api-mcp'");
		expect(text).toContain("version: '1.0.0'");
	});

	it("should fall back to defaults if parser spec is totally missing in generateMcpRoutes", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();
		const parser = {
			operations: [{ operationId: "getSomeData" }],
		};
		generator.generateMcpRoutes(project, parser as any, "/output3", {
			options: { generateServices: true },
		} as any);
		const mcpFile = project.getSourceFile("/output3/mcp.routes.ts");
		expect(mcpFile?.getFullText()).toContain(
			'import * as services from "../services/index.js";',
		);
	});

	it("should generate the server entrypoint with CLI options and imports", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();
		const dummyParser = {
			spec: {
				info: { title: "Test", version: "1.0" },
				openapi: "3.0",
				paths: {},
			},
			schemas: [],
			operations: [],
		} as any;
		generator.generateServerEntrypoint(
			project,
			["User", "Post"],
			"/out",
			dummyParser,
		);

		const entrypointFile = project.getSourceFileOrThrow("/out/server.ts");
		const text = entrypointFile.getFullText();

		expect(text).toContain('import { Command } from "commander";');
		expect(text).toContain(
			'import { createDatabaseConnection } from "./db/connection.js";',
		);
		expect(text).toContain(
			'import { DatabaseSeeder } from "./seeder/index.js";',
		);
		expect(text).toContain('import { DaoFactory } from "./dao/factory.js";');
		expect(text).toContain(
			'import { createUserRouter } from "./routes/user.routes.js";',
		);
		expect(text).toContain(
			'import { createPostRouter } from "./routes/post.routes.js";',
		);
		expect(text).toContain('.option("--ephemeral",');
		expect(text).toContain('.option("--seed",');
		expect(text).toContain("app.use('/user', createUserRouter(dataSource));");
		expect(text).toContain("app.use('/post', createPostRouter(dataSource));");

		const testFile = project.getSourceFileOrThrow("/out/server.spec.ts");
		const testText = testFile.getFullText();
		expect(testText).toContain("describe('Server Entrypoint'");
	});

	it("should generate the server entrypoint without parser", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();
		generator.generateServerEntrypoint(project, ["User", "Post"], "/out2");
		const entrypointFile = project.getSourceFileOrThrow("/out2/server.ts");
		expect(entrypointFile.getFullText()).toContain(
			'import { Command } from "commander";',
		);
	});
});
