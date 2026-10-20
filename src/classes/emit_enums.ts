/**
 * Emits TypeScript `enum` declarations, `type` aliases, and JSDoc annotations for OpenAPI schemas.
 *
 * @module classes/emit_enums
 */
import type {
	JSDocStructure,
	JSDocTagStructure,
	OptionalKind,
	SourceFile,
} from "ts-morph";
import type {
	GeneratorConfig,
	OpenApiValue,
	SwaggerDefinition,
} from "../core/types/index.js";
import {
	getTypeScriptType,
	pascalCase,
	sanitizeComment,
} from "../functions/utils.js";
import type { SwaggerParser } from "../openapi/parse.js";

/**
 * Emits a TypeScript `enum` or literal union `type` alias for an enumerated schema.
 *
 * @param sourceFile - Target `SourceFile`.
 * @param name - Raw schema name.
 * @param def - Enumerated OpenAPI schema definition.
 * @param config - Active generator configuration.
 */
export function generateEnum(
	sourceFile: SourceFile,
	name: string,
	def: SwaggerDefinition,
	config: GeneratorConfig,
): void {
	const enumStyle = config.options.enumStyle || "enum";
	const values = def.enum as NonNullable<SwaggerDefinition["enum"]>;

	if (values.length === 0) {
		sourceFile.addTypeAlias({
			name: pascalCase(name),
			isExported: true,
			type: "string | number | boolean | object | undefined | null",
			docs: buildSchemaJSDoc(def),
		});
		return;
	}

	const allStrings = values.every((v) => typeof v === "string");

	if (enumStyle === "union" || !allStrings) {
		sourceFile.addTypeAlias({
			name: pascalCase(name),
			isExported: true,
			type: values
				.map((v) => (typeof v === "string" ? `'${v}'` : v))
				.join(" | "),
			docs: buildSchemaJSDoc(def),
		});
	} else {
		sourceFile.addEnum({
			name: pascalCase(name),
			isExported: true,
			members: values.map((v) => {
				const valStr = String(v);
				const key = valStr.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
				const safeKey = /^[0-9]/.test(key) ? `_${key}` : key;
				return { name: safeKey, value: v as string };
			}),
			docs: buildSchemaJSDoc(def),
		});
	}
}

/**
 * Emits a TypeScript `type` alias declaration for a schema definition.
 *
 * @param sourceFile - Target `SourceFile`.
 * @param name - Raw schema name.
 * @param def - OpenAPI schema definition or boolean schema.
 * @param config - Active generator configuration.
 * @param parser - Parsed OpenAPI specification.
 */
export function generateTypeAlias(
	sourceFile: SourceFile,
	name: string,
	def: SwaggerDefinition | boolean,
	config: GeneratorConfig,
	parser: SwaggerParser,
): void {
	const type = getTypeScriptType(
		def as SwaggerDefinition,
		config,
		parser.schemas.map((s) => s.name),
	);

	sourceFile.addTypeAlias({
		name: pascalCase(name),
		isExported: true,
		type: type,
		docs: buildSchemaJSDoc(def),
	});
}

/**
 * Builds `ts-morph` JSDoc structures preserving OpenAPI validation keywords and vendor extensions.
 *
 * @param def - OpenAPI schema definition or boolean schema.
 * @returns Array of JSDoc structures.
 */
export function buildSchemaJSDoc(
	def: SwaggerDefinition | boolean,
): OptionalKind<JSDocStructure>[] {
	if (typeof def === "boolean") {
		return [
			{
				description: "",
				tags: [{ tagName: "booleanSchema", text: String(def) }],
			},
		];
	}

	const description = sanitizeComment(def.description || "");
	const tags: OptionalKind<JSDocTagStructure>[] = [];

	const pushTag = (
		tagName: string,
		value?: OpenApiValue,
		options?: { omitTrue?: boolean },
	) => {
		if (value === undefined) return;
		if (value === true && options?.omitTrue) {
			tags.push({ tagName });
			return;
		}
		const text =
			typeof value === "string"
				? value
				: typeof value === "number" || typeof value === "boolean"
					? String(value)
					: JSON.stringify(value);
		tags.push({ tagName, text });
	};

	const rawDef = def as Record<string, OpenApiValue>;

	if (rawDef.deprecated) tags.push({ tagName: "deprecated" });

	if (def.example !== undefined) {
		tags.push({
			tagName: "example",
			text: JSON.stringify(def.example, null, 2),
		});
	}

	if (def.examples && Array.isArray(def.examples)) {
		def.examples.forEach((ex) => {
			tags.push({ tagName: "example", text: JSON.stringify(ex, null, 2) });
		});
	}

	if (def.default !== undefined)
		tags.push({ tagName: "default", text: JSON.stringify(def.default) });

	if (def.externalDocs?.url) {
		const desc = def.externalDocs.description
			? ` - ${sanitizeComment(def.externalDocs.description)}`
			: "";
		tags.push({ tagName: "see", text: `${def.externalDocs.url}${desc}` });
	}

	pushTag("minimum", def.minimum);
	pushTag("maximum", def.maximum);
	pushTag("exclusiveMinimum", def.exclusiveMinimum);
	pushTag("exclusiveMaximum", def.exclusiveMaximum);
	pushTag("minLength", def.minLength);
	pushTag("maxLength", def.maxLength);
	pushTag("pattern", def.pattern);
	pushTag("format", def.format);
	pushTag("multipleOf", def.multipleOf);
	pushTag("minItems", def.minItems);
	pushTag("maxItems", def.maxItems);
	pushTag("uniqueItems", def.uniqueItems);
	pushTag("minProperties", def.minProperties);
	pushTag("maxProperties", def.maxProperties);
	pushTag("propertyNames", rawDef.propertyNames);

	if (Object.hasOwn(rawDef, "additionalProperties")) {
		pushTag("additionalProperties", rawDef.additionalProperties);
	}

	pushTag("readOnly", def.readOnly, { omitTrue: true });
	pushTag("writeOnly", def.writeOnly, { omitTrue: true });
	pushTag("nullable", rawDef.nullable, { omitTrue: true });
	pushTag("title", def.title);
	pushTag("schemaDialect", rawDef.$schema);
	pushTag("schemaId", rawDef.$id);
	pushTag("schemaAnchor", rawDef.$anchor);
	pushTag("schemaDynamicAnchor", rawDef.$dynamicAnchor);
	pushTag("const", rawDef.const);
	pushTag("if", rawDef.if);
	pushTag("then", rawDef.then);
	pushTag("else", rawDef.else);
	pushTag("not", rawDef.not);
	pushTag("oneOf", rawDef.oneOf);
	pushTag("anyOf", rawDef.anyOf);
	pushTag("contains", rawDef.contains);
	pushTag("minContains", rawDef.minContains);
	pushTag("maxContains", rawDef.maxContains);
	pushTag("contentMediaType", rawDef.contentMediaType);
	pushTag("contentEncoding", rawDef.contentEncoding);
	pushTag("contentSchema", rawDef.contentSchema);
	pushTag("patternProperties", rawDef.patternProperties);
	pushTag("dependentSchemas", rawDef.dependentSchemas);
	pushTag("dependentRequired", rawDef.dependentRequired);
	pushTag("unevaluatedProperties", rawDef.unevaluatedProperties);
	pushTag("unevaluatedItems", rawDef.unevaluatedItems);
	pushTag("schemaDialect", rawDef.$schema);
	pushTag("schemaId", rawDef.$id);
	pushTag("schemaAnchor", rawDef.$anchor);
	pushTag("schemaDynamicAnchor", rawDef.$dynamicAnchor);
	pushTag("xml", rawDef.xml);
	pushTag("discriminator", rawDef.discriminator);

	const extensionEntries = Object.entries(rawDef).filter(
		([key, value]) => key.startsWith("x-") && value !== undefined,
	);

	extensionEntries.forEach(([key, value]) => {
		tags.push({ tagName: key, text: JSON.stringify(value) });
	});

	if (!description && tags.length === 0) return [];

	return [{ description, tags }];
}
