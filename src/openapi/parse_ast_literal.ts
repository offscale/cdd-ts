/**
 * Safe, deterministic AST literal evaluator for extracting JSON/OpenAPI values from TypeScript AST nodes without dynamic code execution.
 *
 * @module openapi/parse_ast_literal
 */
import { type Node, SyntaxKind } from "ts-morph";
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

	const kind = node.getKind();

	if (
		kind === SyntaxKind.AsExpression ||
		kind === SyntaxKind.SatisfiesExpression ||
		kind === SyntaxKind.ParenthesizedExpression ||
		kind === SyntaxKind.TypeAssertionExpression
	) {
		const expr = (
			node as Node & { getExpression?: () => Node | undefined }
		).getExpression?.();
		return evaluateAstLiteral(expr);
	}

	if (
		kind === SyntaxKind.StringLiteral ||
		kind === SyntaxKind.NoSubstitutionTemplateLiteral
	) {
		return (node as Node & { getLiteralValue: () => string }).getLiteralValue();
	}

	if (kind === SyntaxKind.NumericLiteral) {
		return (node as Node & { getLiteralValue: () => number }).getLiteralValue();
	}

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
		(kind === SyntaxKind.Identifier && node.getText() === "undefined")
	) {
		return undefined;
	}

	if (kind === SyntaxKind.PrefixUnaryExpression) {
		const prefixNode = node as Node & {
			getOperatorToken: () => SyntaxKind;
			getOperand: () => Node;
		};
		const operator = prefixNode.getOperatorToken();
		const operandVal = evaluateAstLiteral(prefixNode.getOperand());
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

	if (kind === SyntaxKind.ArrayLiteralExpression) {
		const arrayNode = node as Node & { getElements: () => Node[] };
		const elements = arrayNode.getElements();
		const result: OpenApiValue[] = [];
		for (const elem of elements) {
			const isExplicitUndefined =
				elem.getKind() === SyntaxKind.UndefinedKeyword ||
				(elem.getKind() === SyntaxKind.Identifier &&
					elem.getText() === "undefined");
			const evaluated = evaluateAstLiteral(elem);
			if (evaluated === undefined && !isExplicitUndefined) {
				return undefined;
			}
			result.push(evaluated);
		}
		return result;
	}

	if (kind === SyntaxKind.ObjectLiteralExpression) {
		const objNode = node as Node & { getProperties: () => Node[] };
		const result: Record<string, OpenApiValue> = {};
		for (const prop of objNode.getProperties()) {
			if (prop.getKind() !== SyntaxKind.PropertyAssignment) {
				return undefined;
			}
			const propAssign = prop as Node & {
				getNameNode: () => Node;
				getInitializer: () => Node | undefined;
			};
			const nameNode = propAssign.getNameNode();
			let key: string;
			if (
				nameNode.getKind() === SyntaxKind.StringLiteral ||
				nameNode.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral ||
				nameNode.getKind() === SyntaxKind.NumericLiteral
			) {
				key = String(
					(
						nameNode as Node & { getLiteralValue: () => string | number }
					).getLiteralValue(),
				);
			} else if (nameNode.getKind() === SyntaxKind.Identifier) {
				key = nameNode.getText();
			} else {
				return undefined;
			}

			const initializer = propAssign.getInitializer();
			if (!initializer) {
				return undefined;
			}
			const isExplicitUndefined =
				initializer.getKind() === SyntaxKind.UndefinedKeyword ||
				(initializer.getKind() === SyntaxKind.Identifier &&
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
