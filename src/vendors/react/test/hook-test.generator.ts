import type { Project } from "ts-morph";
import * as path from "node:path";
import type { SwaggerParser } from "@src/openapi/parse.js";
import type { GeneratorConfig } from "@src/core/types/index.js";
import { camelCase, pascalCase } from "@src/functions/utils.js";

export class ReactHookTestGenerator {
	constructor(
		private readonly parser: SwaggerParser,
		private readonly project: Project,
		private readonly config: GeneratorConfig,
	) {
		// Prevent unused warnings
		this.parser;
		this.config;
	}

	public generateHookTestFile(controllerName: string, outputDir: string): void {
		const serviceName = `${pascalCase(controllerName)}Service`;
		const hookName = `use${serviceName}`;
		const fileName = `${camelCase(controllerName)}.hook.spec.ts`;
		const filePath = path.join(outputDir, fileName);

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addImportDeclarations([
			{
				moduleSpecifier: "vitest",
				namedImports: ["describe", "it", "expect"],
			},
			{
				moduleSpecifier: "@testing-library/react",
				namedImports: ["renderHook"],
			},
			{
				moduleSpecifier: `./${camelCase(controllerName)}.hook.js`,
				namedImports: [hookName],
			},
			{
				moduleSpecifier: `../services/${camelCase(controllerName)}.service.js`,
				namedImports: [serviceName],
			},
		]);

		const testLines: string[] = [
			`describe('${hookName}', () => {`,
			`    it('should return a ${serviceName} instance', () => {`,
			`        const { result } = renderHook(() => ${hookName}());`,
			`        expect(result.current).toBeInstanceOf(${serviceName});`,
			`    });`,
			`});`,
		];

		sourceFile.addStatements(testLines.join("\n"));
		sourceFile.formatText();
	}
}
