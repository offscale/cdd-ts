/**
 * Reconstructs OpenAPI schemas from TypeScript `interface` declarations, object literals, tuples, and type references.
 *
 * @module classes/parse_interfaces
 */
import {
	type ArrayTypeNode,
	type IndexSignatureDeclaration,
	type InterfaceDeclaration,
	type IntersectionTypeNode,
	type LiteralTypeNode,
	Node,
	type ParenthesizedTypeNode,
	type PropertySignature,
	SyntaxKind,
	type TupleTypeNode,
	type TypeLiteralNode,
	type TypeNode,
	type TypeOperatorTypeNode,
	type TypeReferenceNode,
	type UnionTypeNode,
} from "ts-morph";
import type { SwaggerDefinition } from "../core/types/index.js";
import {
	schemaFromIntersection,
	schemaFromLiteral,
	schemaFromUnion,
} from "./parse_enums_unions.js";
import { applyDocs } from "./parse_jsdoc_constraints.js";

/**
 * Reconstructs an OpenAPI object schema (with optional `allOf` inheritance) from a TypeScript `InterfaceDeclaration`.
 *
 * @param interfaceDecl - AST `InterfaceDeclaration`.
 * @returns Reconstructed `SwaggerDefinition`.
 */
export function schemaFromInterface(
	interfaceDecl: InterfaceDeclaration,
): SwaggerDefinition {
	const ownSchema = buildObjectSchema(
		interfaceDecl.getProperties(),
		interfaceDecl.getIndexSignatures(),
	);

	const extendsTypes = interfaceDecl
		.getExtends()
		.map((e) => e.getExpression().getText())
		.filter(Boolean);

	let schema: SwaggerDefinition = ownSchema;

	if (extendsTypes.length > 0) {
		const refs = extendsTypes.map((name) => ({
			$ref: `#/components/schemas/${name}`,
		}));

		if (
			Object.keys(ownSchema).length > 0 &&
			Object.keys(ownSchema.properties || {}).length > 0
		) {
			schema = { allOf: [...refs, ownSchema] };
		} else if (
			Object.keys(ownSchema).length > 0 &&
			ownSchema.additionalProperties
		) {
			schema = { allOf: [...refs, ownSchema] };
		} else {
			schema = { allOf: refs };
		}
	}

	applyDocs(schema, interfaceDecl);
	return schema;
}

/**
 * Builds an OpenAPI `object` schema from AST property signatures and index signatures.
 *
 * @param properties - Array of `PropertySignature` AST nodes.
 * @param indexSignatures - Array of `IndexSignatureDeclaration` AST nodes.
 * @returns Reconstructed `SwaggerDefinition`.
 */
export function buildObjectSchema(
	properties: PropertySignature[],
	indexSignatures: IndexSignatureDeclaration[],
): SwaggerDefinition {
	const schema: SwaggerDefinition = { type: "object" };
	const props: Record<string, SwaggerDefinition | boolean> = {};
	const required: string[] = [];

	properties.forEach((prop) => {
		const name = normalizePropertyName(prop);
		const typeNode = prop.getTypeNode();
		const propSchema = typeNode ? schemaFromTypeNode(typeNode) : {};

		applyDocs(propSchema, prop);

		if (prop.isReadonly()) propSchema.readOnly = true;
		if (!prop.hasQuestionToken()) required.push(name);

		props[name] = propSchema;
	});

	if (Object.keys(props).length > 0) {
		schema.properties = props;
	}

	if (required.length > 0) {
		schema.required = required;
	}

	const indexSignature = indexSignatures[0];
	if (indexSignature) {
		const returnTypeNode = indexSignature.getReturnTypeNode() as TypeNode;
		schema.additionalProperties = schemaFromTypeNode(returnTypeNode);
	}

	return schema;
}

function normalizePropertyName(prop: PropertySignature): string {
	const nameNode = prop.getNameNode();
	if (
		Node.isStringLiteral(nameNode) ||
		Node.isNoSubstitutionTemplateLiteral(nameNode)
	) {
		return nameNode.getLiteralText();
	}
	return prop.getName();
}

/**
 * Converts a `ts-morph` `TypeNode` into an equivalent OpenAPI `SwaggerDefinition` schema.
 *
 * @param node - The TypeScript AST type node to convert.
 * @returns The reconstructed `SwaggerDefinition`.
 */
export function schemaFromTypeNode(node: TypeNode): SwaggerDefinition {
	switch (node.getKind()) {
		case SyntaxKind.StringKeyword:
			return { type: "string" };
		case SyntaxKind.NumberKeyword:
			return { type: "number" };
		case SyntaxKind.BooleanKeyword:
			return { type: "boolean" };
		case SyntaxKind.LiteralType:
			return schemaFromLiteral(node as LiteralTypeNode);
		case SyntaxKind.ArrayType: {
			const arrayNode = node as ArrayTypeNode;
			return {
				type: "array",
				items: schemaFromTypeNode(arrayNode.getElementTypeNode()),
			};
		}
		case SyntaxKind.TupleType: {
			const tupleNode = node as TupleTypeNode;
			return schemaFromTupleType(tupleNode);
		}
		case SyntaxKind.TypeReference:
			return schemaFromTypeReference(node as TypeReferenceNode);
		case SyntaxKind.UnionType:
			return schemaFromUnion(node as UnionTypeNode);
		case SyntaxKind.IntersectionType:
			return schemaFromIntersection(node as IntersectionTypeNode);
		case SyntaxKind.TypeLiteral:
			return buildObjectSchema(
				(node as TypeLiteralNode).getMembers().filter(Node.isPropertySignature),
				(node as TypeLiteralNode)
					.getMembers()
					.filter(Node.isIndexSignatureDeclaration),
			);
		case SyntaxKind.ParenthesizedType:
			return schemaFromTypeNode((node as ParenthesizedTypeNode).getTypeNode());
		case SyntaxKind.TypeOperator:
			return schemaFromTypeNode((node as TypeOperatorTypeNode).getTypeNode());
		default:
			return {};
	}
}

function schemaFromTypeReference(node: TypeReferenceNode): SwaggerDefinition {
	const typeName = node.getTypeName().getText();
	const typeArgs = node.getTypeArguments();

	if (
		typeName === "Array" ||
		typeName === "ReadonlyArray" ||
		typeName === "Set"
	) {
		const elementType = typeArgs[0] ? schemaFromTypeNode(typeArgs[0]) : {};
		return { type: "array", items: elementType };
	}

	if (typeName === "Record" || typeName === "Map") {
		const valueType = typeArgs[1] ? schemaFromTypeNode(typeArgs[1]) : {};
		return { type: "object", additionalProperties: valueType };
	}

	if (typeName === "Date") return { type: "string", format: "date-time" };
	if (typeName === "Blob" || typeName === "File")
		return { type: "string", format: "binary" };

	return { $ref: `#/components/schemas/${typeName}` };
}

function schemaFromTupleType(tupleNode: TupleTypeNode): SwaggerDefinition {
	const elements = tupleNode.getElements();
	const prefixItems: (SwaggerDefinition | boolean)[] = [];
	let restSchema: SwaggerDefinition | boolean | undefined;
	let minItems = 0;
	let sawOptional = false;

	for (const element of elements) {
		let isOptional = false;
		let typeNode: TypeNode;

		if (Node.isNamedTupleMember(element)) {
			isOptional = element.hasQuestionToken();
			if (element.getDotDotDotToken()) {
				restSchema = schemaFromTypeNode(element.getTypeNode());
				continue;
			}
			typeNode = element.getTypeNode();
		} else if (Node.isRestTypeNode(element)) {
			restSchema = schemaFromTypeNode(element.getTypeNode());
			continue;
		} else {
			isOptional =
				element.getKind() === SyntaxKind.OptionalType ||
				element.getText().endsWith("?");
			const childType =
				element.getKind() === SyntaxKind.OptionalType
					? element.getChildren().find((c) => Node.isTypeNode(c))
					: undefined;
			typeNode = childType ?? element;
		}

		prefixItems.push(schemaFromTypeNode(typeNode));

		if (!isOptional && !sawOptional) {
			minItems += 1;
		} else {
			sawOptional = true;
		}
	}

	if (prefixItems.length === 0 && restSchema) {
		const inner = (restSchema as SwaggerDefinition).items;
		return { type: "array", items: (inner as SwaggerDefinition) ?? restSchema };
	}

	const schema: SwaggerDefinition = { type: "array", prefixItems };

	if (restSchema) {
		const restItems = (restSchema as SwaggerDefinition).items;
		if (typeof restItems === "object") {
			restSchema = restItems as SwaggerDefinition;
		}
		if (minItems > 0) schema.minItems = minItems;
		schema.items = restSchema;
		return schema;
	}

	if (prefixItems.length > 0) {
		schema.minItems = minItems;
		schema.maxItems = prefixItems.length;
		schema.items = false;
	}

	return schema;
}
