/**
 * Generates `request-bodies.ts` exporting reusable `components.requestBodies` definitions (`API_REQUEST_BODIES`).
 *
 * @module openapi/emit_request_bodies
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import type { SwaggerParser } from "./parse.js";

/**
 * Generates the `request-bodies.ts` file.
 * Exposes reusable Request Body Objects from components.requestBodies.
 */
export class RequestBodiesGenerator {
	/**
	 * Creates a new `RequestBodiesGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project to create `request-bodies.ts` in.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates `request-bodies.ts` in the specified output directory.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "request-bodies.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const requestBodies = this.parser.spec.components?.requestBodies ?? {};

		const hasRequestBodies = Object.keys(requestBodies).length > 0;

		if (!hasRequestBodies) {
			sourceFile.replaceWithText("export { };\n");

			return;
		}

		sourceFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			declarations: [
				{
					name: "API_REQUEST_BODIES",
					initializer: JSON.stringify(requestBodies, null, 2),
				},
			],
			docs: ["Reusable Request Body Objects from components.requestBodies."],
		});

		sourceFile.formatText();
	}
}
