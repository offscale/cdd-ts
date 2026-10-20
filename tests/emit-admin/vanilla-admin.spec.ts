import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { SwaggerParser } from "../../src/openapi/parse.js";
import { VanillaAdminGenerator } from "../../src/vendors/vanilla/admin/admin.generator.js";
import { FormComponentGenerator } from "../../src/vendors/vanilla/admin/form-component.generator.js";
import { createTestConfig, createTestSpec } from "../shared/helpers.js";

describe("VanillaAdminGenerator", () => {
	it("generates Vanilla Web Components Admin UI and handles pre-existing directories", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "Vanilla Admin API", version: "1.0.0" },
				paths: {
					"/users": {
						get: {
							tags: ["Users"],
							operationId: "listUsers",
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "array",
												items: { $ref: "#/components/schemas/User" },
											},
										},
									},
								},
							},
						},
						post: {
							tags: ["Users"],
							operationId: "createUser",
							requestBody: {
								content: {
									"application/json": {
										schema: { $ref: "#/components/schemas/User" },
									},
								},
							},
							responses: { "201": { description: "Created" } },
						},
					},
					"/users/{id}": {
						get: {
							tags: ["Users"],
							operationId: "getUserById",
							parameters: [
								{
									name: "id",
									in: "path",
									required: true,
									schema: { type: "string" },
								},
							],
							responses: { "200": { description: "OK" } },
						},
						put: {
							tags: ["Users"],
							operationId: "updateUser",
							parameters: [
								{
									name: "id",
									in: "path",
									required: true,
									schema: { type: "string" },
								},
							],
							responses: { "200": { description: "OK" } },
						},
						delete: {
							tags: ["Users"],
							operationId: "deleteUser",
							parameters: [
								{
									name: "id",
									in: "path",
									required: true,
									schema: { type: "string" },
								},
							],
							responses: { "204": { description: "Deleted" } },
						},
					},
				},
				components: {
					schemas: {
						User: {
							type: "object",
							required: ["id", "email"],
							properties: {
								id: { type: "string" },
								email: { type: "string" },
								age: { type: "number" },
								active: { type: "boolean" },
							},
						},
					},
				},
			}),
			createTestConfig({}),
		);

		const gen = new VanillaAdminGenerator(parser, project);
		gen.generate("/out");
		// Call a second time so directoryExistsSync(dirPath) is true for adminDir, list, and form
		gen.generate("/out");

		expect(project.getSourceFile("/out/admin/app-shell.ts")).toBeDefined();
		expect(
			project.getSourceFile(
				"/out/admin/users/users-list/users-list.component.ts",
			),
		).toBeDefined();
		const formFile = project.getSourceFileOrThrow(
			"/out/admin/users/users-form/users-form.component.ts",
		);
		expect(formFile.getFullText()).toContain(
			"const payload: Record<string, string> = {};",
		);

		// Also call FormComponentGenerator directly on existing dirPath
		new FormComponentGenerator(project).generate(
			{
				name: "users",
				modelName: "User",
				isEditable: true,
				operations: [],
				formProperties: [{ name: "id", schema: { type: "string" } }],
				listProperties: [],
			},
			"/out/admin",
		);
	});
});
