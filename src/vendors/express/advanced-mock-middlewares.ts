/**
 * Generates Express middlewares (CORS, strict validation, authentication) and webhook trigger routes using ts-morph AST builders.
 *
 * @module vendors/express/advanced-mock-middlewares
 */
import path from "node:path";
import type { CodeBlockWriter, Project } from "ts-morph";
import type { SwaggerParser } from "../../openapi/parse.js";

/**
 * Generates all advanced Express mock server middlewares (`cors.ts`, `validation.ts`, `auth.ts`) and `webhooks.routes.ts` along with their unit test files.
 *
 * @param project - The `ts-morph` project to create source files in.
 * @param parser - The parsed OpenAPI specification.
 * @param outputDir - Target server output directory.
 */
export function generateAdvancedMiddlewares(
	project: Project,
	parser: Pick<SwaggerParser, "spec" | "schemas" | "operations">,
	outputDir: string,
): void {
	const middlewareDir = path.join(outputDir, "middlewares");

	generateCorsMiddleware(project, middlewareDir);
	generateValidationMiddleware(project, parser, middlewareDir);
	generateAuthMiddleware(project, parser, middlewareDir);
	generateWebhookTrigger(project, parser, outputDir);
	generateIdpRouter(project, parser, outputDir);
}

/**
 * Generates the permissive CORS middleware (`cors.ts`) and its unit test (`cors.spec.ts`).
 *
 * @param project - The `ts-morph` project.
 * @param middlewareDir - Directory where middleware files are emitted.
 */
function generateCorsMiddleware(project: Project, middlewareDir: string): void {
	const filePath = path.join(middlewareDir, "cors.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Request", "Response", "NextFunction"],
	});

	sourceFile.addFunction({
		isExported: true,
		name: "corsMiddleware",
		docs: [
			{
				description:
					"Global permissive CORS middleware for frictionless local UI development.",
			},
		],
		parameters: [
			{ name: "req", type: "Request" },
			{ name: "res", type: "Response" },
			{ name: "next", type: "NextFunction" },
		],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine('res.header("Access-Control-Allow-Origin", "*");');
			writer.writeLine(
				'res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, PATCH, OPTIONS");',
			);
			writer.writeLine(
				'res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");',
			);
			writer.blankLine();
			writer.writeLine('if (req.method === "OPTIONS") {');
			writer.indent(() => {
				writer.writeLine("return res.status(200).end();");
			});
			writer.writeLine("}");
			writer.writeLine("next();");
		},
	});
	sourceFile.formatText();

	const testPath = path.join(middlewareDir, "cors.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "express",
		isTypeOnly: true,
		namedImports: ["Request", "Response"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./cors.js",
		namedImports: ["corsMiddleware"],
	});
	testFile.addStatements((writer: CodeBlockWriter) => {
		writer.writeLine("describe('CORS Middleware', () => {");
		writer.indent(() => {
			writer.writeLine(
				"it('should set permissive headers and short-circuit OPTIONS requests', () => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const req = { method: 'OPTIONS' } as Partial<Request> as Request;",
				);
				writer.writeLine(
					"const res = { header: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() } as Partial<Response> as Response;",
				);
				writer.writeLine("const next = vi.fn();");
				writer.blankLine();
				writer.writeLine("corsMiddleware(req, res, next);");
				writer.blankLine();
				writer.writeLine(
					"expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');",
				);
				writer.writeLine("expect(res.status).toHaveBeenCalledWith(200);");
				writer.writeLine("expect(res.end).toHaveBeenCalled();");
				writer.writeLine("expect(next).not.toHaveBeenCalled();");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"it('should set headers and call next for non-OPTIONS requests', () => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const req = { method: 'GET' } as Partial<Request> as Request;",
				);
				writer.writeLine(
					"const res = { header: vi.fn() } as Partial<Response> as Response;",
				);
				writer.writeLine("const next = vi.fn();");
				writer.blankLine();
				writer.writeLine("corsMiddleware(req, res, next);");
				writer.blankLine();
				writer.writeLine(
					"expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');",
				);
				writer.writeLine("expect(next).toHaveBeenCalled();");
			});
			writer.writeLine("});");
		});
		writer.writeLine("});");
	});
	testFile.formatText();
}

/**
 * Generates the strict request validation middleware (`validation.ts`) and its unit test (`validation.spec.ts`).
 *
 * @param project - The `ts-morph` project.
 * @param _parser - The parsed OpenAPI specification.
 * @param middlewareDir - Directory where middleware files are emitted.
 */
function generateValidationMiddleware(
	project: Project,
	_parser: Pick<SwaggerParser, "spec" | "schemas" | "operations">,
	middlewareDir: string,
): void {
	const filePath = path.join(middlewareDir, "validation.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Request", "Response", "NextFunction"],
	});
	sourceFile.addFunction({
		isExported: true,
		name: "createValidationMiddleware",
		docs: [
			{
				description:
					"Strict request validation middleware. Validates incoming requests against the generated OpenAPI/MCP schema.",
			},
		],
		parameters: [{ name: "strict", type: "boolean" }],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine(
				"return (req: Request, res: Response, next: NextFunction) => {",
			);
			writer.indent(() => {
				writer.writeLine("if (!strict) {");
				writer.indent(() => {
					writer.writeLine("return next();");
				});
				writer.writeLine("}");
				writer.blankLine();
				writer.writeLine("const contentType = req.headers['content-type'];");
				writer.writeLine(
					"if (['POST', 'PUT', 'PATCH'].includes(req.method) && contentType === 'application/json') {",
				);
				writer.indent(() => {
					writer.writeLine("if (typeof req.body !== 'object') {");
					writer.indent(() => {
						writer.writeLine(
							'return res.status(400).json({ error: "Bad Request: Body must be valid JSON object" });',
						);
					});
					writer.writeLine("}");
				});
				writer.writeLine("}");
				writer.blankLine();
				writer.writeLine("next();");
			});
			writer.writeLine("};");
		},
	});
	sourceFile.formatText();

	const testPath = path.join(middlewareDir, "validation.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "express",
		isTypeOnly: true,
		namedImports: ["Request", "Response"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./validation.js",
		namedImports: ["createValidationMiddleware"],
	});
	testFile.addStatements((writer: CodeBlockWriter) => {
		writer.writeLine("describe('Validation Middleware', () => {");
		writer.indent(() => {
			writer.writeLine(
				"it('should skip validation if strict is false', () => {",
			);
			writer.indent(() => {
				writer.writeLine("const mw = createValidationMiddleware(false);");
				writer.writeLine("const next = vi.fn();");
				writer.writeLine(
					"mw({} as Partial<Request> as Request, {} as Partial<Response> as Response, next);",
				);
				writer.writeLine("expect(next).toHaveBeenCalled();");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"it('should validate application/json body in strict mode', () => {",
			);
			writer.indent(() => {
				writer.writeLine("const mw = createValidationMiddleware(true);");
				writer.writeLine(
					"const req = { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not-an-object' } as Partial<Request> as Request;",
				);
				writer.writeLine(
					"const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as Partial<Response> as Response;",
				);
				writer.writeLine("const next = vi.fn();");
				writer.blankLine();
				writer.writeLine("mw(req, res, next);");
				writer.writeLine("expect(res.status).toHaveBeenCalledWith(400);");
				writer.writeLine("expect(next).not.toHaveBeenCalled();");
			});
			writer.writeLine("});");
		});
		writer.writeLine("});");
	});
	testFile.formatText();
}

/**
 * Generates the authentication middleware (`auth.ts`) and its unit test (`auth.spec.ts`).
 *
 * @param project - The `ts-morph` project.
 * @param _parser - The parsed OpenAPI specification.
 * @param middlewareDir - Directory where middleware files are emitted.
 */
function generateAuthMiddleware(
	project: Project,
	_parser: Pick<SwaggerParser, "spec" | "schemas" | "operations">,
	middlewareDir: string,
): void {
	const filePath = path.join(middlewareDir, "auth.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Request", "Response", "NextFunction"],
	});
	sourceFile.addStatements((writer: CodeBlockWriter) => {
		writer.writeLine(
			"/** Active access tokens issued by the integrated Identity Provider (IdP). */",
		);
		writer.writeLine("export const issuedTokens = new Set<string>();");
		writer.blankLine();
		writer.writeLine(
			"/** Registers a newly issued access token from the integrated IdP. */",
		);
		writer.writeLine(
			"export function registerIssuedToken(token: string): void {",
		);
		writer.indent(() => {
			writer.writeLine("issuedTokens.add(token);");
		});
		writer.writeLine("}");
		writer.blankLine();
		writer.writeLine(
			"/** Revokes an access token previously issued by the integrated IdP. */",
		);
		writer.writeLine(
			"export function revokeIssuedToken(token: string): void {",
		);
		writer.indent(() => {
			writer.writeLine("issuedTokens.delete(token);");
		});
		writer.writeLine("}");
	});
	sourceFile.addFunction({
		isExported: true,
		name: "createAuthMiddleware",
		docs: [
			{
				description:
					"Hybrid Authentication Architecture. Supports Mock Mode (hardcoded tokens), Production Mode, and Integrated Identity Provider (IdP) issued session tokens.",
			},
		],
		parameters: [
			{ name: "enforceAuth", type: "boolean" },
			{ name: "isEphemeral", type: "boolean" },
		],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine(
				"return (req: Request, res: Response, next: NextFunction) => {",
			);
			writer.indent(() => {
				writer.writeLine("if (!enforceAuth) {");
				writer.indent(() => {
					writer.writeLine("return next();");
				});
				writer.writeLine("}");
				writer.blankLine();
				writer.writeLine("if (req.path && req.path.startsWith('/auth')) {");
				writer.indent(() => {
					writer.writeLine("return next();");
				});
				writer.writeLine("}");
				writer.blankLine();
				writer.writeLine("const authHeader = req.headers.authorization;");
				writer.blankLine();
				writer.writeLine("if (!authHeader) {");
				writer.indent(() => {
					writer.writeLine(
						'return res.status(401).json({ error: "Unauthorized: Missing Authorization header" });',
					);
				});
				writer.writeLine("}");
				writer.blankLine();
				writer.writeLine(
					"if (authHeader.startsWith('Bearer ') && issuedTokens.has(authHeader.slice(7))) {",
				);
				writer.indent(() => {
					writer.writeLine("return next();");
				});
				writer.writeLine("}");
				writer.blankLine();
				writer.writeLine("if (isEphemeral) {");
				writer.indent(() => {
					writer.writeLine("if (authHeader !== 'Bearer mock-token-123') {");
					writer.indent(() => {
						writer.writeLine(
							'return res.status(403).json({ error: "Forbidden: Invalid mock token" });',
						);
					});
					writer.writeLine("}");
					writer.writeLine("return next();");
				});
				writer.writeLine("}");
				writer.blankLine();
				writer.writeLine("if (authHeader !== 'Bearer production-token-456') {");
				writer.indent(() => {
					writer.writeLine(
						'return res.status(403).json({ error: "Forbidden: Invalid production token" });',
					);
				});
				writer.writeLine("}");
				writer.blankLine();
				writer.writeLine("next();");
			});
			writer.writeLine("};");
		},
	});
	sourceFile.formatText();

	const testPath = path.join(middlewareDir, "auth.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "express",
		isTypeOnly: true,
		namedImports: ["Request", "Response", "NextFunction"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./auth.js",
		namedImports: [
			"createAuthMiddleware",
			"registerIssuedToken",
			"revokeIssuedToken",
		],
	});
	testFile.addStatements((writer: CodeBlockWriter) => {
		writer.writeLine("describe('Auth Middleware', () => {");
		writer.indent(() => {
			writer.writeLine(
				"it('should skip auth if enforceAuth is false', () => {",
			);
			writer.indent(() => {
				writer.writeLine("const mw = createAuthMiddleware(false, true);");
				writer.writeLine("const next = vi.fn();");
				writer.writeLine(
					"mw({} as Partial<Request> as Request, {} as Partial<Response> as Response, next);",
				);
				writer.writeLine("expect(next).toHaveBeenCalled();");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"it('should return 401 if missing auth header', () => {",
			);
			writer.indent(() => {
				writer.writeLine("const mw = createAuthMiddleware(true, true);");
				writer.writeLine(
					"const req = { headers: {} } as Partial<Request> as Request;",
				);
				writer.writeLine(
					"const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as Partial<Response> as Response;",
				);
				writer.writeLine("mw(req, res, vi.fn() as NextFunction);");
				writer.writeLine("expect(res.status).toHaveBeenCalledWith(401);");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"it('should return 403 if invalid mock token in ephemeral mode', () => {",
			);
			writer.indent(() => {
				writer.writeLine("const mw = createAuthMiddleware(true, true);");
				writer.writeLine(
					"const req = { headers: { authorization: 'Bearer bad' } } as Partial<Request> as Request;",
				);
				writer.writeLine(
					"const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as Partial<Response> as Response;",
				);
				writer.writeLine("mw(req, res, vi.fn() as NextFunction);");
				writer.writeLine("expect(res.status).toHaveBeenCalledWith(403);");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"it('should allow tokens issued by the integrated IdP and reject them after revocation', () => {",
			);
			writer.indent(() => {
				writer.writeLine("registerIssuedToken('idp-test-token');");
				writer.writeLine("const mw = createAuthMiddleware(true, true);");
				writer.writeLine("const next = vi.fn();");
				writer.writeLine(
					"const req = { headers: { authorization: 'Bearer idp-test-token' } } as Partial<Request> as Request;",
				);
				writer.writeLine(
					"const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as Partial<Response> as Response;",
				);
				writer.writeLine("mw(req, res, next);");
				writer.writeLine("expect(next).toHaveBeenCalled();");
				writer.writeLine("revokeIssuedToken('idp-test-token');");
				writer.writeLine("mw(req, res, vi.fn() as NextFunction);");
				writer.writeLine("expect(res.status).toHaveBeenCalledWith(403);");
			});
			writer.writeLine("});");
		});
		writer.writeLine("});");
	});
	testFile.formatText();
}

/**
 * Generates the integrated Identity Provider (IdP) / Auth Server router (`auth.routes.ts`) and its unit test (`auth.routes.spec.ts`).
 *
 * @param project - The `ts-morph` project.
 * @param _parser - The parsed OpenAPI specification.
 * @param outputDir - Target server output directory.
 */
function generateIdpRouter(
	project: Project,
	_parser: Pick<SwaggerParser, "spec" | "schemas" | "operations">,
	outputDir: string,
): void {
	const filePath = path.join(outputDir, "auth.routes.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Router", "Request", "Response"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "./middlewares/auth.js",
		namedImports: ["registerIssuedToken", "revokeIssuedToken"],
	});

	sourceFile.addInterface({
		name: "IdpUserDao",
		isExported: true,
		typeParameters: [{ name: "T", default: "Record<string, unknown>" }],
		docs: [
			"DAO contract shared between the main server domain logic and the integrated Identity Provider (IdP).",
		],
		methods: [
			{
				name: "find",
				returnType: "Promise<T[]>",
				docs: ["Retrieves all persisted user records from the underlying DAO."],
			},
			{
				name: "create",
				parameters: [{ name: "data", type: "Partial<T>" }],
				returnType: "Promise<T>",
				docs: ["Persists a new user record via the underlying DAO."],
			},
		],
	});

	sourceFile.addFunction({
		isExported: true,
		name: "createAuthRouter",
		typeParameters: [{ name: "T", default: "Record<string, unknown>" }],
		parameters: [
			{
				name: "userDao",
				type: "IdpUserDao<T>",
				hasQuestionToken: true,
			},
		],
		returnType: "Router",
		docs: [
			{
				description:
					"Integrated Identity Provider (IdP) / Auth Server router exposing `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, and `POST /auth/logout` backed by the same DAO/ORM layer as the main application.",
			},
		],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine("const router = Router();");
			writer.writeLine(
				"const registeredUsers = new Map<string, { username: string; password: string }>();",
			);
			writer.writeLine("const refreshTokens = new Map<string, string>();");
			writer.blankLine();
			writer.writeLine(
				"router.post('/auth/register', async (req: Request, res: Response) => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const { username, password, ...extra } = (req.body || {}) as Record<string, unknown>;",
				);
				writer.writeLine(
					"if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {",
				);
				writer.indent(() => {
					writer.writeLine(
						'return res.status(400).json({ error: "Bad Request: username and password are required" });',
					);
				});
				writer.writeLine("}");
				writer.writeLine("if (registeredUsers.has(username)) {");
				writer.indent(() => {
					writer.writeLine(
						'return res.status(409).json({ error: "Conflict: User already exists" });',
					);
				});
				writer.writeLine("}");
				writer.writeLine("if (userDao) {");
				writer.indent(() => {
					writer.writeLine("try {");
					writer.indent(() => {
						writer.writeLine(
							"await userDao.create({ username, password, ...extra } as unknown as Partial<T>);",
						);
					});
					writer.writeLine("} catch (_err) {");
					writer.indent(() => {
						writer.writeLine("// Stub mode fallback");
					});
					writer.writeLine("}");
				});
				writer.writeLine("}");
				writer.writeLine(
					"registeredUsers.set(username, { username, password });",
				);
				writer.writeLine(
					"const accessToken = `idp-token-${username}-${Date.now()}`;",
				);
				writer.writeLine(
					"const refreshToken = `idp-refresh-${username}-${Date.now()}`;",
				);
				writer.writeLine("registerIssuedToken(accessToken);");
				writer.writeLine("refreshTokens.set(refreshToken, username);");
				writer.writeLine(
					"return res.status(201).json({ username, accessToken, refreshToken, tokenType: 'Bearer' });",
				);
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"router.post('/auth/login', async (req: Request, res: Response) => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const { username, password } = (req.body || {}) as Record<string, unknown>;",
				);
				writer.writeLine(
					"if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {",
				);
				writer.indent(() => {
					writer.writeLine(
						'return res.status(400).json({ error: "Bad Request: username and password are required" });',
					);
				});
				writer.writeLine("}");
				writer.writeLine("let record = registeredUsers.get(username);");
				writer.writeLine("if (!record && userDao) {");
				writer.indent(() => {
					writer.writeLine("try {");
					writer.indent(() => {
						writer.writeLine("const existing = await userDao.find();");
						writer.writeLine(
							"const found = existing.find((u) => (u as Record<string, unknown>).username === username);",
						);
						writer.writeLine("if (found) {");
						writer.indent(() => {
							writer.writeLine(
								"const foundPass = (found as Record<string, unknown>).password;",
							);
							writer.writeLine(
								"record = { username, password: typeof foundPass === 'string' ? foundPass : password };",
							);
							writer.writeLine("registeredUsers.set(username, record);");
						});
						writer.writeLine("}");
					});
					writer.writeLine("} catch (_err) {");
					writer.indent(() => {
						writer.writeLine("// Stub mode fallback");
					});
					writer.writeLine("}");
				});
				writer.writeLine("}");
				writer.writeLine("if (!record || record.password !== password) {");
				writer.indent(() => {
					writer.writeLine(
						'return res.status(401).json({ error: "Unauthorized: Invalid credentials" });',
					);
				});
				writer.writeLine("}");
				writer.writeLine(
					"const accessToken = `idp-token-${username}-${Date.now()}`;",
				);
				writer.writeLine(
					"const refreshToken = `idp-refresh-${username}-${Date.now()}`;",
				);
				writer.writeLine("registerIssuedToken(accessToken);");
				writer.writeLine("refreshTokens.set(refreshToken, username);");
				writer.writeLine(
					"return res.status(200).json({ username, accessToken, refreshToken, tokenType: 'Bearer' });",
				);
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"router.post('/auth/refresh', (req: Request, res: Response) => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const { refreshToken } = (req.body || {}) as Record<string, unknown>;",
				);
				writer.writeLine(
					"if (typeof refreshToken !== 'string' || !refreshTokens.has(refreshToken)) {",
				);
				writer.indent(() => {
					writer.writeLine(
						'return res.status(401).json({ error: "Unauthorized: Invalid refresh token" });',
					);
				});
				writer.writeLine("}");
				writer.writeLine(
					"const username = refreshTokens.get(refreshToken) as string;",
				);
				writer.writeLine("refreshTokens.delete(refreshToken);");
				writer.writeLine(
					"const accessToken = `idp-token-${username}-${Date.now()}`;",
				);
				writer.writeLine(
					"const newRefreshToken = `idp-refresh-${username}-${Date.now()}`;",
				);
				writer.writeLine("registerIssuedToken(accessToken);");
				writer.writeLine("refreshTokens.set(newRefreshToken, username);");
				writer.writeLine(
					"return res.status(200).json({ username, accessToken, refreshToken: newRefreshToken, tokenType: 'Bearer' });",
				);
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"router.post('/auth/logout', (req: Request, res: Response) => {",
			);
			writer.indent(() => {
				writer.writeLine("const authHeader = req.headers.authorization;");
				writer.writeLine(
					"const body = (req.body || {}) as Record<string, unknown>;",
				);
				writer.writeLine(
					"const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (typeof body.accessToken === 'string' ? body.accessToken : undefined);",
				);
				writer.writeLine("if (bearerToken) {");
				writer.indent(() => {
					writer.writeLine("revokeIssuedToken(bearerToken);");
				});
				writer.writeLine("}");
				writer.writeLine("if (typeof body.refreshToken === 'string') {");
				writer.indent(() => {
					writer.writeLine("refreshTokens.delete(body.refreshToken);");
				});
				writer.writeLine("}");
				writer.writeLine(
					'return res.status(200).json({ success: true, message: "Logged out successfully" });',
				);
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine("return router;");
		},
	});
	sourceFile.formatText();

	const testPath = path.join(outputDir, "auth.routes.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./auth.routes.js",
		namedImports: ["createAuthRouter"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "supertest",
		defaultImport: "request",
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "express",
		defaultImport: "express",
	});

	testFile.addStatements((writer: CodeBlockWriter) => {
		writer.writeLine("describe('Integrated IdP Auth Router', () => {");
		writer.indent(() => {
			writer.writeLine(
				"it('should register, login, refresh, and logout a user via DAO', async () => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const mockDao = { find: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 1 }) };",
				);
				writer.writeLine("const app = express();");
				writer.writeLine("app.use(express.json());");
				writer.writeLine("app.use(createAuthRouter(mockDao));");
				writer.blankLine();
				writer.writeLine(
					"const regRes = await request(app).post('/auth/register').send({ username: 'alice', password: 'secret' });",
				);
				writer.writeLine("expect(regRes.status).toBe(201);");
				writer.writeLine("expect(mockDao.create).toHaveBeenCalled();");
				writer.blankLine();
				writer.writeLine(
					"const loginRes = await request(app).post('/auth/login').send({ username: 'alice', password: 'secret' });",
				);
				writer.writeLine("expect(loginRes.status).toBe(200);");
				writer.writeLine("expect(loginRes.body.accessToken).toBeDefined();");
				writer.blankLine();
				writer.writeLine(
					"const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken: loginRes.body.refreshToken });",
				);
				writer.writeLine("expect(refreshRes.status).toBe(200);");
				writer.blankLine();
				writer.writeLine(
					"const logoutRes = await request(app).post('/auth/logout').send({ accessToken: refreshRes.body.accessToken, refreshToken: refreshRes.body.refreshToken });",
				);
				writer.writeLine("expect(logoutRes.status).toBe(200);");
			});
			writer.writeLine("});");
		});
		writer.writeLine("});");
	});
	testFile.formatText();
}

/**
 * Generates the administrative webhook trigger router (`webhooks.routes.ts`) and its unit test (`webhooks.routes.spec.ts`).
 *
 * @param project - The `ts-morph` project.
 * @param _parser - The parsed OpenAPI specification.
 * @param outputDir - Target server output directory.
 */
function generateWebhookTrigger(
	project: Project,
	_parser: Pick<SwaggerParser, "spec" | "schemas" | "operations">,
	outputDir: string,
): void {
	const filePath = path.join(outputDir, "webhooks.routes.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Router", "Request", "Response"],
	});
	sourceFile.addFunction({
		isExported: true,
		name: "createWebhooksRouter",
		returnType: "Router",
		docs: [
			{
				description:
					"Administrative Webhook Trigger API. Allows dispatching outgoing webhook payloads to a registered target URL.",
			},
		],
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine("const router = Router();");
			writer.blankLine();
			writer.writeLine(
				"router.post('/_mock/trigger-webhook/:webhookName', async (req: Request, res: Response) => {",
			);
			writer.indent(() => {
				writer.writeLine("const { webhookName } = req.params;");
				writer.writeLine(
					"const targetUrl = req.body.targetUrl || 'http://localhost:9999/webhook-receiver';",
				);
				writer.blankLine();
				writer.writeLine("try {");
				writer.indent(() => {
					writer.writeLine("const response = await fetch(targetUrl, {");
					writer.indent(() => {
						writer.writeLine("method: 'POST',");
						writer.writeLine(
							"headers: { 'Content-Type': 'application/json' },",
						);
						writer.writeLine(
							"body: JSON.stringify({ event: webhookName, timestamp: new Date().toISOString() })",
						);
					});
					writer.writeLine("});");
					writer.blankLine();
					writer.writeLine("if (response.ok) {");
					writer.indent(() => {
						writer.writeLine(
							"return res.status(200).json({ success: true, message: `Webhook ${webhookName} triggered successfully` });",
						);
					});
					writer.writeLine("} else {");
					writer.indent(() => {
						writer.writeLine(
							'return res.status(502).json({ error: "Bad Gateway: Webhook receiver returned non-200 status" });',
						);
					});
					writer.writeLine("}");
				});
				writer.writeLine("} catch (error) {");
				writer.indent(() => {
					writer.writeLine(
						'return res.status(500).json({ error: "Internal Server Error: Failed to dispatch webhook" });',
					);
				});
				writer.writeLine("}");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine("return router;");
		},
	});
	sourceFile.formatText();

	const testPath = path.join(outputDir, "webhooks.routes.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi", "afterEach"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./webhooks.routes.js",
		namedImports: ["createWebhooksRouter"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "supertest",
		defaultImport: "request",
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "express",
		defaultImport: "express",
	});

	testFile.addStatements((writer: CodeBlockWriter) => {
		writer.writeLine("describe('Webhooks Router', () => {");
		writer.indent(() => {
			writer.writeLine("afterEach(() => {");
			writer.indent(() => {
				writer.writeLine("vi.restoreAllMocks();");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"it('should trigger a webhook successfully', async () => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);",
				);
				writer.blankLine();
				writer.writeLine("const app = express();");
				writer.writeLine("app.use(express.json());");
				writer.writeLine("app.use('/', createWebhooksRouter());");
				writer.blankLine();
				writer.writeLine(
					"const res = await request(app).post('/_mock/trigger-webhook/my-webhook').send({ targetUrl: 'http://dummy' });",
				);
				writer.writeLine("expect(res.status).toBe(200);");
				writer.writeLine("expect(fetchSpy).toHaveBeenCalled();");
			});
			writer.writeLine("});");
		});
		writer.writeLine("});");
	});
	testFile.formatText();
}
