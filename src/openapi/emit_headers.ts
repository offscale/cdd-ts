/**
 * Generates `headers.ts` exporting reusable `components.headers` definitions (`API_HEADERS`).
 *
 * @module openapi/emit_headers
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import type { SwaggerParser } from "./parse.js";

/**
 * Generates the `headers.ts` file.
 * Exposes reusable Header Objects from components.headers.
 */
export class HeadersGenerator {
	/**
	 * Creates a new `HeadersGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project to create `headers.ts` in.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `headers.ts` in the specified output directory.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "headers.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const headers = this.parser.spec.components?.headers ?? {};

		const hasHeaders = Object.keys(headers).length > 0;

		if (!hasHeaders) {
			sourceFile.replaceWithText("export { };\n");

			return;
		}

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "API_HEADERS",
					initializer: JSON.stringify(headers, null, 2),
				},
			],
			docs: ["Reusable Header Objects from components.headers."],
		});

		sourceFile.formatText();
	}
}
