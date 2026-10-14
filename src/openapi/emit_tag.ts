/**
 * Generates `tags.ts` exporting OpenAPI Tag metadata (`API_TAGS`, `API_TAGS_MAP`).
 *
 * @module openapi/emit_tag
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import { UTILITY_GENERATOR_HEADER_COMMENT } from "../core/constants.js";
import type { OpenApiValue, TagObject } from "../core/types/index.js";
import type { SwaggerParser } from "./parse.js";

/**
 * Generates the `tags.ts` file containing tag list and lookup map constants.
 */
export class TagGenerator {
	/**
	 * Creates a new `TagGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project to create `tags.ts` in.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `tags.ts` in the specified output directory.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "tags.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const tagsFound = this.parser.spec.tags || [];

		const extractExtensions = (tag: Record<string, OpenApiValue>) =>
			Object.fromEntries(
				Object.entries(tag).filter(([key]) => key.startsWith("x-")),
			);

		const registry: TagObject[] = tagsFound.map((t: TagObject) => ({
			name: t.name,
			...(t.summary ? { summary: t.summary } : {}),
			...(t.description ? { description: t.description } : {}),
			...(t.externalDocs ? { externalDocs: t.externalDocs } : {}),
			...(t.parent ? { parent: t.parent } : {}),
			...(t.kind ? { kind: t.kind } : {}),
			...extractExtensions(t),
		}));

		const mapRegistry: Record<string, TagObject> = {};

		registry.forEach((t) => {
			mapRegistry[t.name] = t;
		});

		if (registry.length > 0) {
			sourceFile.addVariableStatement({
				isExported: true,
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name: "API_TAGS",
						initializer: JSON.stringify(registry, null, 2),
					},
				],
				docs: ["List of API Tags with metadata."],
			});

			sourceFile.addVariableStatement({
				isExported: true,
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name: "API_TAGS_MAP",
						initializer: JSON.stringify(mapRegistry, null, 2),
					},
				],
				docs: ["Lookup map for API Tags by name."],
			});
		} else {
			sourceFile.addStatements("export {};");
		}

		sourceFile.formatText();

		sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);
	}
}
