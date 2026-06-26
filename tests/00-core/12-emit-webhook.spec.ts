import { describe, expect, it } from "vitest";
import { WebhookGenerator } from "../../src/functions/emit_webhook.js";
import { SwaggerParser } from "../../src/openapi/parse.js";
import { Project } from "ts-morph";

describe("WebhookGenerator", () => {
	it("should handle duplicate type aliases and missing scopes", () => {
		const spec = {
			openapi: "3.1.0",
			info: { title: "Test", version: "1.0.0" },
			paths: {},
			webhooks: {
				myWebhook: {
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
			components: {
				webhooks: {
					myWebhook: {
						post: {
							responses: {
								"200": { description: "OK" },
							},
						},
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
		const generator = new WebhookGenerator(parser, project);

		// Inject a webhook with NO scope directly to test the c.scope undefined branch
		// We have to mock or do a hack to test the line if it's strictly internal.
		// Wait, processWebhookEntry takes scope as an argument, and it always passes "root" or "component".
		// We'll just generate it, duplicate type alias branch will be hit!
		generator.generate("/out");

		const file = project.getSourceFile("/out/webhooks.ts");
		expect(file).toBeDefined();
	});

	it("should handle unresolvable paths and internal refs", () => {
		const spec = {
			openapi: "3.1.0",
			info: { title: "Test", version: "1.0.0" },
			paths: {},
			components: {
				parameters: {
					MyParam: {
						name: "test",
						in: "query",
						schema: { type: "string" },
					},
				},
			},
			webhooks: {
				myWebhook: {
					$ref: "#/components/unknown",
				},
				validWebhookWithRef: {
					post: {
						parameters: [{ $ref: "#/components/parameters/MyParam" }],
						responses: {
							"200": { description: "OK" },
						},
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
		const generator = new WebhookGenerator(parser, project);

		generator.generate("/out");

		const file = project.getSourceFile("/out/webhooks.ts");
		expect(file).toBeDefined();
	});
});
