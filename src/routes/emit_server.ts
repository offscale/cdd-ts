/**
 * Generates the `servers.ts` module exposing OpenAPI `servers` definitions.
 *
 * @module routes/emit_server
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import { UTILITY_GENERATOR_HEADER_COMMENT } from "../core/constants.js";
import type { SwaggerParser } from "../openapi/parse.js";

/**
 * Generates the `servers.ts` file containing `API_SERVERS`.
 */
export class ServerGenerator {
	/**
	 * Creates a new `ServerGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification wrapper.
	 * @param project - The target `ts-morph` project.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `servers.ts` in the specified output directory.
	 *
	 * @param outputDir - Root directory for generated output files.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "servers.ts");

		const sourceFile = this.project.createSourceFile(
			filePath,
			UTILITY_GENERATOR_HEADER_COMMENT, // Start with the header content
			{ overwrite: true },
		);

		const servers = this.parser.servers || [];

		if (servers.length > 0) {
			sourceFile.addVariableStatement({
				isExported: true,
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name: "API_SERVERS",
						initializer: JSON.stringify(servers, null, 2),
					},
				],
				docs: ["The servers defined in the OpenAPI specification."],
			});
		} else {
			// BEFORE (This is causing the error)
			// sourceFile.addStatements("export {};");

			// AFTER (A more robust way to add text to an almost-empty file)

			sourceFile.insertText(sourceFile.getEnd(), "\nexport {};");
		}

		sourceFile.formatText();
	}
}
