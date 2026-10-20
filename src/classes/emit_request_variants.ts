/**
 * Handles request/response model variant detection, property filtering, `allOf` inheritance, and index signatures.
 *
 * @module classes/emit_request_variants
 */
import type {
	InterfaceDeclaration,
	OptionalKind,
	PropertySignatureStructure,
} from "ts-morph";
import type {
	GeneratorConfig,
	SwaggerDefinition,
} from "../core/types/index.js";
import { getTypeScriptType, pascalCase } from "../functions/utils.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { buildSchemaJSDoc } from "./emit_enums.js";

/**
 * Checks whether an object schema requires a separate `*Request` interface due to `readOnly` or `writeOnly` properties.
 *
 * @param def - OpenAPI schema definition.
 * @param parser - Parsed OpenAPI specification.
 * @returns `true` if a separate request model interface should be emitted.
 */
export function needsRequestModel(
	def: SwaggerDefinition,
	parser: SwaggerParser,
): boolean {
	const hasDirect =
		def.properties &&
		Object.values(def.properties).some(
			(p) => typeof p === "object" && (p.readOnly || p.writeOnly),
		);

	if (hasDirect) return true;

	if (def.allOf) {
		return def.allOf.some((subObj) => {
			if (typeof subObj !== "object") return false;
			const sub = subObj as SwaggerDefinition;
			if (sub.$ref) {
				const resolved = parser.resolve(sub);
				return resolved
					? needsRequestModel(resolved as SwaggerDefinition, parser)
					: false;
			}
			return (
				sub.properties &&
				Object.values(sub.properties).some(
					(p) => typeof p === "object" && (p.readOnly || p.writeOnly),
				)
			);
		});
	}

	return false;
}

/**
 * Builds `ts-morph` property signature structures from a schema's `properties` map.
 *
 * @param def - OpenAPI schema definition.
 * @param options - Read-only / write-only filtering options.
 * @param config - Active generator configuration.
 * @param parser - Parsed OpenAPI specification.
 * @returns Array of property signature structures.
 */
export function getInterfaceProperties(
	def: SwaggerDefinition,
	options: {
		excludeReadOnly?: boolean;
		excludeWriteOnly?: boolean;
	},
	config: GeneratorConfig,
	parser: SwaggerParser,
): OptionalKind<PropertySignatureStructure>[] {
	const props: OptionalKind<PropertySignatureStructure>[] = [];

	if (def.properties) {
		Object.entries(def.properties).forEach(([propName, propDefObj]) => {
			if (typeof propDefObj !== "object") return;
			const propDef = propDefObj as SwaggerDefinition;
			if (options.excludeReadOnly && propDef.readOnly) return;
			if (options.excludeWriteOnly && propDef.writeOnly) return;

			const type = getTypeScriptType(
				propDef,
				config,
				parser.schemas.map((s) => s.name),
			);

			const isRequired = def.required?.includes(propName);
			const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName)
				? propName
				: `'${propName}'`;

			props.push({
				name: safeName,
				type: type,
				hasQuestionToken: !isRequired,
				docs: buildSchemaJSDoc(propDef),
				...(options.excludeWriteOnly && propDef.readOnly
					? { isReadonly: true }
					: {}),
			});
		});
	}

	return props;
}

/**
 * Applies `allOf` inheritance (`extends`) and inline property merging to an `InterfaceDeclaration`.
 *
 * @param interfaceDecl - Target `InterfaceDeclaration`.
 * @param def - OpenAPI schema definition containing `allOf`.
 * @param options - Read-only / write-only filtering options.
 * @param config - Active generator configuration.
 * @param parser - Parsed OpenAPI specification.
 */
export function applyComposition(
	interfaceDecl: InterfaceDeclaration,
	def: SwaggerDefinition,
	options: {
		excludeReadOnly?: boolean;
		excludeWriteOnly?: boolean;
	},
	config: GeneratorConfig,
	parser: SwaggerParser,
): void {
	if (def.allOf) {
		const extendsTypes: string[] = [];

		def.allOf.forEach((subObj) => {
			if (typeof subObj !== "object") return;
			const sub = subObj as SwaggerDefinition;

			if (sub.$ref) {
				let refName = pascalCase(sub.$ref.split("/").pop() || "");
				const refDef = parser.resolve(sub);
				if (
					refDef &&
					typeof refDef === "object" &&
					needsRequestModel(refDef as SwaggerDefinition, parser) &&
					options.excludeReadOnly
				) {
					refName = `${refName}Request`;
				}
				if (refName) extendsTypes.push(refName);
			} else if (sub.properties) {
				const inlineProps = getInterfaceProperties(
					sub,
					options,
					config,
					parser,
				);
				interfaceDecl.addProperties(inlineProps);
			}
		});

		if (extendsTypes.length > 0) {
			interfaceDecl.addExtends(extendsTypes);
		}
	}
}

/**
 * Adds a string index signature to an `InterfaceDeclaration` when `additionalProperties`, `unevaluatedProperties`, or `patternProperties` are present.
 *
 * @param interfaceDecl - Target `InterfaceDeclaration`.
 * @param def - OpenAPI schema definition.
 * @param config - Active generator configuration.
 * @param parser - Parsed OpenAPI specification.
 */
export function applyIndexSignature(
	interfaceDecl: InterfaceDeclaration,
	def: SwaggerDefinition,
	config: GeneratorConfig,
	parser: SwaggerParser,
): void {
	const returnTypes: string[] = [];
	const knownTypes = parser.schemas.map((s) => s.name);

	if (def.additionalProperties) {
		const valueType =
			def.additionalProperties === true
				? "string | number | boolean | object | undefined | null"
				: getTypeScriptType(
						def.additionalProperties as SwaggerDefinition,
						config,
						knownTypes,
					);
		returnTypes.push(valueType);
	}

	if (def.unevaluatedProperties) {
		const valueType =
			def.unevaluatedProperties === true
				? "string | number | boolean | object | undefined | null"
				: getTypeScriptType(
						def.unevaluatedProperties as SwaggerDefinition,
						config,
						knownTypes,
					);
		returnTypes.push(valueType);
	}

	if (def.patternProperties) {
		Object.values(def.patternProperties).forEach((p) => {
			returnTypes.push(
				getTypeScriptType(p as SwaggerDefinition | boolean, config, knownTypes),
			);
		});
	}

	if (returnTypes.length > 0) {
		const distinct = Array.from(new Set(returnTypes));
		const returnType = distinct.includes(
			"string | number | boolean | object | undefined | null",
		)
			? "string | number | boolean | object | undefined | null"
			: distinct.join(" | ");

		interfaceDecl.addIndexSignature({
			keyName: "key",
			keyType: "string",
			returnType,
		});
	}
}
