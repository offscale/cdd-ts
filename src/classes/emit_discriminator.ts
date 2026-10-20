/**
 * Generates the `discriminators.ts` runtime registry for polymorphic OpenAPI schemas.
 *
 * @module classes/emit_discriminator
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import type { SwaggerDefinition } from "../core/types/openapi.js";
import { pascalCase } from "../functions/utils.js";
import type { SwaggerParser } from "../openapi/parse.js";

/**
 * Generates the `discriminators.ts` file.
 * This file acts as a runtime registry for handling polymorphism.
 */
export class DiscriminatorGenerator {
	/**
	 * Creates a new `DiscriminatorGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification wrapper.
	 * @param project - The target `ts-morph` project.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `discriminators.ts` in the specified output directory.
	 *
	 * @param outputDir - Root directory for generated output files.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "discriminators.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const registry: Record<
			string,
			{
				propertyName: string;
				mapping?: Record<string, string>;
				defaultMapping?: string;
			}
		> = {};

		let count = 0;

		this.parser.schemas.forEach((entry) => {
			const schema = entry.definition;

			const modelName = entry.name;

			if (typeof schema === "boolean") return;

			const rawDiscriminator = (schema as SwaggerDefinition).discriminator;

			if (!rawDiscriminator) {
				return;
			}

			let propertyName = "";

			let mapping: Record<string, string> | undefined;

			let defaultMapping: string | undefined;

			if (typeof rawDiscriminator === "string") {
				propertyName = rawDiscriminator;
			} else {
				propertyName = rawDiscriminator.propertyName;

				if (rawDiscriminator.mapping) {
					const resolvedMapping: Record<string, string> = {};

					Object.entries(rawDiscriminator.mapping).forEach(
						([key, refValue]) => {
							const childModelName = this.resolveModelNameFromRef(
								refValue as string,
							);

							if (childModelName) {
								resolvedMapping[key] = childModelName;
							}
						},
					);

					mapping = resolvedMapping;
				}

				if (rawDiscriminator.defaultMapping) {
					defaultMapping = this.resolveModelNameFromRef(
						rawDiscriminator.defaultMapping,
					);
				}
			}

			registry[modelName] = { propertyName };

			if (mapping && Object.keys(mapping).length > 0) {
				registry[modelName].mapping = mapping;
			}

			if (defaultMapping) {
				registry[modelName].defaultMapping = defaultMapping;
			}

			count++;
		});

		if (count > 0) {
			sourceFile.addVariableStatement({
				isExported: true,
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name: "API_DISCRIMINATORS",
						initializer: JSON.stringify(registry, null, 2),
					},
				],
				docs: [
					"Registry of Polymorphic Discriminators.",
					"Keys are parent model names. Values contain the property name to check and an optional mapping of values to child model names.",
				],
			});
		} else {
			sourceFile.addStatements("export {};");
		}

		sourceFile.formatText();
	}

	/**
	 * Resolves a PascalCase model name from an OpenAPI `$ref` or schema URI.
	 *
	 * @param ref - Reference URI or schema name.
	 * @returns Resolved model name string.
	 */
	private resolveModelNameFromRef(ref: string): string {
		const resolvedSchema = this.parser.resolveReference(ref);

		if (resolvedSchema) {
			const found = this.parser.schemas.find(
				(entry) => entry.definition === resolvedSchema,
			);

			if (found) {
				return found.name;
			}
		}

		const parts = ref.split("/");

		let candidate = parts[parts.length - 1];

		if (!candidate) return "";

		candidate = candidate.replace(/[?#].*$/, "");

		candidate = candidate.replace(/\.[^/.]+$/, "");

		return pascalCase(candidate);
	}
}
