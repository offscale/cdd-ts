/**
 * Reconstructs OpenAPI schemas from TypeScript `enum`, `type` alias, union, intersection, and literal AST nodes.
 *
 * @module classes/parse_enums_unions
 */
import {
	type EnumDeclaration,
	type IntersectionTypeNode,
	type LiteralTypeNode,
	Node,
	SyntaxKind,
	type TypeAliasDeclaration,
	type TypeNode,
	type TypeReferenceNode,
	type UnionTypeNode,
} from "ts-morph";
import type { OpenApiValue, SwaggerDefinition } from "../core/types/index.js";
import { schemaFromTypeNode } from "./parse_interfaces.js";
import { applyDocs } from "./parse_jsdoc_constraints.js";

/**
 * Reconstructs an OpenAPI schema from a TypeScript `EnumDeclaration`.
 *
 * @param enumDecl - AST `EnumDeclaration`.
 * @returns Reconstructed `SwaggerDefinition`.
 */
export function schemaFromEnum(enumDecl: EnumDeclaration): SwaggerDefinition {
	const values = enumDecl.getMembers().map((member) => {
		const value = member.getValue();
		if (value !== undefined) return value;

		const init = member.getInitializer();
		if (!init) return member.getName();

		if (
			Node.isStringLiteral(init) ||
			Node.isNoSubstitutionTemplateLiteral(init)
		) {
			return init.getLiteralText();
		}

		if (Node.isNumericLiteral(init)) {
			return Number(init.getText());
		}

		if (init.getKind() === SyntaxKind.TrueKeyword) return true;
		if (init.getKind() === SyntaxKind.FalseKeyword) return false;

		return init.getText();
	});

	const allNumbers = values.every((v) => typeof v === "number");
	const allStrings = values.every((v) => typeof v === "string");

	const schema: SwaggerDefinition = {
		enum: values as (string | number)[],
		...(allNumbers ? { type: "number" } : allStrings ? { type: "string" } : {}),
	};

	applyDocs(schema, enumDecl);
	return schema;
}

/**
 * Reconstructs an OpenAPI schema or boolean schema from a TypeScript `TypeAliasDeclaration`.
 *
 * @param aliasDecl - AST `TypeAliasDeclaration`.
 * @returns Reconstructed `SwaggerDefinition` or boolean schema.
 */
export function schemaFromTypeAlias(
	aliasDecl: TypeAliasDeclaration,
): SwaggerDefinition | boolean {
	for (const doc of aliasDecl.getJsDocs()) {
		for (const tag of doc.getTags()) {
			if (tag.getTagName().toLowerCase() === "booleanschema") {
				const text = (tag.getCommentText() || "").trim().toLowerCase();
				if (text === "true") return true;
				if (text === "false") return false;
			}
		}
	}

	const typeNode = aliasDecl.getTypeNodeOrThrow();
	if (typeNode.getKind() === SyntaxKind.VoidKeyword) {
		return false;
	}

	const schema = schemaFromTypeNode(typeNode);
	applyDocs(schema, aliasDecl);
	return schema;
}

/**
 * Reconstructs a constant OpenAPI schema from a TypeScript `LiteralTypeNode`.
 *
 * @param node - AST `LiteralTypeNode`.
 * @returns Reconstructed `SwaggerDefinition`.
 */
export function schemaFromLiteral(node: LiteralTypeNode): SwaggerDefinition {
	const literal = node.getLiteral();

	if (
		Node.isStringLiteral(literal) ||
		Node.isNoSubstitutionTemplateLiteral(literal)
	) {
		return { type: "string", const: literal.getLiteralText() };
	}

	if (Node.isNumericLiteral(literal)) {
		return { type: "number", const: Number(literal.getText()) };
	}

	if (literal.getKind() === SyntaxKind.TrueKeyword) {
		return { type: "boolean", const: true };
	}

	if (literal.getKind() === SyntaxKind.FalseKeyword) {
		return { type: "boolean", const: false };
	}

	if (literal.getKind() === SyntaxKind.NullKeyword) {
		return { type: "null", const: null };
	}

	return {};
}

/**
 * Reconstructs an OpenAPI schema (`enum`, `anyOf`, or nullable type) from a TypeScript `UnionTypeNode`.
 *
 * @param node - AST `UnionTypeNode`.
 * @returns Reconstructed `SwaggerDefinition`.
 */
export function schemaFromUnion(node: UnionTypeNode): SwaggerDefinition {
	const typeNodes = node.getTypeNodes();
	let includesNull = false;
	const filtered: TypeNode[] = [];

	typeNodes.forEach((typeNode) => {
		if (isNullTypeNode(typeNode)) {
			includesNull = true;
			return;
		}
		if (isUndefinedTypeNode(typeNode)) {
			return;
		}
		filtered.push(typeNode);
	});

	const firstNode = filtered[0];
	if (!firstNode) {
		return includesNull ? { type: "null" } : {};
	}

	if (filtered.length === 1) {
		const schema = schemaFromTypeNode(firstNode);
		return includesNull ? applyNullability(schema) : schema;
	}

	if (allLiteralTypes(filtered)) {
		const literals = filtered.map((typeNode) => schemaFromTypeNode(typeNode));
		const enumValues = extractEnumValues(literals);
		if (includesNull) enumValues.push(null);

		const types = extractLiteralTypes(literals);
		if (includesNull) types.add("null");

		const schema: SwaggerDefinition = { enum: enumValues };
		if (types.size === 1) {
			const [onlyType] = Array.from(types);
			(schema as { type?: string | string[] }).type = onlyType as string;
		} else {
			(schema as { type?: string | string[] }).type = Array.from(types);
		}
		return schema;
	}

	const anyOf = filtered.map(schemaFromTypeNode);
	if (includesNull) anyOf.push({ type: "null" });

	return { anyOf };
}

/**
 * Reconstructs an `allOf` OpenAPI schema from a TypeScript `IntersectionTypeNode`.
 *
 * @param node - AST `IntersectionTypeNode`.
 * @returns Reconstructed `SwaggerDefinition`.
 */
export function schemaFromIntersection(
	node: IntersectionTypeNode,
): SwaggerDefinition {
	const allOf = node.getTypeNodes().map(schemaFromTypeNode);
	return { allOf };
}

function isNullTypeNode(node: TypeNode): boolean {
	return (
		Node.isLiteralTypeNode(node) &&
		node.getLiteral().getKind() === SyntaxKind.NullKeyword
	);
}

function isUndefinedTypeNode(node: TypeNode): boolean {
	if (node.getKind() === SyntaxKind.UndefinedKeyword) return true;
	if (node.getKind() === SyntaxKind.TypeReference) {
		return (node as TypeReferenceNode).getTypeName().getText() === "undefined";
	}
	return false;
}

function allLiteralTypes(nodes: TypeNode[]): boolean {
	return nodes.every((node) => node.getKind() === SyntaxKind.LiteralType);
}

function extractEnumValues(literals: SwaggerDefinition[]): OpenApiValue[] {
	const values: OpenApiValue[] = [];
	literals.forEach((schema) => {
		if (schema.const !== undefined) {
			values.push(schema.const);
		}
	});
	return values;
}

function extractLiteralTypes(literals: SwaggerDefinition[]): Set<string> {
	const types = new Set<string>();
	literals.forEach((schema) => {
		if (typeof schema.type === "string") {
			types.add(schema.type);
		}
	});
	return types;
}

function applyNullability(schema: SwaggerDefinition): SwaggerDefinition {
	if ("$ref" in schema) {
		return { anyOf: [schema, { type: "null" }] };
	}

	if (schema.type) {
		const existing = [schema.type as string, "null"];

		const cloned: SwaggerDefinition = { ...schema };
		cloned.type = existing as (
			| "string"
			| "number"
			| "integer"
			| "boolean"
			| "object"
			| "array"
			| "null"
		)[];
		return cloned;
	}

	if (schema.anyOf) {
		return { ...schema, anyOf: [...schema.anyOf, { type: "null" }] };
	}

	return { anyOf: [schema, { type: "null" }] };
}
