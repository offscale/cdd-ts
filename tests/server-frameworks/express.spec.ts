import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { Project, ts } from "ts-morph";
import { describe, expect, it, vi } from "vitest";
import { IdpAuthHelperGenerator } from "../../src/openapi/emit_idp_auth.js";
import { ExpressServerGenerator } from "../../src/vendors/express/express-server.generator.js";
import {
	createTestConfig,
	createTestSpec,
	expectZeroTypeScriptDiagnostics,
} from "../shared/helpers.js";

describe("ExpressServerGenerator", () => {
	it("should generate routes, route tests, and E2E tests for TypeORM configuration", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();

		generator.generateEntityRoutes(
			project,
			"User",
			"/out/routes",
			"typeorm",
			createTestConfig({
				options: { tests: true },
			}),
		);

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

		const typeormMockFile = project.getSourceFileOrThrow(
			"/out/mocks/user.mock.ts",
		);
		expect(typeormMockFile.getFullText()).toContain(
			'import { User } from "../entities/user.entity.js";',
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
							status: { type: "string", enum: ["active", "pending"] },
							isActive: { type: "boolean" },
							tags: { type: "array" },
							metadata: { type: "object" },
							skippedProp: true,
						},
					},
				},
			],
		};

		generator.generateEntityRoutes(
			project,
			"User",
			"/out/routes",
			undefined,
			createTestConfig({
				options: { tests: true },
			}),
			mockParser,
		);

		// Check mock file generation
		const mockFile = project.getSourceFileOrThrow("/out/mocks/user.mock.ts");
		const mockText = mockFile.getFullText();
		expect(mockText).toContain("name: faker.person.firstName(),");
		expect(mockText).toContain("email: faker.internet.email(),");
		expect(mockText).toContain("age: faker.number.int({ min: 1, max: 1000 }),");
		expect(mockText).toContain("createdAt: faker.date.past().toISOString(),");
		expect(mockText).toContain(
			'status: faker.helpers.arrayElement(["active", "pending"] as const),',
		);
		expect(mockText).toContain("isActive: faker.datatype.boolean(),");
		expect(mockText).toContain("tags: [],");
		expect(mockText).toContain("metadata: {},");

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
		const config = { options: { tests: false } };

		generator.generateEntityRoutes(
			project,
			"User",
			"/out/routes",
			undefined,
			createTestConfig(config),
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
					method: "GET",
					summary: "A test operation",
					parameters: [
						{
							name: "param1",
							in: "query",
							required: true,
							description: "first param",
						},
						{ name: "param2", in: "query", required: false },
						{
							name: "",
							in: "query",
						},
					],
					requestBody: { content: {} },
				},
				{
					// No tags, no operationId, no parameters, no body
					path: "/fallback",
					method: "GET",
				},
				{
					// Tag
					tags: ["ObjTag"],
					path: "/obj",
					method: "GET",
				},
				{
					// Capital start letter
					operationId: "TestCapital",
					path: "/cap",
					method: "GET",
				},
				{
					// Empty tag fallback
					tags: [""],
					path: "/objnoname",
					method: "GET",
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
			spec: createTestSpec({ info: {} }),
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
			operations: [
				{
					operationId: "getSomeData",
					path: "/some-data",
					method: "GET",
				},
			],
		};
		generator.generateMcpRoutes(
			project,
			parser,
			"/output3",
			createTestConfig({
				options: { generateServices: true },
			}),
		);
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
		};
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
		expect(entrypointFile.getFullText()).toContain(
			'.option("--start-auth-server",',
		);
		expect(entrypointFile.getFullText()).toContain(
			"app.use(createAuthRouter(factory.getUserDao(isEphemeral, dataSource)));",
		);
		expectZeroTypeScriptDiagnostics(project);
	});

	it("should generate the server entrypoint with empty schemas", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new ExpressServerGenerator();
		generator.generateServerEntrypoint(project, [], "/out3");
		const entrypointFile = project.getSourceFileOrThrow("/out3/server.ts");
		expect(entrypointFile.getFullText()).toContain(
			"app.use(createAuthRouter());",
		);
		expectZeroTypeScriptDiagnostics(project);
	});

	it("should execute full E2E lifecycle: register via Auth Server, exchange credentials for token, and access protected main API resource", async () => {
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
		};
		generator.generateServerEntrypoint(
			project,
			["User"],
			"/idp-e2e",
			dummyParser,
		);
		new IdpAuthHelperGenerator(project).generate("/idp-sdk");

		const authMwCode = project
			.getSourceFileOrThrow("/idp-e2e/middlewares/auth.ts")
			.getFullText();
		const authRoutesCode = project
			.getSourceFileOrThrow("/idp-e2e/auth.routes.ts")
			.getFullText();
		const sdkAuthCode = project
			.getSourceFileOrThrow("/idp-sdk/utils/auth-session.ts")
			.getFullText();

		const transpile = (code: string): string =>
			ts.transpileModule(code, {
				compilerOptions: {
					module: ts.ModuleKind.CommonJS,
					target: ts.ScriptTarget.ES2022,
				},
			}).outputText;

		interface MockReq {
			method: string;
			path: string;
			headers: Record<string, string | undefined>;
			body: Record<string, unknown>;
		}
		interface MockRes {
			statusCode: number;
			payload: unknown;
			status(code: number): MockRes;
			json(data: unknown): MockRes;
		}
		type MockNext = () => void;
		type MockHandler = (
			req: MockReq,
			res: MockRes,
			next: MockNext,
		) => unknown | Promise<unknown>;

		const postRoutes = new Map<string, MockHandler>();
		const expressShim = {
			Router: () => ({
				post: (routePath: string, handler: MockHandler) => {
					postRoutes.set(routePath, handler);
				},
			}),
		};

		const authMwExports: Record<string, unknown> = {};
		new Function("exports", "require", transpile(authMwCode))(
			authMwExports,
			() => expressShim,
		);

		const authRoutesExports: Record<string, unknown> = {};
		new Function("exports", "require", transpile(authRoutesCode))(
			authRoutesExports,
			(id: string) =>
				id === "./middlewares/auth.js" ? authMwExports : expressShim,
		);

		const sdkAuthExports: Record<string, unknown> = {};
		new Function("exports", transpile(sdkAuthCode))(sdkAuthExports);

		const createAuthMiddleware = authMwExports.createAuthMiddleware as (
			enforceAuth: boolean,
			isEphemeral: boolean,
		) => MockHandler;
		const createAuthRouter = authRoutesExports.createAuthRouter as (userDao?: {
			find(): Promise<Array<Record<string, unknown>>>;
			create(data: Record<string, unknown>): Promise<Record<string, unknown>>;
		}) => unknown;
		const SdkAuthClient = sdkAuthExports.SdkAuthClient as new (
			basePath?: string,
		) => {
			register(
				username: string,
				password: string,
			): Promise<{ accessToken: string; refreshToken?: string }>;
			login(
				username: string,
				password: string,
			): Promise<{ accessToken: string; refreshToken?: string }>;
			refresh(
				refreshToken?: string,
			): Promise<{ accessToken: string; refreshToken?: string }>;
			logout(): Promise<void>;
			getAuthorizationHeader(): Record<string, string>;
		};

		const persistedUsers: Array<Record<string, unknown>> = [];
		const userDao = {
			find: vi.fn(async () => persistedUsers),
			create: vi.fn(async (data: Record<string, unknown>) => {
				const created = { id: persistedUsers.length + 1, ...data };
				persistedUsers.push(created);
				return created;
			}),
		};

		const authMiddleware = createAuthMiddleware(true, true);
		createAuthRouter(userDao);

		const server = http.createServer((req, res) => {
			const chunks: Buffer[] = [];
			req.on("data", (chunk: Buffer) => chunks.push(chunk));
			req.on("end", async () => {
				const raw = Buffer.concat(chunks).toString("utf-8");
				const parsedBody = raw
					? (JSON.parse(raw) as Record<string, unknown>)
					: {};
				const mockReq: MockReq = {
					method: req.method ?? "GET",
					path: req.url ?? "/",
					headers: {
						authorization:
							typeof req.headers.authorization === "string"
								? req.headers.authorization
								: undefined,
					},
					body: parsedBody,
				};
				const mockRes: MockRes = {
					statusCode: 200,
					payload: undefined,
					status(code: number) {
						this.statusCode = code;
						return this;
					},
					json(data: unknown) {
						this.payload = data;
						res.writeHead(this.statusCode, {
							"Content-Type": "application/json",
						});
						res.end(JSON.stringify(data));
						return this;
					},
				};

				let passedAuth = false;
				authMiddleware(mockReq, mockRes, () => {
					passedAuth = true;
				});
				if (!passedAuth) {
					return;
				}
				const postHandler = postRoutes.get(mockReq.path);
				if (mockReq.method === "POST" && postHandler) {
					await postHandler(mockReq, mockRes, vi.fn());
					return;
				}
				if (mockReq.method === "GET" && mockReq.path === "/users/me") {
					mockRes.status(200).json({ ok: true, count: persistedUsers.length });
				}
			});
		});
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		const port = (server.address() as AddressInfo).port;
		const baseUrl = `http://127.0.0.1:${port}`;

		try {
			// 1. Unauthenticated request to protected resource is rejected with 401
			const unauthRes = await fetch(`${baseUrl}/users/me`);
			expect(unauthRes.status).toBe(401);

			// 2. Register a new user via the integrated Auth Server using SDK helper
			const sdkAuth = new SdkAuthClient(baseUrl);
			const regSession = await sdkAuth.register("lifecycle_user", "s3cr3t");
			expect(regSession.accessToken).toContain("idp-token-lifecycle_user");
			expect(userDao.create).toHaveBeenCalledTimes(1);

			// 3. Exchange credentials for a token via login
			const loginSession = await sdkAuth.login("lifecycle_user", "s3cr3t");
			expect(loginSession.accessToken).toBeDefined();

			// 4. Access protected resource on the main API using the SDK's attached Bearer token
			const authedRes = await fetch(`${baseUrl}/users/me`, {
				headers: sdkAuth.getAuthorizationHeader(),
			});
			expect(authedRes.status).toBe(200);
			const body = (await authedRes.json()) as { ok: boolean; count: number };
			expect(body).toEqual({ ok: true, count: 1 });

			// 5. Refresh token and logout
			const refreshed = await sdkAuth.refresh();
			expect(refreshed.accessToken).toBeDefined();
			await sdkAuth.logout();
			expect(sdkAuth.getAuthorizationHeader()).toEqual({});

			// 6. Revoked token is rejected with 403
			const revokedRes = await fetch(`${baseUrl}/users/me`, {
				headers: { Authorization: `Bearer ${refreshed.accessToken}` },
			});
			expect(revokedRes.status).toBe(403);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});
});
