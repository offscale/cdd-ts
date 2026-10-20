/**
 * Generates `media-types.ts` exporting reusable `components.mediaTypes` definitions (`API_MEDIA_TYPES`).
 *
 * @module openapi/emit_media_types
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import type { SwaggerParser } from "./parse.js";

/**
 * Generates the `media-types.ts` file.
 * Exposes reusable Media Type Objects from components.mediaTypes.
 */
export class MediaTypesGenerator {
	/**
	 * Creates a new `MediaTypesGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project to create `media-types.ts` in.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `media-types.ts` in the specified output directory.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "media-types.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const mediaTypes = this.parser.spec.components?.mediaTypes ?? {};

		const hasMediaTypes = Object.keys(mediaTypes).length > 0;

		if (!hasMediaTypes) {
			sourceFile.replaceWithText("export { };\n");

			return;
		}

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "API_MEDIA_TYPES",
					initializer: JSON.stringify(mediaTypes, null, 2),
				},
			],
			docs: ["Reusable Media Type Objects from components.mediaTypes."],
		});

		sourceFile.formatText();
	}
}
