/**
 * Parses Vitest/Jasmine `describe`, `it`, and `test` AST call expressions from a `SourceFile`.
 *
 * @module tests/parse
 */
import {
	type CallExpression,
	Node,
	type SourceFile,
	SyntaxKind,
} from "ts-morph";

/**
 * Represents a parsed `describe`, `it`, or `test` block from a test file AST.
 */
export interface ParsedTestBlock {
	/** The test or suite description string. */
	description: string;
	/** The test block call identifier (`"describe"`, `"it"`, or `"test"`). */
	type: "describe" | "it" | "test";
	/** Nested child test blocks inside a `describe` suite. */
	children?: ParsedTestBlock[];
}

/**
 * Extracts all top-level and nested `describe`, `it`, and `test` blocks from a `SourceFile`.
 *
 * @param sourceFile - The `ts-morph` `SourceFile` to inspect.
 * @returns Array of parsed top-level `ParsedTestBlock` trees.
 */
export function parseTests(sourceFile: SourceFile): ParsedTestBlock[] {
	if (!sourceFile) return [];

	const testBlocks: ParsedTestBlock[] = [];
	const callExpressions = sourceFile.getDescendantsOfKind(
		SyntaxKind.CallExpression,
	);
	const processedNodes = new Set<CallExpression>();

	for (const callExpr of callExpressions) {
		if (processedNodes.has(callExpr)) continue;
		const block = extractTestBlock(callExpr, processedNodes);
		if (block) testBlocks.push(block);
	}
	return testBlocks;
}

/**
 * Extracts a single `ParsedTestBlock` (and any nested child blocks) from a `CallExpression`.
 *
 * @param callExpr - The AST `CallExpression` node to inspect.
 * @param processedNodes - Set of already-visited `CallExpression` nodes to avoid duplicate extraction.
 * @returns A `ParsedTestBlock` if the call expression is a test block, or `undefined` otherwise.
 */
function extractTestBlock(
	callExpr: CallExpression,
	processedNodes: Set<CallExpression>,
): ParsedTestBlock | undefined {
	const expression = callExpr.getExpression();
	const functionName = expression.getText();

	if (
		functionName !== "describe" &&
		functionName !== "it" &&
		functionName !== "test"
	) {
		return undefined;
	}

	processedNodes.add(callExpr);

	const args = callExpr.getArguments();
	if (args.length < 2) {
		return undefined;
	}

	const firstArg = args[0] as Node;
	let description = "";

	if (
		Node.isStringLiteral(firstArg) ||
		Node.isNoSubstitutionTemplateLiteral(firstArg)
	) {
		description = firstArg.getLiteralText();
	} else {
		description = firstArg.getText();
	}

	const type = functionName as "describe" | "it" | "test";
	const children: ParsedTestBlock[] = [];

	if (type === "describe") {
		const bodyFn = args[1] as Node;
		if (
			bodyFn &&
			(Node.isArrowFunction(bodyFn) || Node.isFunctionExpression(bodyFn))
		) {
			const nestedCalls = bodyFn.getDescendantsOfKind(
				SyntaxKind.CallExpression,
			);
			for (const nestedCall of nestedCalls) {
				if (!processedNodes.has(nestedCall)) {
					const nestedBlock = extractTestBlock(nestedCall, processedNodes);
					if (nestedBlock) {
						children.push(nestedBlock);
					}
				}
			}
		}
	}

	return {
		description,
		type,
		...(children.length > 0 ? { children } : {}),
	};
}
