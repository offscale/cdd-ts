import { TypeGenerator } from "@src/classes/emit.js";
import type { GeneratorConfig } from "@src/core/types/index.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { createTestSchema, createTestSpec } from "../shared/helpers.js";

describe("Emitter: TypeGenerator (dependentSchemas)", () => {
	const setup = (schema: unknown) => {
		const project = new Project({ useInMemoryFileSystem: true });
		const config: GeneratorConfig = { input: "", output: "/out", options: {} };
		const spec = {
			openapi: "3.1.0",
			info: { title: "Dependent", version: "1" },
			paths: {},

			components: { schemas: { DependentModel: schema } },
		};
		const parser = new SwaggerParser(createTestSpec(spec), config);
		new TypeGenerator(parser, project, config).generate("/out");
		return project.createSourceFile(
			"/out/combined.ts",
			project
				.getSourceFiles()
				.filter((f) => f.getFilePath().includes("/out/models/"))
				.map((f) => f.getFullText().replace(/import type .+\n/g, ""))
				.join("\n"),
			{ overwrite: true },
		);
	};

	it("should generate an intersection type for dependentSchemas", () => {
		const sourceFile = setup({
			type: "object",
			properties: {
				paymentMethod: {
					type: "string",
					enum: ["credit_card", "paypal"],
				},
			},
			dependentSchemas: {
				paymentMethod: {
					properties: {
						creditCardNumber: { type: "string" },
					},
					required: ["creditCardNumber"],
				},
			},
		});

		const typeAlias = sourceFile.getTypeAliasOrThrow("DependentModel");
		const typeText = typeAlias.getTypeNodeOrThrow().getText();

		// Base part
		expect(typeText).toContain("paymentMethod?: 'credit_card' | 'paypal'");

		// Intersection part structure: (({ paymentMethod: string | number | boolean | object | undefined | null } & Dependency) | { paymentMethod?: string | number | boolean | object | undefined | null })
		// Adjusted expectation: inline objects inside intersection do not have trailing semicolons
		expect(typeText).toContain(
			"& (({ paymentMethod: string | number | boolean | object | undefined | null } & { creditCardNumber: string }) | { paymentMethod?: string | number | boolean | object | undefined | null })",
		);
	});

	it("should handle multiple dependentSchemas", () => {
		const sourceFile = setup({
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
			},
			dependentSchemas: {
				a: {
					properties: { c: { type: "number" } },
				},
				b: {
					properties: {
						d: { type: "boolean" },
					},
				},
			},
		});

		const typeText = sourceFile
			.getTypeAliasOrThrow("DependentModel")
			.getTypeNodeOrThrow()
			.getText();

		expect(typeText).toContain(
			"& (({ a: string | number | boolean | object | undefined | null } & { c?: number }) | { a?: string | number | boolean | object | undefined | null })",
		);
		expect(typeText).toContain(
			"& (({ b: string | number | boolean | object | undefined | null } & { d?: boolean }) | { b?: string | number | boolean | object | undefined | null })",
		);
	});

	it("should properly escape property names in dependentSchemas key", () => {
		const sourceFile = setup({
			type: "object",
			properties: {
				"my-prop": { type: "string" },
			},
			dependentSchemas: {
				"my-prop": {
					properties: {
						extra: { type: "string" },
					},
				},
			},
		});

		const typeText = sourceFile
			.getTypeAliasOrThrow("DependentModel")
			.getTypeNodeOrThrow()
			.getText();

		expect(typeText).toContain(
			"(({ 'my-prop': string | number | boolean | object | undefined | null } & { extra?: string }) | { 'my-prop'?: string | number | boolean | object | undefined | null })",
		);
	});
});

describe("Emitter: TypeGenerator (dependentRequired)", () => {
	const setup = (
		schema: import("@src/core/types/index.js").SwaggerDefinition,
	) => {
		const project = new Project({ useInMemoryFileSystem: true });
		const config: GeneratorConfig = { input: "", output: "/out", options: {} };
		const spec = {
			openapi: "3.1.0",
			info: { title: "Dependent", version: "1" },
			paths: {},

			components: { schemas: { DependentModel: schema } },
		};
		const parser = new SwaggerParser(spec, config);
		new TypeGenerator(parser, project, config).generate("/out");
		return project.createSourceFile(
			"/out/combined.ts",
			project
				.getSourceFiles()
				.filter((f) => f.getFilePath().includes("/out/models/"))
				.map((f) => f.getFullText().replace(/import type .+\n/g, ""))
				.join("\n"),
			{ overwrite: true },
		);
	};

	it("should generate an intersection type for dependentRequired", () => {
		const sourceFile = setup(
			createTestSchema({
				type: "object",
				properties: {
					hasPhone: { type: "boolean" },
					phoneNumber: { type: "string" },
					phoneExtension: { type: "string" },
				},
				dependentRequired: {
					hasPhone: ["phoneNumber", "phoneExtension"],
				},
			}),
		);

		const typeText = sourceFile
			.getTypeAliasOrThrow("DependentModel")
			.getTypeNodeOrThrow()
			.getText();

		expect(typeText).toContain("hasPhone?: boolean");
		expect(typeText).toContain(
			"& (({ hasPhone: string | number | boolean | object | undefined | null } & { phoneNumber: string | number | boolean | object | undefined | null; phoneExtension: string | number | boolean | object | undefined | null }) | { hasPhone?: string | number | boolean | object | undefined | null })",
		);
	});
});
