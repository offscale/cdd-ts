/**
 * Emits TypeScript `interface` declarations and `*Request` variants for object schemas.
 *
 * @module classes/emit_interfaces
 */
import type { SourceFile } from "ts-morph";
import type {
	GeneratorConfig,
	OpenApiValue,
	SwaggerDefinition,
} from "../core/types/index.js";
import { pascalCase } from "../functions/utils.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { buildSchemaJSDoc } from "./emit_enums.js";
import {
	applyComposition,
	applyIndexSignature,
	getInterfaceProperties,
	needsRequestModel,
} from "./emit_request_variants.js";

/**
 * Determines whether a schema definition should be emitted as a TypeScript `interface` rather than a `type` alias.
 *
 * @param def - OpenAPI schema definition or boolean schema.
 * @returns `true` if an `interface` declaration should be emitted.
 */
export function shouldGenerateInterface(def: SwaggerDefinition): boolean {
	if (def.anyOf || def.oneOf) return false;
	if (
		def.dependentSchemas ||
		(def as Record<string, OpenApiValue>).dependentRequired
	)
		return false;

	return (
		def.type === "object" ||
		!!def.properties ||
		!!def.allOf ||
		!!def.patternProperties
	);
}

/**
 * Emits a TypeScript `interface` declaration (and optional `*Request` variant) for an object schema.
 *
 * @param sourceFile - Target `SourceFile`.
 * @param name - Raw schema name.
 * @param def - Object OpenAPI schema definition.
 * @param config - Active generator configuration.
 * @param parser - Parsed OpenAPI specification.
 */
export function generateInterface(
	sourceFile: SourceFile,
	name: string,
	def: SwaggerDefinition,
	config: GeneratorConfig,
	parser: SwaggerParser,
): void {
	const modelName = pascalCase(name);
	const responseProps = getInterfaceProperties(
		def,
		{ excludeWriteOnly: true },
		config,
		parser,
	);

	const interfaceDecl = sourceFile.addInterface({
		name: modelName,
		isExported: true,
		properties: responseProps,
		docs: buildSchemaJSDoc(def),
	});

	applyComposition(
		interfaceDecl,
		def,
		{ excludeWriteOnly: true },
		config,
		parser,
	);
	applyIndexSignature(interfaceDecl, def, config, parser);

	if (needsRequestModel(def, parser)) {
		const requestProps = getInterfaceProperties(
			def,
			{ excludeReadOnly: true },
			config,
			parser,
		);

		const requestDecl = sourceFile.addInterface({
			name: `${modelName}Request`,
			isExported: true,
			properties: requestProps,
			docs: buildSchemaJSDoc({
				...def,
				description: `Model for sending ${modelName} data (excludes read-only fields).`,
			}),
		});

		applyComposition(
			requestDecl,
			def,
			{ excludeReadOnly: true },
			config,
			parser,
		);
		applyIndexSignature(requestDecl, def, config, parser);
	}
}
