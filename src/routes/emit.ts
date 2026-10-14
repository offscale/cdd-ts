/**
 * Generates the `paths.ts` module capturing path-level OpenAPI metadata.
 *
 * @module routes/emit
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import { UTILITY_GENERATOR_HEADER_COMMENT } from "../core/constants.js";
import type { OpenApiValue, PathItem } from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";

/**
 * Generates the `paths.ts` file.
 * Captures path-level metadata (summary/description/parameters/servers/$ref/x-*) for reverse generation.
 */
export class PathsGenerator {
	/**
	 * Creates a new `PathsGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification wrapper.
	 * @param project - The target `ts-morph` project.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `paths.ts` in the specified output directory.
	 *
	 * @param outputDir - Root directory for generated output files.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "paths.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const paths = this.parser.spec.paths ?? {};

		const registry: Record<string, PathItem> = {};

		Object.entries(paths).forEach(([pathKey, pathItem]) => {
			if (!pathItem || typeof pathItem !== "object") return;

			const extensions = Object.fromEntries(
				Object.entries(pathItem as Record<string, OpenApiValue>).filter(
					([key]) => key.startsWith("x-"),
				),
			);

			const meta: Record<string, OpenApiValue> = {
				...(pathItem.$ref ? { $ref: pathItem.$ref } : {}),

				...(pathItem.summary ? { summary: pathItem.summary } : {}),
				...(pathItem.description ? { description: pathItem.description } : {}),
				...(pathItem.parameters && pathItem.parameters.length > 0
					? { parameters: pathItem.parameters }
					: {}),
				...(pathItem.servers && pathItem.servers.length > 0
					? { servers: pathItem.servers }
					: {}),
				...extensions,
			};

			if (Object.keys(meta).length > 0) {
				registry[pathKey] = meta as PathItem;
			}
		});

		if (Object.keys(registry).length === 0) {
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
					name: "API_PATHS",
					initializer: JSON.stringify(registry, null, 2),
				},
			],
			docs: [
				"Path-level metadata captured from the OpenAPI spec (summary/description/parameters/servers/x-*).",
			],
		});

		sourceFile.formatText();

		sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);
	}
}
