/**
 * Module for token generator in vendors/angular/utils/token.generator.
 *
 * @module vendors/angular/utils/token.generator
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import { UTILITY_GENERATOR_HEADER_COMMENT } from "../../../core/constants.js";
import {
	getBasePathTokenName,
	getClientContextTokenName,
	getInterceptorsTokenName,
	getServerVariablesTokenName,
} from "../../../functions/utils.js";

/** Generator/utility class `TokenGenerator`. */
export class TokenGenerator {
	private readonly clientName: string;

	/**
	 * Creates a new `TokenGenerator` instance.
	 * @param project - Target `ts-morph` project instance.
	 * @param clientName - Parameter `clientName` (string).
	 */
	constructor(
		private project: Project,
		clientName?: string,
	) {
		this.clientName = clientName || "default";
	}

	/**
	 * Executes `generate` on `TokenGenerator`.
	 * @param outputDir - Target output directory path.
	 */
	public generate(outputDir: string): void {
		const tokensDir = path.join(outputDir, "tokens");

		const filePath = path.join(tokensDir, "index.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);

		sourceFile.addImportDeclarations([
			{
				namedImports: ["InjectionToken"],
				moduleSpecifier: "@angular/core",
			},
			{
				namedImports: ["HttpInterceptor", "HttpContextToken"],
				moduleSpecifier: "@angular/common/http",
			},
		]);

		const basePathTokenName = getBasePathTokenName(this.clientName);

		const serverVariablesTokenName = getServerVariablesTokenName(
			this.clientName,
		);

		const interceptorsTokenName = getInterceptorsTokenName(this.clientName);

		const clientContextTokenName = getClientContextTokenName(this.clientName);

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: basePathTokenName,
					initializer: `new InjectionToken<string>('${basePathTokenName}')`,
				},
			],
			docs: [`Injection token for providing the base API path.`],
		});

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: serverVariablesTokenName,
					initializer: `new InjectionToken<Record<string, string>>('${serverVariablesTokenName}')`,
				},
			],
			docs: [
				`Injection token for providing dynamic server variables (e.g. { port: '8080' }).`,
			],
		});

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: interceptorsTokenName,
					initializer: `new InjectionToken<HttpInterceptor[]>('${interceptorsTokenName}', { providedIn: 'root', factory: () => [] })`,
				},
			],
			docs: [`Injection token for client-specific interceptors.`],
		});

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: clientContextTokenName,
					initializer: `new HttpContextToken<string>(() => '${this.clientName}')`,
				},
			],
			docs: [`HttpContextToken identifying requests for this client.`],
		});

		sourceFile.formatText();
	}
}
