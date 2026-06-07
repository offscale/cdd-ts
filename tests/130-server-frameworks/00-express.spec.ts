import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { ExpressServerGenerator } from "../../src/vendors/express/express-server.generator.js";

describe("ExpressServerGenerator", () => {
	it("should generate routes, route tests, and E2E tests for TypeORM configuration", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();

		generator.generateEntityRoutes(
			project,
			"User",
			"/out/entities",
			"typeorm",
			{
				options: { tests: true },
			} as any,
		);

		// Check router file generation
		const routeFile = project.getSourceFileOrThrow(
			"/out/entities/user.routes.ts",
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
			"/out/entities/user.routes.spec.ts",
		);
		const routeTestText = routeTestFile.getFullText();
		expect(routeTestText).toContain("describe('User Routes (Unit)', () => {");
		expect(routeTestText).toContain(
			"expect(mockRepository.find).toHaveBeenCalled();",
		);

		// Check E2E test file generation
		const e2eTestFile = project.getSourceFileOrThrow(
			"/out/entities/user.e2e.spec.ts",
		);
		const e2eTestText = e2eTestFile.getFullText();
		expect(e2eTestText).toContain(
			"describe('User E2E (Routes + Storage)', () => {",
		);
		expect(e2eTestText).toContain("type: 'sqlite',");
		expect(e2eTestText).toContain("entities: [User],");
	});

	it("should generate dummy routes, route tests, and E2E tests without ORM configuration", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();

		generator.generateEntityRoutes(
			project,
			"User",
			"/out/entities",
			undefined,
			{
				options: { tests: true },
			} as any,
		);

		// Check router file generation
		const routeFile = project.getSourceFileOrThrow(
			"/out/entities/user.routes.ts",
		);
		const routeText = routeFile.getFullText();
		expect(routeText).toContain("export function createUserRouter(): Router {");
		expect(routeText).toContain("res.json([]);");

		// Check route unit test file generation
		const routeTestFile = project.getSourceFileOrThrow(
			"/out/entities/user.routes.spec.ts",
		);
		const routeTestText = routeTestFile.getFullText();
		expect(routeTestText).toContain("describe('User Routes (Unit)', () => {");
		expect(routeTestText).not.toContain("mockRepository");

		// Check E2E test file generation
		const e2eTestFile = project.getSourceFileOrThrow(
			"/out/entities/user.e2e.spec.ts",
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
			"/out/entities",
			undefined,
			config,
		);

		// route file generated
		expect(project.getSourceFile("/out/entities/user.routes.ts")).toBeDefined();

		// test files omitted
		expect(
			project.getSourceFile("/out/entities/user.routes.spec.ts"),
		).toBeUndefined();
		expect(
			project.getSourceFile("/out/entities/user.e2e.spec.ts"),
		).toBeUndefined();
	});

	it("should default to no tests if config is omitted", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();

		generator.generateEntityRoutes(project, "User", "/out/entities", undefined);

		// route file generated
		expect(project.getSourceFile("/out/entities/user.routes.ts")).toBeDefined();

		// test files omitted
		expect(
			project.getSourceFile("/out/entities/user.routes.spec.ts"),
		).toBeUndefined();
		expect(
			project.getSourceFile("/out/entities/user.e2e.spec.ts"),
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
		generator.generateMcpRoutes(project, parser, "/output");

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
		generator.generateMcpRoutes(project, parser, "/output2");
		const mcpFile = project.getSourceFile("/output2/mcp.routes.ts");
		const text = mcpFile?.getFullText();
		expect(text).toContain("name: 'api-mcp'");
		expect(text).toContain("version: '1.0.0'");
	});

	it("should fall back to defaults if parser spec is totally missing in generateMcpRoutes", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();
		const parser = {
			operations: [],
		};
		generator.generateMcpRoutes(project, parser as any, "/output3");
		const mcpFile = project.getSourceFile("/output3/mcp.routes.ts");
		expect(mcpFile?.getFullText()).toContain("name: 'api-mcp'");
	});
});
