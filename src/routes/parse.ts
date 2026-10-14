/**
 * Reverse parser for extracting OpenAPI path-level metadata from generated `paths.ts` files.
 *
 * @module routes/parse
 */
import type { SourceFile } from "ts-morph";
import type { PathItem } from "../core/types/index.js";
import { evaluateAstLiteral } from "../openapi/parse_ast_literal.js";

/**
 * Parses the `paths.ts` file to extract path-level metadata that was previously emitted.
 * This supports the bidirectionality feature of CDD without executing code.
 *
 * @param sourceFile - The ts-morph SourceFile representing `paths.ts`.
 * @returns A record of path keys to PathItem metadata, or undefined if the `API_PATHS` variable is not found or cannot be statically parsed.
 */
export function parsePathsMetadata(
	sourceFile: SourceFile | undefined | null,
): Record<string, PathItem> | undefined {
	if (!sourceFile) {
		return undefined;
	}

	const apiPathsVar = sourceFile.getVariableDeclaration("API_PATHS");
	if (!apiPathsVar) {
		return undefined;
	}

	const initializer = apiPathsVar.getInitializer();
	if (!initializer) {
		return undefined;
	}

	const parsed = evaluateAstLiteral(initializer);
	if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
		return parsed as Record<string, PathItem>;
	}
	return undefined;
}
