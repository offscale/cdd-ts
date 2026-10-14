import type { IOrmGenerator, IOrmParser } from "@src/core/orm/index.js";
import type { GeneratorConfig } from "@src/core/types/config.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { TypeOrmGenerator } from "@src/vendors/typeorm/emit.js";
import { TypeOrmParser } from "@src/vendors/typeorm/parse.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

describe("Core ORM Contracts (IOrmGenerator & IOrmParser)", () => {
	it("should emit and reverse-parse TypeORM entities conforming to IOrmGenerator and IOrmParser", () => {
		const config: GeneratorConfig = {
			input: "memory://spec.json",
			output: "/out",
			options: { framework: "vanilla" },
		};
		const parser = new SwaggerParser(
			{
				openapi: "3.1.0",
				info: { title: "ORM Contract Spec", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Account: {
							type: "object",
							required: ["id", "email"],
							properties: {
								id: { type: "integer" },
								email: { type: "string" },
								isActive: { type: "boolean" },
							},
						},
					},
				},
			},
			config,
		);

		const project = new Project({ useInMemoryFileSystem: true });
		const ormGenerator: IOrmGenerator = new TypeOrmGenerator();
		ormGenerator.generate(project, parser, config, "/out");

		expect(
			project.getSourceFile("/out/entities/account.entity.ts"),
		).toBeDefined();

		const ormParser: IOrmParser = new TypeOrmParser();
		const parsedSchemas = ormParser.parse(project);
		expect(parsedSchemas.Account).toEqual({
			type: "object",
			required: ["id", "email"],
			properties: {
				id: { type: "number" },
				email: { type: "string" },
				isActive: { type: "boolean" },
			},
		});
	});
});
