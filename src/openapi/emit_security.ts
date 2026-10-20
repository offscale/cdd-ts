/**
 * Generates `security.ts` exporting OpenAPI security schemes and global security requirements (`API_SECURITY_SCHEMES`, `API_SECURITY_REQUIREMENTS`).
 *
 * @module openapi/emit_security
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import type { SwaggerParser } from "./parse.js";

/**
 * Generates the `security.ts` file containing OpenAPI security scheme metadata.
 */
export class SecurityGenerator {
	/**
	 * Creates a new `SecurityGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project to create `security.ts` in.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `security.ts` in the specified output directory when security schemes or requirements exist.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		const schemes = this.parser.getSecuritySchemes();

		const securityRequirements = this.parser.getSpec().security;

		const hasSchemes = schemes && Object.keys(schemes).length > 0;

		const hasRequirements = securityRequirements !== undefined;

		if (!hasSchemes && !hasRequirements) {
			return;
		}

		const filePath = path.join(outputDir, "security.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addTypeAlias({
			name: "ApiSecurityRequirement",
			isExported: true,
			type: "Record<string, string[]>",
			docs: ["OpenAPI Security Requirement object shape."],
		});

		if (hasSchemes) {
			sourceFile.addVariableStatement({
				isExported: true,
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name: "API_SECURITY_SCHEMES",
						initializer: JSON.stringify(schemes, null, 2),
					},
				],
				docs: ["The Security Schemes defined in the OpenAPI specification."],
			});
		}

		if (hasRequirements) {
			sourceFile.addVariableStatement({
				isExported: true,
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name: "API_SECURITY_REQUIREMENTS",
						type: "ApiSecurityRequirement[]",

						initializer: JSON.stringify(securityRequirements ?? [], null, 2),
					},
				],
				docs: [
					"Global security requirements defined at the OpenAPI document level.",
				],
			});
		}

		sourceFile.formatText();
	}
}
