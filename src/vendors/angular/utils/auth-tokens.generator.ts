/**
 * Module for auth tokens generator in vendors/angular/utils/auth-tokens.generator.
 *
 * @module vendors/angular/utils/auth-tokens.generator
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import { UTILITY_GENERATOR_HEADER_COMMENT } from "../../../core/constants.js";

/** Generator/utility class `AuthTokensGenerator`. */
export class AuthTokensGenerator {
	/**
	 * Creates a new `AuthTokensGenerator` instance.
	 * @param project - Target `ts-morph` project instance.
	 */
	constructor(private project: Project) {}

	/**
	 * Executes `generate` on `AuthTokensGenerator`.
	 * @param outputDir - Target output directory path.
	 */
	public generate(outputDir: string): void {
		const authDir = path.join(outputDir, "auth");

		const filePath = path.join(authDir, "auth.tokens.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);

		sourceFile.addImportDeclarations([
			{
				moduleSpecifier: "@angular/core",
				namedImports: ["InjectionToken"],
			},
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
					name: "API_KEY_TOKEN",
					initializer: `new InjectionToken<string>('API_KEY')`,
				},
			],
			docs: ["Injection token for providing an API key (Header/Query)."],
		});

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "COOKIE_AUTH_TOKEN",
					initializer: `new InjectionToken<string>('COOKIE_AUTH')`,
				},
			],
			docs: [
				"Injection token for providing an API key via Cookie (Node/SSR mainly).",
			],
		});

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "BEARER_TOKEN_TOKEN",
					initializer: `new InjectionToken<string | (() => string)>('BEARER_TOKEN')`,
				},
			],
			docs: [
				"Injection token for providing a bearer token or a function that returns a bearer token.",
			],
		});

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "HTTPS_AGENT_CONFIG_TOKEN",
					initializer: `new InjectionToken<Record<string, string | number | boolean | object | undefined | null>>('HTTPS_AGENT_CONFIG')`,
				},
			],
			docs: [
				"Injection token for mTLS/HTTPS Agent configuration (Node.js/SSR only).",
			],
		});

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "HTTPS_AGENT_CONTEXT_TOKEN",
					initializer: `new HttpContextToken<Record<string, string | number | boolean | object | undefined | null> | null>(() => null)`,
				},
			],
			docs: [
				"HttpContextToken to pass mTLS configuration to the underlying HttpHandler.",
			],
		});

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "SECURITY_CONTEXT_TOKEN",
					initializer: `new HttpContextToken<Record<string, string[]>[]>(() => [])`,
				},
			],
			docs: [
				"Context token containing the full Security Requirement Object for the request.",
			],
		});

		sourceFile.formatText();
	}
}
