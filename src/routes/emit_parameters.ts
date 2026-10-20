/**
 * Generates the `parameters.ts` module exposing reusable OpenAPI `components.parameters`.
 *
 * @module routes/emit_parameters
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import type { SwaggerParser } from "../openapi/parse.js";

/**
 * Generates the `parameters.ts` file.
 * Exposes reusable Parameter Objects from components.parameters.
 */
export class ParametersGenerator {
	/**
	 * Creates a new `ParametersGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification wrapper.
	 * @param project - The target `ts-morph` project.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `parameters.ts` in the specified output directory.
	 *
	 * @param outputDir - Root directory for generated output files.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "parameters.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const parameters = this.parser.spec.components?.parameters ?? {};

		const hasParameters = Object.keys(parameters).length > 0;

		if (!hasParameters) {
			sourceFile.replaceWithText("export { };\n");

			return;
		}

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "API_PARAMETERS",
					initializer: JSON.stringify(parameters, null, 2),
				},
			],
			docs: ["Reusable Parameter Objects from components.parameters."],
		});

		sourceFile.formatText();
	}
}
