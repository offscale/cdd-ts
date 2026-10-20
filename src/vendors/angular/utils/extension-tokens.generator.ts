/**
 * Module for extension tokens generator in vendors/angular/utils/extension-tokens.generator.
 *
 * @module vendors/angular/utils/extension-tokens.generator
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";

/** Generator/utility class `ExtensionTokensGenerator`. */
export class ExtensionTokensGenerator {
	/**
	 * Creates a new `ExtensionTokensGenerator` instance.
	 * @param project - Target `ts-morph` project instance.
	 */
	constructor(private project: Project) {}

	/**
	 * Executes `generate` on `ExtensionTokensGenerator`.
	 * @param outputDir - Target output directory path.
	 */
	public generate(outputDir: string): void {
		const tokensDir = path.join(outputDir, "tokens");

		const filePath = path.join(tokensDir, "extensions.token.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addImportDeclarations([
			{
				moduleSpecifier: "@angular/common/http",
				namedImports: ["HttpContextToken"],
			},
		]);

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "EXTENSIONS_CONTEXT_TOKEN",
					initializer: `new HttpContextToken<Record<string, string | number | boolean | object | undefined | null>>(() => ({}))`,
				},
			],
			docs: [
				"Context token containing Specification Extensions (x-*) defined on the Operation in the OpenAPI spec.",
				"Useful for interceptors to read metadata like x-cache-ttl, x-retry-count, etc.",
			],
		});

		sourceFile.formatText();
	}
}
