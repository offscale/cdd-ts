/**
 * Module for composable test generator in vendors/vue/test/composable-test.generator.
 *
 * @module vendors/vue/test/composable-test.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import type { GeneratorConfig } from "../../../core/types/index.js";
import { camelCase, pascalCase } from "../../../functions/utils.js";
import type { SwaggerParser } from "../../../openapi/parse.js";

/** Generator/utility class `VueComposableTestGenerator`. */
export class VueComposableTestGenerator {
	/**
	 * Creates a new `VueComposableTestGenerator` instance.
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
	 * Executes `generateComposableTestFile` on `VueComposableTestGenerator`.
	 * @param controllerName - Logical controller or tag group name.
	 * @param outputDir - Target output directory path.
	 */
	public generateComposableTestFile(
		controllerName: string,
		outputDir: string,
	): void {
		const serviceName = `${pascalCase(controllerName)}Service`;
		const hookName = `use${serviceName}`;
		const fileName = `${camelCase(controllerName)}.composable.spec.ts`;
		const filePath = path.join(outputDir, fileName);

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addImportDeclarations([
			{
				moduleSpecifier: "vitest",
				namedImports: ["describe", "it", "expect", "vi", "beforeEach"],
			},
			{
				moduleSpecifier: "vue",
				namedImports: ["inject"],
			},
			{
				moduleSpecifier: `./${camelCase(controllerName)}.composable.js`,
				namedImports: [hookName],
			},
			{
				moduleSpecifier: `../services/${camelCase(controllerName)}.service.js`,
				namedImports: [serviceName],
			},
			{
				moduleSpecifier: `../plugin.js`,
				namedImports: [`${serviceName}Key`],
			},
		]);

		const testLines: string[] = [
			`vi.mock('vue', async (importOriginal) => {`,
			`    const actual = await importOriginal<typeof import('vue')>();`,
			`    return {`,
			`        ...actual,`,
			`        inject: vi.fn(),`,
			`    };`,
			`});`,
			``,
			`describe('${hookName}', () => {`,
			`    beforeEach(() => {`,
			`        vi.resetAllMocks();`,
			`    });`,
			``,
			`    it('should return the injected ${serviceName}', () => {`,
			`        const mockService = {} as ${serviceName};`,
			`        vi.mocked(inject).mockReturnValue(mockService);`,
			``,
			`        const result = ${hookName}();`,
			``,
			`        expect(result).toBe(mockService);`,
			`        expect(inject).toHaveBeenCalledWith(${serviceName}Key);`,
			`    });`,
			``,
			`    it('should throw an error if ${serviceName} is not injected', () => {`,
			`        vi.mocked(inject).mockReturnValue(undefined);`,
			``,
			`        expect(() => ${hookName}()).toThrow('API Client not installed. Please use the ApiClientPlugin in your Vue app.');`,
			`        expect(inject).toHaveBeenCalledWith(${serviceName}Key);`,
			`    });`,
			`});`,
		];

		sourceFile.addStatements(testLines.join("\n"));
		sourceFile.formatText();
	}
}
