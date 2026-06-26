import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { CallbackGenerator } from "../../src/functions/emit_callback.js";
import { SwaggerParser } from "../../src/openapi/parse.js";

describe("CallbackGenerator", () => {
	it("should handle duplicate type aliases and unresolvable paths", () => {
		const spec = {
			openapi: "3.1.0",
			info: { title: "Test", version: "1.0.0" },
			paths: {
				"/test": {
					post: {
						callbacks: {
							myCallback: {
								"{$request.body#/callbackUrl}": {
									post: {
										requestBody: {
											content: {
												"application/json": {
													schema: { type: "string" },
												},
											},
										},
										responses: {
											"200": { description: "OK" },
										},
									},
								},
							},
						},
						responses: {
							"200": { description: "OK" },
						},
					},
				},
			},
			components: {
				callbacks: {
					myCallback: {
						"{$request.body#/callbackUrl}": {
							post: {
								responses: {
									"200": { description: "OK" },
								},
							},
						},
					},
					unresolvableCallback: {
						$ref: "#/components/unknown",
					},
					validCallbackWithRef: {
						"{$request.body#/callbackUrl}": {
							post: {
								parameters: [{ $ref: "#/components/parameters/MyParam" }],
								responses: {
									"200": { description: "OK" },
								},
							},
						},
					},
				},
				parameters: {
					MyParam: {
						name: "test",
						in: "query",
						schema: { type: "string" },
					},
				},
			},
		};

		const parser = new SwaggerParser(spec as any, {
			input: "memory://spec.json",
			output: "dummy",
			options: { framework: "vanilla" },
		});

		const project = new Project({ useInMemoryFileSystem: true });
		const generator = new CallbackGenerator(parser, project);

		generator.generate("/out");

		const file = project.getSourceFile("/out/callbacks.ts");
		expect(file).toBeDefined();
		expect(file!.getText()).toContain("MyCallbackPostPayload");
	});
});
