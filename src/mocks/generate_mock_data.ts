/**
 * Generates deterministic mock JSON payloads from OpenAPI schemas for generated SDK and server tests.
 *
 * @module mocks/generate_mock_data
 */
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveLogger, type SwaggerDefinition } from "../core/types/index.js";
import { pascalCase } from "../functions/utils_string.js";
import type { SwaggerParser } from "../openapi/parse.js";

/**
 * Dictionary of mock values indexed by property name.
 */
export interface MockValueObject {
	/** Mock value for the given property key. */
	[key: string]: MockValue;
}

/**
 * Recursive type representing a generated mock data value.
 */
export type MockValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| MockValue[]
	| MockValueObject;

type JsonSchemaType =
	| "object"
	| "array"
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "null";

/**
 * Generates deterministic mock values from OpenAPI / JSON Schema definitions.
 */
export class MockDataGenerator {
	/**
	 * Creates a new `MockDataGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification instance.
	 */
	constructor(private parser: SwaggerParser) {}

	/**
	 * Generates a serialized JSON mock string for the specified schema name.
	 *
	 * @param schemaName - The name of the schema in `components.schemas` or `definitions`.
	 * @returns A JSON string representing a valid mock instance of the schema.
	 */
	public generate(schemaName: string): string {
		const normalizedName = pascalCase(schemaName);
		const schemaDef =
			this.parser.schemas.find((s) => s.name === normalizedName)?.definition ??
			this.parser.getDefinition(schemaName) ??
			(schemaName !== normalizedName
				? this.parser.getDefinition(normalizedName)
				: undefined);

		if (!schemaDef) {
			return "{}";
		}

		const value = this.generateValue(
			schemaDef as SwaggerDefinition,
			new Set<SwaggerDefinition>(),
		);

		return JSON.stringify(value === undefined ? {} : value);
	}

	/**
	 * Recursively generates a `MockValue` for a given `SwaggerDefinition`.
	 *
	 * @param schema - The schema definition to generate a value for.
	 * @param visited - Set of visited schema references to prevent infinite recursion on circular schemas.
	 * @param maxDepth - Maximum recursion depth.
	 * @returns A generated `MockValue`.
	 */
	public generateValue(
		schema: SwaggerDefinition | undefined,
		visited: Set<SwaggerDefinition>,
		maxDepth: number = 10,
	): MockValue {
		if (!schema || maxDepth <= 0) {
			return undefined;
		}

		if (visited.has(schema)) {
			return {};
		}

		visited.add(schema);

		try {
			if (schema.$ref) {
				let resolved = this.parser.resolve<SwaggerDefinition>(schema);

				if (!resolved) {
					const refName = this.extractRefName(schema.$ref);

					const fallback = refName
						? this.parser.getDefinition(refName)
						: undefined;

					if (fallback && typeof fallback === "object") {
						resolved = fallback as SwaggerDefinition;
					}
				}

				return resolved
					? this.generateValue(
							resolved as SwaggerDefinition,
							visited,
							maxDepth - 1,
						)
					: maxDepth === 10
						? undefined
						: null;
			}

			const schemaRecord = schema as Record<string, MockValue>;

			if (schemaRecord.dataValue !== undefined) {
				return schemaRecord.dataValue;
			}

			if (schemaRecord.value !== undefined) {
				return schemaRecord.value;
			}

			if (schemaRecord.serializedValue !== undefined) {
				return schemaRecord.serializedValue;
			}

			if (typeof schemaRecord.externalValue === "string") {
				return this.resolveExternalValue(schemaRecord.externalValue);
			}

			if (schema.example !== undefined) {
				return schema.example as MockValue;
			}

			if (Array.isArray(schema.examples) && schema.examples.length > 0) {
				return schema.examples[0] as MockValue;
			}

			if (schema.enum && schema.enum.length > 0) {
				return schema.enum[0] as MockValue;
			}

			if (schema.allOf) {
				const mergedObj: Record<string, MockValue> = {};
				for (const subSchema of schema.allOf) {
					const val = this.generateValue(
						subSchema as SwaggerDefinition,
						new Set(visited),
						maxDepth - 1,
					);

					if (typeof val === "object" && val !== null && !Array.isArray(val)) {
						Object.assign(mergedObj, val);
					}
				}

				return mergedObj;
			}

			const type = this.normalizeType(schema);

			switch (type) {
				case "object":
					return this.generateObjectValue(schema, visited, maxDepth);
				case "array":
					return this.generateArrayValue(schema, visited, maxDepth);
				case "boolean":
					return typeof schema.default === "boolean" ? schema.default : true;
				case "string":
					return this.generateStringValue(schema);
				case "number":
				case "integer":
					return this.generateNumberValue(schema);
				case "null":
					return maxDepth === 10 ? null : undefined;
				default: {
					const subSchema = schema.oneOf?.[0] || schema.anyOf?.[0];

					if (subSchema) {
						return this.generateValue(
							subSchema as SwaggerDefinition,
							visited,
							maxDepth - 1,
						);
					}

					return undefined;
				}
			}
		} finally {
			visited.delete(schema);
		}
	}

	/**
	 * Extracts the trailing schema name from a JSON Reference URI.
	 *
	 * @param ref - JSON Reference URI string.
	 * @returns Extracted schema name, or `undefined` if not a local fragment reference.
	 */
	public extractRefName(ref: string): string | undefined {
		if (!ref) return undefined;

		const fragment = ref.split("#")[1];

		if (!fragment) return undefined;

		const parts = fragment.split("/").filter(Boolean);

		const last = parts[parts.length - 1];

		if (!last) return undefined;

		return last.replace(/~1/g, "/").replace(/~0/g, "~");
	}

	private resolveExternalValue(externalValue: string): MockValue {
		try {
			if (
				externalValue.startsWith("http://") ||
				externalValue.startsWith("https://")
			) {
				return `URL Content: ${externalValue}`;
			}

			const base = this.parser.documentUri || `file://${process.cwd()}/`;

			const resolvedUrl = new URL(externalValue, base);

			if (
				resolvedUrl.protocol === "http:" ||
				resolvedUrl.protocol === "https:"
			) {
				return `URL Content: ${resolvedUrl.href}`;
			}

			if (resolvedUrl.protocol === "file:") {
				const filePath = fileURLToPath(resolvedUrl.href);

				if (fs.existsSync(filePath)) {
					const content = fs.readFileSync(filePath, "utf-8");

					try {
						return JSON.parse(content) as MockValue;
					} catch {
						return content;
					}
				}
			}
		} catch (e) {
			resolveLogger(this.parser.config).warn(
				`Failed to resolve externalValue: ${externalValue}`,
				e,
			);
		}

		return `External Content: ${externalValue}`;
	}

	private normalizeType(schema: SwaggerDefinition): JsonSchemaType | undefined {
		const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

		return (type ||
			(schema.properties ? "object" : undefined)) as JsonSchemaType;
	}

	private generateObjectValue(
		schema: SwaggerDefinition,
		visited: Set<SwaggerDefinition>,
		maxDepth: number,
	): Record<string, MockValue> {
		if (!schema.properties) {
			return {};
		}

		const obj: Record<string, MockValue> = {};

		for (const [key, propSchema] of Object.entries(schema.properties)) {
			if (!(propSchema as SwaggerDefinition).readOnly) {
				const propValue = this.generateValue(
					propSchema as SwaggerDefinition,
					new Set(visited),
					maxDepth - 1,
				);

				if (propValue !== undefined) {
					obj[key] = propValue;
				}
			}
		}

		return obj;
	}

	private generateArrayValue(
		schema: SwaggerDefinition,
		visited: Set<SwaggerDefinition>,
		maxDepth: number,
	): MockValue[] {
		if (!schema.items || Array.isArray(schema.items)) {
			return [];
		}

		const itemValue = this.generateValue(
			schema.items as SwaggerDefinition,
			new Set(visited),
			maxDepth - 1,
		);

		return itemValue !== undefined ? [itemValue] : [];
	}

	private generateStringValue(schema: SwaggerDefinition): string {
		if (schema.contentEncoding === "base64") {
			return "dGVzdC1jb250ZW50";
		}

		if (schema.contentEncoding === "base64url") {
			return "dGVzdC1jb250ZW50";
		}

		switch (schema.format) {
			case "date-time":
			case "date":
				return "new globalThis.Date()";
			case "email":
				return "test@example.com";
			case "uuid":
				return "123e4567-e89b-12d3-a456-426614174000";
			case "password":
				return "StrongPassword123!";
			default:
				return typeof schema.default === "string"
					? schema.default
					: "string-value";
		}
	}

	private generateNumberValue(schema: SwaggerDefinition): number {
		if (typeof schema.minimum !== "undefined") {
			return schema.minimum;
		}

		if (typeof schema.default === "number") {
			return schema.default;
		}

		return schema.type === "integer" ? 123 : 123.45;
	}
}
