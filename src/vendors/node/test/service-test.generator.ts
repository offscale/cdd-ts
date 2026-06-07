import * as path from "node:path";
import type {
	GeneratorConfig,
	PathInfo,
	SwaggerDefinition,
} from "@src/core/types/index.js";
import { camelCase, pascalCase } from "@src/functions/utils.js";
import type { SwaggerParser } from "@src/openapi/parse.js";
import type { Project } from "ts-morph";
import { MockDataGenerator } from "../../angular/test/mock-data.generator.js";

export class NodeServiceTestGenerator {
	private mockDataGenerator: MockDataGenerator;

	constructor(
		private readonly parser: SwaggerParser,
		private readonly project: Project,
		private readonly config: GeneratorConfig,
	) {
		// Prevent unused warnings
		this.parser;
		this.config;
		this.mockDataGenerator = new MockDataGenerator(parser);
	}

	public generateServiceTestFile(
		controllerName: string,
		operations: PathInfo[],
		servicesDir: string,
	): void {
		const serviceName = `${pascalCase(controllerName)}Service`;
		const fileName = `${camelCase(controllerName)}.service.spec.ts`;
		const filePath = path.join(servicesDir, fileName);

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});
		const isComposable =
			this.config.options?.composableTests === true ||
			this.config.options?.tests === true;

		sourceFile.addImportDeclarations([
			{
				moduleSpecifier: "vitest",
				namedImports: [
					"describe",
					"it",
					"expect",
					"vi",
					"beforeEach",
					"afterEach",
				],
			},
			{
				moduleSpecifier: "https",
				defaultImport: "https",
			},
			{
				moduleSpecifier: "http",
				defaultImport: "http",
			},
			{
				moduleSpecifier: `./${camelCase(controllerName)}.service.js`,
				namedImports: [serviceName],
			},
		]);

		const testLines: string[] = [];

		if (isComposable) {
			testLines.push(
				`export const test${serviceName} = () => describe('${serviceName}', () => {`,
			);
		} else {
			testLines.push(`describe('${serviceName}', () => {`);
		}

		testLines.push(`    let service: ${serviceName};`);
		testLines.push(``);
		testLines.push(`    beforeEach(() => {`);
		testLines.push(
			`        service = new ${serviceName}('http://localhost:8080/v2');`,
		);
		testLines.push(`    });`);
		testLines.push(``);
		testLines.push(`    afterEach(() => {`);
		testLines.push(`        vi.restoreAllMocks();`);
		testLines.push(`    });`);
		testLines.push(``);

		for (const op of operations) {
			const methodName =
				op.methodName ||
				camelCase(
					op.operationId ||
						`${op.method}_${op.path.replace(/[^a-zA-Z0-9]/g, "_")}`,
				);
			testLines.push(`    describe('${methodName}', () => {`);
			testLines.push(
				`        it('should make a ${op.method.toUpperCase()} request to ${op.path}', async () => {`,
			);

			testLines.push(``);

			// Build simple params
			const params: string[] = [];

			if (op.parameters && op.parameters.length > 0) {
				const requiredParams = op.parameters.filter(
					(p) => !("in" in p) || p.required,
				);
				for (const p of requiredParams) {
					let val = this.mockDataGenerator.generate(
						((p.schema as SwaggerDefinition)?.name as string) || p.name,
					);
					if (
						typeof val === "string" &&
						!val.startsWith("'") &&
						!val.startsWith('"') &&
						!val.startsWith("{") &&
						!val.startsWith("[")
					) {
						val = `'${val}'`;
					}
					params.push(String(val));
				}
			}
			if (op.requestBody) {
				if (op.requestBody.content) {
					const contentTypes = Object.keys(op.requestBody.content);
					if (contentTypes.length > 0) {
						const schema = op.requestBody.content[contentTypes[0]].schema;
						let val = this.mockDataGenerator.generate(
							((schema as SwaggerDefinition)?.name as string) || "Unknown",
						);
						if (
							typeof val === "string" &&
							!val.startsWith("'") &&
							!val.startsWith('"') &&
							!val.startsWith("{") &&
							!val.startsWith("[")
						) {
							val = `'${val}'`;
						}
						params.push(String(val));
					} else {
						params.push(`{}`);
					}
				} else {
					params.push(`{}`);
				}
			}

			const paramString = params.join(", ");

			testLines.push(
				`            const result = await service.${methodName}(${paramString});`,
			);
			testLines.push(`            expect(result).toBeDefined();`);
			testLines.push(`        });`);
			testLines.push(`    });`);
			testLines.push(``);
		}

		testLines.push(`});`);

		if (isComposable) {
			testLines.push("");
			testLines.push(`test${serviceName}();`);
		}

		sourceFile.addStatements(testLines.join("\n"));
		sourceFile.formatText();
	}
}
