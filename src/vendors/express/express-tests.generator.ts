/**
 * Generates unit and E2E route test suites (`<entity>.routes.spec.ts` and `<entity>.e2e.spec.ts`) for Express routers.
 *
 * @module vendors/express/express-tests.generator
 */
import path from "node:path";
import type { CodeBlockWriter, Project } from "ts-morph";

/**
 * Generates the unit test suite (`<entity>.routes.spec.ts`) for an entity's Express router.
 *
 * @param project - The `ts-morph` project.
 * @param schemaName - The name of the entity schema.
 * @param outputDir - Target routes directory.
 * @param orm - Optional ORM identifier (`"typeorm"`).
 */
export function generateExpressRouteTest(
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
				writer.writeLine(
					"let mockRepository: { find: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };",
				);
				writer.writeLine("let mockDataSource: DataSource;");
				writer.blankLine();
				writer.writeLine("beforeEach(() => {");
				writer.indent(() => {
					writer.writeLine("mockRepository = {");
					writer.indent(() => {
						writer.writeLine("find: vi.fn().mockResolvedValue([{ id: 1 }]),");
						writer.writeLine(
							"create: vi.fn().mockImplementation(<T>(data: T): T => data),",
						);
						writer.writeLine(
							"save: vi.fn().mockImplementation(async <T extends Record<string, unknown>>(data: T) => ({ id: 1, ...data }))",
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
export function generateExpressE2ETest(
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
					writer.writeLine(`let res = await request(app).get('/${fileName}');`);
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
