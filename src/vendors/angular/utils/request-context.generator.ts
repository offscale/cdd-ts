/**
 * Module for request context generator in vendors/angular/utils/request-context.generator.
 *
 * @module vendors/angular/utils/request-context.generator
 */
import type { Project } from "ts-morph";

/** Generator/utility class `RequestContextGenerator`. */
export class RequestContextGenerator {
	/**
	 * Creates a new `RequestContextGenerator` instance.
	 * @param project - Target `ts-morph` project instance.
	 */
	constructor(private readonly project: Project) {}

	/**
	 * Executes `generate` on `RequestContextGenerator`.
	 * @param outputDir - Target output directory path.
	 */
	generate(outputDir: string): void {
		const sourceFile = this.project.createSourceFile(
			`${outputDir}/utils/request-context.ts`,
			"",
			{
				overwrite: true,
			},
		);

		sourceFile.addImportDeclaration({
			moduleSpecifier: "@angular/common/http",
			namedImports: ["HttpHeaders", "HttpParams", "HttpContext"],
		});

		sourceFile.addInterface({
			name: "RequestOptions",
			isExported: true,
			properties: [
				{
					name: "headers?",
					type: "HttpHeaders | Record<string, string | string[]>",
				},
				{ name: "context?", type: "HttpContext" },
				{ name: "observe?", type: "'body' | 'events' | 'response'" },
				{
					name: "params?",
					type: "HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>",
				},
				{ name: "reportProgress?", type: "boolean" },
				{
					name: "responseType?",
					type: "'arraybuffer' | 'blob' | 'json' | 'text'",
				},
				{ name: "withCredentials?", type: "boolean" },
			],
		});

		sourceFile.addInterface({
			name: "HttpRequestOptions",
			isExported: true,
			extends: ["RequestOptions"],
			properties: [
				{
					name: "body?",
					type: "string | number | boolean | object | undefined | null",
				},
			],
		});

		sourceFile.addFunction({
			name: "createRequestOption",
			isExported: true,
			parameters: [{ name: "options?", type: "RequestOptions" }],
			returnType: "HttpRequestOptions",
			statements: "return { ...options };",
		});
	}
}
