/**
 * Generates Express router files (`<entity>.routes.ts`) for entities.
 *
 * @module vendors/express/express-routes.generator
 */
import path from "node:path";
import type { CodeBlockWriter, Project } from "ts-morph";

/**
 * Generates the Express router file (`<entity>.routes.ts`) for an entity.
 *
 * @param project - The `ts-morph` project.
 * @param schemaName - The name of the entity schema.
 * @param outputDir - Target routes directory.
 * @param orm - Optional ORM identifier (`"typeorm"`).
 */
export function generateExpressEntityRoute(
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
