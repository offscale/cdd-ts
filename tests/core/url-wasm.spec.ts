import { describe, expect, it } from "vitest";
import { SwaggerParser } from "../../src/openapi/parse.js";
import { testCast } from "../shared/helpers.js";

describe("WASM URL fallback", () => {
	it("parses petstore spec when URL is undefined", async () => {
		const originalURL = globalThis.URL;
		testCast(globalThis).URL = testCast(undefined);
		try {
			const spec = {
				openapi: "3.1.0",
				paths: {},
				info: { title: "Test", version: "1.0.0" },
				components: {
					securitySchemes: {
						petstore_auth: {
							type: "oauth2",
							flows: {
								implicit: {
									authorizationUrl:
										"https://petstore.swagger.io/oauth/authorize",
									scopes: {
										"write:pets": "modify pets in your account",
										"read:pets": "read your pets",
									},
								},
							},
						},
					},
				},
			};
			const parser = new SwaggerParser(testCast(spec), {
				input: "memory://spec.json",
				output: "dummy",
				options: { framework: "vanilla" },
			});
			expect(parser).toBeDefined();
		} finally {
			globalThis.URL = originalURL;
		}
	});
});
