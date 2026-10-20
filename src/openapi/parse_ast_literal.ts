/**
 * Safe, deterministic AST literal evaluator for extracting JSON/OpenAPI values from TypeScript AST nodes without dynamic code execution.
 *
 * @module openapi/parse_ast_literal
 */
import { Node, SyntaxKind } from "ts-morph";
import type { OpenApiValue } from "../core/types/index.js";

/**
 * Safely evaluates a TypeScript AST node into a plain JavaScript/OpenAPI value
 * without using `eval` or `new Function`.
 *
 * Supports object literals, array literals, string literals, numeric literals,
 * unary +/- numeric expressions, booleans, null, undefined, and type-assertion wrappers.
 * Returns `undefined` if the node contains non-literal expressions (e.g., function calls or identifiers).
 *
 * @param node - The `ts-morph` AST node to evaluate.
 * @returns The evaluated literal value, or `undefined` if the node cannot be statically evaluated.
 */
export function evaluateAstLiteral(node: Node | undefined): OpenApiValue {
	if (!node) {
		return undefined;
	}

	if (
		Node.isAsExpression(node) ||
		Node.isSatisfiesExpression(node) ||
		Node.isParenthesizedExpression(node) ||
		Node.isTypeAssertion(node)
	) {
		return evaluateAstLiteral(node.getExpression());
	}

	if (
		Node.isStringLiteral(node) ||
		Node.isNoSubstitutionTemplateLiteral(node)
	) {
		return node.getLiteralValue();
	}

	if (Node.isNumericLiteral(node)) {
		return node.getLiteralValue();
	}

	const kind = node.getKind();

	if (kind === SyntaxKind.TrueKeyword) {
		return true;
	}

	if (kind === SyntaxKind.FalseKeyword) {
		return false;
	}

	if (kind === SyntaxKind.NullKeyword) {
		return null;
	}

	if (
		kind === SyntaxKind.UndefinedKeyword ||
		(Node.isIdentifier(node) && node.getText() === "undefined")
	) {
		return undefined;
	}

	if (Node.isPrefixUnaryExpression(node)) {
		const operator = node.getOperatorToken();
		const operandVal = evaluateAstLiteral(node.getOperand());
		if (typeof operandVal === "number") {
			if (operator === SyntaxKind.MinusToken) {
				return -operandVal;
			}
			if (operator === SyntaxKind.PlusToken) {
				return operandVal;
			}
		}
		return undefined;
	}

	if (Node.isArrayLiteralExpression(node)) {
		const elements = node.getElements();
		const result: OpenApiValue[] = [];
		for (const elem of elements) {
			const isExplicitUndefined =
				elem.getKind() === SyntaxKind.UndefinedKeyword ||
				(Node.isIdentifier(elem) && elem.getText() === "undefined");
			const evaluated = evaluateAstLiteral(elem);
			if (evaluated === undefined && !isExplicitUndefined) {
				return undefined;
			}
			result.push(evaluated);
		}
		return result;
	}

	if (Node.isObjectLiteralExpression(node)) {
		const result: Record<string, OpenApiValue> = {};
		for (const prop of node.getProperties()) {
			if (!Node.isPropertyAssignment(prop)) {
				return undefined;
			}
			const nameNode = prop.getNameNode();
			let key: string;
			if (
				Node.isStringLiteral(nameNode) ||
				Node.isNoSubstitutionTemplateLiteral(nameNode)
			) {
				key = nameNode.getLiteralValue();
			} else if (Node.isNumericLiteral(nameNode)) {
				key = String(nameNode.getLiteralValue());
			} else if (Node.isIdentifier(nameNode)) {
				key = nameNode.getText();
			} else {
				return undefined;
			}

			const initializer = prop.getInitializerOrThrow();
			const isExplicitUndefined =
				initializer.getKind() === SyntaxKind.UndefinedKeyword ||
				(Node.isIdentifier(initializer) &&
					initializer.getText() === "undefined");
			const evaluated = evaluateAstLiteral(initializer);
			if (evaluated === undefined && !isExplicitUndefined) {
				return undefined;
			}
			result[key] = evaluated;
		}
		return result;
	}

	return undefined;
}
