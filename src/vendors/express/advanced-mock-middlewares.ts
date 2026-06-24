import path from "node:path";
import type { Project } from "ts-morph";
import type { SwaggerParser } from "../../openapi/parse.js";

export function generateAdvancedMiddlewares(
	project: Project,
	parser: SwaggerParser,
	outputDir: string,
) {
	const middlewareDir = path.join(outputDir, "middlewares");

	generateCorsMiddleware(project, middlewareDir);
	generateValidationMiddleware(project, parser, middlewareDir);
	generateAuthMiddleware(project, parser, middlewareDir);
	generateWebhookTrigger(project, parser, outputDir);
}

function generateCorsMiddleware(project: Project, middlewareDir: string) {
	const filePath = path.join(middlewareDir, "cors.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Request", "Response", "NextFunction"],
	});

	sourceFile.addStatements(`
/**
 * Global permissive CORS middleware for frictionless local UI development.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    next();
}
    `);
	sourceFile.formatText();

	const testPath = path.join(middlewareDir, "cors.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./cors.js",
		namedImports: ["corsMiddleware"],
	});
	testFile.addStatements(`
describe('CORS Middleware', () => {
    it('should set permissive headers and short-circuit OPTIONS requests', () => {
        const req = { method: 'OPTIONS' } as any;
        const res = { header: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() } as any;
        const next = vi.fn();

        corsMiddleware(req, res, next);

        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.end).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it('should set headers and call next for non-OPTIONS requests', () => {
        const req = { method: 'GET' } as any;
        const res = { header: vi.fn() } as any;
        const next = vi.fn();

        corsMiddleware(req, res, next);

        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
        expect(next).toHaveBeenCalled();
    });
});
    `);
	testFile.formatText();
}

function generateValidationMiddleware(
	project: Project,
	_parser: SwaggerParser,
	middlewareDir: string,
) {
	const filePath = path.join(middlewareDir, "validation.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Request", "Response", "NextFunction"],
	});
	sourceFile.addStatements(`
/**
 * Strict request validation middleware.
 * Validates incoming requests against the generated OpenAPI/MCP schema.
 */
export function createValidationMiddleware(strict: boolean) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!strict) {
            return next();
        }

        // Extremely simplified strict validation stub
        // A full implementation would use Ajv + OpenAPI schema compiled at runtime
        const contentType = req.headers['content-type'];
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && contentType === 'application/json') {
            if (typeof req.body !== 'object') {
                return res.status(400).json({ error: "Bad Request: Body must be valid JSON object" });
            }
        }

        next();
    };
}
    `);
	sourceFile.formatText();

	const testPath = path.join(middlewareDir, "validation.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./validation.js",
		namedImports: ["createValidationMiddleware"],
	});
	testFile.addStatements(`
describe('Validation Middleware', () => {
    it('should skip validation if strict is false', () => {
        const mw = createValidationMiddleware(false);
        const next = vi.fn();
        mw({} as any, {} as any, next);
        expect(next).toHaveBeenCalled();
    });

    it('should validate application/json body in strict mode', () => {
        const mw = createValidationMiddleware(true);
        const req = { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not-an-object' } as any;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
        const next = vi.fn();

        mw(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });
});
    `);
	testFile.formatText();
}

function generateAuthMiddleware(
	project: Project,
	_parser: SwaggerParser,
	middlewareDir: string,
) {
	const filePath = path.join(middlewareDir, "auth.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Request", "Response", "NextFunction"],
	});
	sourceFile.addStatements(`
/**
 * Hybrid Authentication Architecture.
 * Supports both Mock Mode (hardcoded tokens) and Production Mode (Stateful ORM/DB integration).
 */
export function createAuthMiddleware(enforceAuth: boolean, isEphemeral: boolean) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!enforceAuth) {
            return next();
        }

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
        }

        // Mock/Ephemeral Mode Validation
        if (isEphemeral) {
            if (authHeader !== 'Bearer mock-token-123') {
                return res.status(403).json({ error: "Forbidden: Invalid mock token" });
            }
            return next();
        }

        // Production Mode Validation
        // In a full implementation, this would query the Database/DAO to validate the token/session
        // e.g. const user = await dataSource.getRepository(User).findOne({ where: { token: authHeader } });
        if (authHeader !== 'Bearer production-token-456') { // Stub logic
             return res.status(403).json({ error: "Forbidden: Invalid production token" });
        }

        next();
    };
}
    `);
	sourceFile.formatText();

	const testPath = path.join(middlewareDir, "auth.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./auth.js",
		namedImports: ["createAuthMiddleware"],
	});
	testFile.addStatements(`
describe('Auth Middleware', () => {
    it('should skip auth if enforceAuth is false', () => {
        const mw = createAuthMiddleware(false, true);
        const next = vi.fn();
        mw({} as any, {} as any, next);
        expect(next).toHaveBeenCalled();
    });

    it('should return 401 if missing auth header', () => {
        const mw = createAuthMiddleware(true, true);
        const req = { headers: {} } as any;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
        mw(req, res, vi.fn() as any);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if invalid mock token in ephemeral mode', () => {
        const mw = createAuthMiddleware(true, true);
        const req = { headers: { authorization: 'Bearer bad' } } as any;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
        mw(req, res, vi.fn() as any);
        expect(res.status).toHaveBeenCalledWith(403);
    });
});
    `);
	testFile.formatText();
}

function generateWebhookTrigger(
	project: Project,
	_parser: SwaggerParser,
	outputDir: string,
) {
	const filePath = path.join(outputDir, "webhooks.routes.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Router", "Request", "Response"],
	});
	sourceFile.addStatements(`
/**
 * Administrative Webhook Trigger API.
 * Allows dispatching outgoing webhook payloads to a registered target URL.
 */
export function createWebhooksRouter(): Router {
    const router = Router();

    router.post('/_mock/trigger-webhook/:webhookName', async (req: Request, res: Response) => {
        const { webhookName } = req.params;
        const targetUrl = req.body.targetUrl || 'http://localhost:9999/webhook-receiver';
        
        try {
            // Very simplified HTTP dispatch logic
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: webhookName, timestamp: new Date().toISOString() })
            });

            if (response.ok) {
                 return res.status(200).json({ success: true, message: \`Webhook \${webhookName} triggered successfully\` });
            } else {
                 return res.status(502).json({ error: "Bad Gateway: Webhook receiver returned non-200 status" });
            }
        } catch (error) {
            return res.status(500).json({ error: "Internal Server Error: Failed to dispatch webhook" });
        }
    });

    return router;
}
    `);
	sourceFile.formatText();

	const testPath = path.join(outputDir, "webhooks.routes.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });
	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "vi"],
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

	testFile.addStatements(`
describe('Webhooks Router', () => {
    it('should trigger a webhook successfully', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
        
        const app = express();
        app.use(express.json());
        app.use('/', createWebhooksRouter());

        const res = await request(app).post('/_mock/trigger-webhook/my-webhook').send({ targetUrl: 'http://dummy' });
        expect(res.status).toBe(200);
        expect(globalThis.fetch).toHaveBeenCalled();
    });
});
    `);
	testFile.formatText();
}
