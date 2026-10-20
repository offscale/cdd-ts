/**
 * TypeORM parser implementation extracting OpenAPI schema definitions from `@Entity()` classes using AST TypeNode inspection.
 *
 * @module vendors/typeorm/parse
 */
import {
	type ClassDeclaration,
	type Project,
	type PropertyDeclaration,
	SyntaxKind,
	type TypeNode,
} from "ts-morph";
import type { IOrmParser } from "../../core/orm/index.js";
import type { SwaggerDefinition } from "../../core/types/openapi.js";

/**
 * TypeORM parser implementation.
 * Parses classes decorated with `@Entity()` and converts their properties into OpenAPI schema definitions.
 */
export class TypeOrmParser implements IOrmParser {
	/**
	 * Parses the given ts-morph project and returns extracted TypeORM entities as OpenAPI schemas.
	 * @param project - The active ts-morph project containing the TypeScript TypeORM entities.
	 * @returns A dictionary of OpenAPI SwaggerDefinitions extracted from the code.
	 */
	public parse(project: Project): Record<string, SwaggerDefinition | boolean> {
		const schemas: Record<string, SwaggerDefinition> = {};
		const sourceFiles = project.getSourceFiles();

		for (const sourceFile of sourceFiles) {
			const classes = sourceFile.getClasses();
			for (const cls of classes) {
				if (this.isEntityClass(cls)) {
					const schemaName = cls.getName();
					if (schemaName) {
						schemas[schemaName] = this.parseEntity(cls);
					}
				}
			}
		}

		return schemas;
	}

	/**
	 * Checks if a class is decorated with `@Entity`.
	 * @param cls - The class declaration to check.
	 * @returns True if the class is a TypeORM entity.
	 */
	private isEntityClass(cls: ClassDeclaration): boolean {
		return cls.getDecorators().some((d) => d.getName() === "Entity");
	}

	/**
	 * Parses a TypeORM entity class into a SwaggerDefinition.
	 * @param cls - The class declaration representing the entity.
	 * @returns An OpenAPI SwaggerDefinition representing the entity.
	 */
	private parseEntity(cls: ClassDeclaration): SwaggerDefinition {
		const schemaProps: Record<string, SwaggerDefinition | boolean> = {};
		const schema: SwaggerDefinition = {
			type: "object",
			properties: schemaProps,
			required: [],
		};

		const requiredProps: string[] = [];

		const properties = cls.getProperties();
		for (const prop of properties) {
			if (this.isColumnProperty(prop)) {
				const propName = prop.getName();
				const definition = this.mapPropertyToDefinition(prop);
				schemaProps[propName] = definition;

				if (!prop.hasQuestionToken()) {
					requiredProps.push(propName);
				}
			}
		}

		if (requiredProps.length > 0) {
			schema.required = requiredProps;
		} else {
			delete schema.required;
		}

		return schema;
	}

	/**
	 * Checks if a property is a TypeORM column (decorated with `@Column`, `@PrimaryGeneratedColumn`, etc.).
	 * @param prop - The property declaration to check.
	 * @returns True if the property is a TypeORM column.
	 */
	private isColumnProperty(prop: PropertyDeclaration): boolean {
		const decoratorNames = [
			"Column",
			"PrimaryGeneratedColumn",
			"PrimaryColumn",
			"CreateDateColumn",
			"UpdateDateColumn",
			"DeleteDateColumn",
			"VersionColumn",
		];
		return prop
			.getDecorators()
			.some((d) => decoratorNames.includes(d.getName()));
	}

	/**
	 * Maps a TypeORM property declaration to an OpenAPI schema definition using its AST `TypeNode`.
	 * @param prop - The property declaration to inspect.
	 * @returns An OpenAPI SwaggerDefinition representing the property's type.
	 */
	private mapPropertyToDefinition(
		prop: PropertyDeclaration,
	): SwaggerDefinition {
		const typeNode = prop.getTypeNode();
		return this.mapTypeNodeToDefinition(typeNode);
	}

	/**
	 * Maps a TypeScript AST `TypeNode` to an OpenAPI schema definition.
	 * @param typeNode - The AST type node (or undefined).
	 * @returns An OpenAPI SwaggerDefinition representing the type.
	 */
	private mapTypeNodeToDefinition(
		typeNode: TypeNode | undefined,
	): SwaggerDefinition {
		if (!typeNode) {
			return { type: "object" };
		}

		const kind = typeNode.getKind();
		if (kind === SyntaxKind.StringKeyword) {
			return { type: "string" };
		}
		if (kind === SyntaxKind.NumberKeyword) {
			return { type: "number" };
		}
		if (kind === SyntaxKind.BooleanKeyword) {
			return { type: "boolean" };
		}
		if (kind === SyntaxKind.ArrayType) {
			const elemNode = (
				typeNode as TypeNode & { getElementTypeNode: () => TypeNode }
			).getElementTypeNode();
			return {
				type: "array",
				items: this.mapTypeNodeToDefinition(elemNode),
			};
		}
		if (kind === SyntaxKind.TypeReference) {
			const refNode = typeNode as TypeNode & {
				getTypeName: () => { getText: () => string };
				getTypeArguments: () => TypeNode[];
			};
			const typeName = refNode.getTypeName().getText().trim();
			if (typeName === "Date") {
				return { type: "string", format: "date-time" };
			}
			if (typeName === "Array") {
				const typeArgs = refNode.getTypeArguments();
				return {
					type: "array",
					items: this.mapTypeNodeToDefinition(typeArgs[0]),
				};
			}
		}

		return { type: "object" };
	}
}
