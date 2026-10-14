/**
 * Reverse parser for extracting OpenAPI `components.examples` metadata from generated `examples.ts` files.
 *
 * @module mocks/parse
 */
import type { SourceFile } from "ts-morph";
import type { ExampleObject } from "../core/types/index.js";
import { evaluateAstLiteral } from "../openapi/parse_ast_literal.js";

/**
 * Parses the `examples.ts` file to extract mock/example data that was previously emitted.
 * This supports the bidirectionality feature of CDD for examples without executing code.
 *
 * @param sourceFile - The ts-morph SourceFile representing `examples.ts`.
 * @returns A record of example names to ExampleObject metadata, or undefined if the `API_EXAMPLES` variable is not found or is not a valid object literal.
 */
export function parseExamplesMetadata(
	sourceFile: SourceFile | undefined | null,
): Record<string, ExampleObject> | undefined {
	if (!sourceFile) {
		return undefined;
	}

	const apiExamplesVar = sourceFile.getVariableDeclaration("API_EXAMPLES");
	if (!apiExamplesVar) {
		return undefined;
	}

	const initializer = apiExamplesVar.getInitializer();
	if (!initializer) {
		return undefined;
	}

	const parsed = evaluateAstLiteral(initializer);
	if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
		return parsed as Record<string, ExampleObject>;
	}
	return undefined;
}
