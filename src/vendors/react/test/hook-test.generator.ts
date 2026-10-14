/**
 * Module for hook test generator in vendors/react/test/hook-test.generator.
 *
 * @module vendors/react/test/hook-test.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import type { GeneratorConfig } from "../../../core/types/index.js";
import { camelCase, pascalCase } from "../../../functions/utils.js";
import type { SwaggerParser } from "../../../openapi/parse.js";

/** Generator/utility class `ReactHookTestGenerator`. */
export class ReactHookTestGenerator {
	/**
	 * Creates a new `ReactHookTestGenerator` instance.
	 * @param parser - Parsed OpenAPI specification instance.
	 * @param project - Target `ts-morph` project instance.
	 * @param config - Active generator configuration.
	 */
	constructor(
		private readonly parser: SwaggerParser,
		private readonly project: Project,
		private readonly config: GeneratorConfig,
	) {
		// Prevent unused warnings
		this.parser;
		this.config;
	}

	/**
	 * Executes `generateHookTestFile` on `ReactHookTestGenerator`.
	 * @param controllerName - Logical controller or tag group name.
	 * @param outputDir - Target output directory path.
	 */
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
