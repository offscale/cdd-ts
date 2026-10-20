/**
 * Post-processes reconstructed OpenAPI schemas to infer polymorphic `discriminator` mappings.
 *
 * @module classes/postprocess_schemas
 */
import type { SwaggerDefinition } from "../core/types/index.js";
import type { ReverseSchemaMap } from "./parse.js";

type DiscriminatorVariant = {
	schema: SwaggerDefinition;
	ref?: string;
};

/**
 * Infers `discriminator` definitions across union (`oneOf` / `anyOf`) schemas when all variants share a required literal discriminator property.
 *
 * @param schemas - Map of schema names to reconstructed schema definitions.
 */
export function inferDiscriminators(schemas: ReverseSchemaMap): void {
	Object.values(schemas).forEach((schemaEntry) => {
		if (!schemaEntry || typeof schemaEntry !== "object") return;

		const schema = schemaEntry as SwaggerDefinition;
		if (schema.discriminator) return;

		const union = Array.isArray(schema.oneOf)
			? schema.oneOf
			: Array.isArray(schema.anyOf)
				? schema.anyOf
				: undefined;

		if (!union || union.length < 2) return;

		const variants = union
			.map((entry) => resolveDiscriminatorVariant(entry, schemas))
			.filter((entry): entry is DiscriminatorVariant => !!entry);

		if (variants.length !== union.length) return;

		const hasRefs = variants.some((variant) => !!variant.ref);
		const hasInline = variants.some((variant) => !variant.ref);

		if (hasRefs && hasInline) return;

		const candidate = findDiscriminatorProperty(variants);
		if (!candidate) return;

		const mapping: Record<string, string> = {};
		const seenValues = new Set<string>();

		for (const variant of variants) {
			const value = getDiscriminatorValue(variant.schema, candidate);
			const key = String(value);
			if (seenValues.has(key)) return;
			seenValues.add(key);

			if (variant.ref) mapping[key] = variant.ref;
		}

		schema.discriminator = hasRefs
			? { propertyName: candidate, mapping }
			: { propertyName: candidate };

		if (schema.anyOf && !schema.oneOf) {
			schema.oneOf = schema.anyOf;
			delete schema.anyOf;
		}
	});
}

function resolveDiscriminatorVariant(
	entry: SwaggerDefinition | boolean,
	schemas: ReverseSchemaMap,
): DiscriminatorVariant | undefined {
	if (!entry || typeof entry !== "object") return undefined;

	if ("$ref" in entry) {
		const ref = String((entry as { $ref: string }).$ref);
		const name = extractSchemaName(ref);
		if (!name) return undefined;

		const resolved = schemas[name];
		if (!resolved || typeof resolved !== "object") return undefined;

		return { schema: resolved as SwaggerDefinition, ref };
	}

	return { schema: entry as SwaggerDefinition };
}

function extractSchemaName(ref: string): string | undefined {
	const match = ref.match(/#\/components\/schemas\/(.+)$/);
	return match ? match[1] : undefined;
}

function findDiscriminatorProperty(
	variants: DiscriminatorVariant[],
): string | undefined {
	const candidateNames = new Set<string>();

	variants.forEach((variant) => {
		const props = variant.schema.properties ?? {};
		Object.keys(props).forEach((name) => {
			candidateNames.add(name);
		});
	});

	const orderedCandidates = Array.from(candidateNames);
	const preferredOrder = [
		"type",
		"kind",
		"petType",
		"variant",
		"discriminator",
	];

	orderedCandidates.sort((a, b) => {
		const ai = preferredOrder.indexOf(a);
		const bi = preferredOrder.indexOf(b);
		if (ai === -1 && bi === -1) return a.localeCompare(b);
		if (ai === -1) return 1;
		if (bi === -1) return -1;
		return ai - bi;
	});

	for (const name of orderedCandidates) {
		if (
			variants.every((variant) => {
				const schema = variant.schema;
				const props = schema.properties ?? {};
				const propSchema = props[name];
				const required =
					Array.isArray(schema.required) && schema.required.includes(name);

				return (
					required &&
					!!propSchema &&
					typeof propSchema === "object" &&
					getDiscriminatorValueSchema(propSchema as SwaggerDefinition) !==
						undefined
				);
			})
		) {
			return name;
		}
	}

	return undefined;
}

function getDiscriminatorValue(
	schema: SwaggerDefinition,
	propName: string,
): string | number | boolean | undefined {
	const propSchema = schema.properties?.[propName] as SwaggerDefinition;
	return getDiscriminatorValueSchema(propSchema);
}

function getDiscriminatorValueSchema(
	schema: SwaggerDefinition,
): string | number | boolean | undefined {
	if (schema.const !== undefined)
		return schema.const as string | number | boolean;

	return undefined;
}
