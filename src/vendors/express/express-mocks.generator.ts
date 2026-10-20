/**
 * Generates Faker-based mock entity factories (`<entity>.mock.ts`).
 *
 * @module vendors/express/express-mocks.generator
 */
import path from "node:path";
import type { CodeBlockWriter, Project } from "ts-morph";
import type { SwaggerParser } from "../../openapi/parse.js";

/**
 * Generates a Faker-based mock entity factory (`<entity>.mock.ts`).
 *
 * @param project - The `ts-morph` project.
 * @param schemaName - The name of the entity schema.
 * @param outputDir - Target routes directory.
 * @param _parser - Optional parsed OpenAPI specification.
 */
export function generateExpressEntityMock(
	project: Project,
	schemaName: string,
	outputDir: string,
	_parser?: Pick<SwaggerParser, "schemas">,
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
					fieldLines.push(`${propName}: faker.date.past().toISOString(),`);
				} else if (propName.toLowerCase().includes("email")) {
					fieldLines.push(`${propName}: faker.internet.email(),`);
				} else if (
					propName.toLowerCase().includes("name") ||
					propName.toLowerCase() === "first" ||
					propName.toLowerCase() === "last"
				) {
					fieldLines.push(`${propName}: faker.person.firstName(),`);
				} else {
					fieldLines.push(`${propName}: faker.lorem.word(),`);
				}
			} else if (propDef.type === "integer" || propDef.type === "number") {
				fieldLines.push(
					`${propName}: faker.number.int({ min: 1, max: 1000 }),`,
				);
			} else if (propDef.type === "boolean") {
				fieldLines.push(`${propName}: faker.datatype.boolean(),`);
			} else if (propDef.type === "array") {
				fieldLines.push(`${propName}: [],`);
			} else {
				fieldLines.push(`${propName}: {},`);
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
