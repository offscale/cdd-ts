/**
 * Module for tests in vendors/typeorm/tests.
 *
 * @module vendors/typeorm/tests
 */
import path from "node:path";
import type { Project } from "ts-morph";
import type { SwaggerDefinition } from "../../core/types/openapi.js";

/**
 * Executes `generateIntegrationTests`.
 * @param project - Target `ts-morph` project instance.
 * @param schemas - Parameter `schemas` ({ name: string; definition: SwaggerDefinition }[]).
 * @param outputDir - Target output directory path.
 */
export function generateIntegrationTests(
	project: Project,
	schemas: { name: string; definition: SwaggerDefinition }[],
	outputDir: string,
) {
	const testDir = path.join(outputDir, "tests");
	const filePath = path.join(testDir, "integration.spec.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "beforeAll", "afterAll"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "supertest",
		defaultImport: "request",
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "../server.js",
		namedImports: ["startServer"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Application"],
	});

	for (const schema of schemas) {
		sourceFile.addImportDeclaration({
			moduleSpecifier: `../mocks/${schema.name.toLowerCase()}.mock.js`,
			namedImports: [`fake${schema.name}`],
		});
	}

	sourceFile.addStatements(`
/**
 * Topologically sorted integration test suite.
 * Categories:
 * 1. Unit Tests (Done in DAO/Server specs)
 * 2. Stub Tests (No DB)
 * 3. Stateful Ephemeral Tests (With DB, empty)
 * 4. Seeded Mock Tests (With DB, pre-populated)
 */
describe('Mock Server Integration Tests', () => {

    describe('Category 2: Stub Tests', () => {
        let app: Application;
        let savedDbUrl: string | undefined;
        beforeAll(async () => {
            savedDbUrl = process.env.DATABASE_URL;
            delete process.env.DATABASE_URL;
            // No args = Stub mode
            app = await startServer(['node', 'script.js']);
        });
        afterAll(async () => {
            if (savedDbUrl !== undefined) {
                process.env.DATABASE_URL = savedDbUrl;
            }
            if (app && app.locals && app.locals.dataSource) {
                await app.locals.dataSource.destroy();
            }
        });

        ${schemas
					.map(
						(schema) => `
        it('should return empty/501 for ${schema.name} GET', async () => {
            const res = await request(app).get('/${schema.name.toLowerCase()}');
            expect(res.status).toBe(501);
            expect(res.body).toEqual({ error: "Not Implemented (No DB)" });
        });
        `,
					)
					.join("\n")}
    });

    describe('Category 3: Stateful Ephemeral Tests', () => {
        let app: Application;
        beforeAll(async () => {
            app = await startServer(['node', 'script.js', '--ephemeral']);
        });
        afterAll(async () => {
            if (app && app.locals && app.locals.dataSource) {
                await app.locals.dataSource.destroy();
            }
        });

        ${schemas
					.map(
						(schema, index) => `
        it('Tier ${index + 1}: should perform CRUD on ${schema.name}', async () => {
            let res = await request(app).get('/${schema.name.toLowerCase()}');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);

            res = await request(app).post('/${schema.name.toLowerCase()}').send(fake${schema.name}());
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
        });
        `,
					)
					.join("\n")}
    });

    describe('Category 4: Seeded Mock Tests', () => {
        let app: Application;
        beforeAll(async () => {
            app = await startServer(['node', 'script.js', '--ephemeral', '--seed']);
        });
        afterAll(async () => {
            if (app && app.locals && app.locals.dataSource) {
                await app.locals.dataSource.destroy();
            }
        });

        ${schemas
					.map(
						(schema) => `
        it('should return pre-populated data for ${schema.name}', async () => {
            const res = await request(app).get('/${schema.name.toLowerCase()}');
            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });
        `,
					)
					.join("\n")}
    });

    describe('Topological Teardown & Clean State Validation', () => {
        it('should verify clean state on fresh ephemeral instance', async () => {
            const cleanApp = await startServer(['node', 'script.js', '--ephemeral']);
            try {
                ${schemas
									.map(
										(schema) => `
                const res${schema.name} = await request(cleanApp).get('/${schema.name.toLowerCase()}');
                expect(res${schema.name}.status).toBe(200);
                expect(res${schema.name}.body).toEqual([]);`,
									)
									.join("\n")}
            } finally {
                if (cleanApp && cleanApp.locals && cleanApp.locals.dataSource) {
                    await cleanApp.locals.dataSource.destroy();
                }
            }
        });
    });

    describe('Category 5: Integrated Identity Provider (IdP) Full Lifecycle E2E', () => {
        let authApp: Application;
        beforeAll(async () => {
            authApp = await startServer(['node', 'script.js', '--ephemeral', '--enforce-auth', '--start-auth-server']);
        });
        afterAll(async () => {
            if (authApp && authApp.locals && authApp.locals.dataSource) {
                await authApp.locals.dataSource.destroy();
            }
        });

        it('should register a user via Auth Server, exchange credentials for a token, and access protected resources', async () => {
            const regRes = await request(authApp).post('/auth/register').send({ username: 'e2e_user', password: 'e2e_password' });
            expect(regRes.status).toBe(201);
            expect(regRes.body.accessToken).toBeDefined();

            const loginRes = await request(authApp).post('/auth/login').send({ username: 'e2e_user', password: 'e2e_password' });
            expect(loginRes.status).toBe(200);
            const token = loginRes.body.accessToken;
            expect(token).toBeDefined();

            ${schemas
							.map(
								(
									schema,
								) => `const protectedRes${schema.name} = await request(authApp).get('/${schema.name.toLowerCase()}').set('Authorization', \`Bearer \${token}\`);
            expect(protectedRes${schema.name}.status).toBe(200);`,
							)
							.join("\n")}

            const refreshRes = await request(authApp).post('/auth/refresh').send({ refreshToken: loginRes.body.refreshToken });
            expect(refreshRes.status).toBe(200);
            expect(refreshRes.body.accessToken).toBeDefined();

            const logoutRes = await request(authApp).post('/auth/logout').set('Authorization', \`Bearer \${token}\`).send({ refreshToken: refreshRes.body.refreshToken });
            expect(logoutRes.status).toBe(200);
        });
    });

});
`);

	sourceFile.formatText();
}
