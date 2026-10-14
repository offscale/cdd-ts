/**
 * Generates `responses.ts` exporting reusable `components.responses` definitions (`API_RESPONSES`).
 *
 * @module openapi/emit_responses
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import { UTILITY_GENERATOR_HEADER_COMMENT } from "../core/constants.js";
import type { SwaggerParser } from "./parse.js";

/**
 * Generates the `responses.ts` file.
 * Exposes reusable Response Objects from components.responses.
 */
export class ResponsesGenerator {
	/**
	 * Creates a new `ResponsesGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project to create `responses.ts` in.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `responses.ts` in the specified output directory.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "responses.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const responses = this.parser.spec.components?.responses ?? {};

		const hasResponses = Object.keys(responses).length > 0;

		if (!hasResponses) {
			sourceFile.replaceWithText(
				`${UTILITY_GENERATOR_HEADER_COMMENT}export { };\n`,
			);

			return;
		}

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "API_RESPONSES",
					initializer: JSON.stringify(responses, null, 2),
				},
			],
			docs: ["Reusable Response Objects from components.responses."],
		});

		sourceFile.formatText();

		sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);
	}
}
