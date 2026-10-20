import { extractAngularHttpCall } from "@src/functions/parsers/parse_angular_service.js";
import { extractPromiseHttpCall } from "@src/functions/parsers/parse_promise_service.js";
import { groupPathsByController } from "@src/functions/utils.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { describe, expect, it } from "vitest";
import { createTestConfig, createTestSpec } from "../shared/helpers.js";

describe("Service Parser: groupPathsByController", () => {
	const createParser = (spec: object) =>
		new SwaggerParser(createTestSpec(spec), createTestConfig({ options: {} }));
	const info = { title: "Test", version: "1.0" };

	it("should group untagged paths by path segment", () => {
		const spec = {
			openapi: "3.0.0",
			info,
			paths: {
				"/untagged/resource": {
					get: {
						operationId: "getUntagged",
						responses: { "200": { description: "ok" } },
					},
				},
			},
		};
		const groups = groupPathsByController(createParser(spec));
		expect(groups).toHaveProperty("Untagged");
		expect(groups.Untagged?.[0]?.operationId).toBe("getUntagged");
	});

	it('should group untagged root paths under "Default"', () => {
		const spec = {
			openapi: "3.0.0",
			info,
			paths: {
				"/": {
					get: {
						operationId: "getRoot",
						responses: { "200": { description: "ok" } },
					},
				},
			},
		};
		const groups = groupPathsByController(createParser(spec));
		expect(groups).toHaveProperty("Default");
		expect(groups.Default?.[0]?.operationId).toBe("getRoot");
	});

	it("should extract HTTP calls from Angular, Fetch, Axios, and Node service bodies", () => {
		expect(
			extractAngularHttpCall(
				"return this.http.request<User>('POST', url);",
				undefined,
				"http",
			),
		).toEqual({
			httpMethod: "POST",
			returnTypeHint: "User",
		});

		expect(
			extractPromiseHttpCall(
				"return fetch(url, { method: 'DELETE' });",
				"Observable<void>",
			),
		).toEqual({
			httpMethod: "DELETE",
			returnTypeHint: "void",
		});

		expect(
			extractPromiseHttpCall(
				"return this.axiosInstance.request<Item>({ method: 'PUT', url });",
				undefined,
			),
		).toEqual({
			httpMethod: "PUT",
			returnTypeHint: "Item",
		});

		expect(
			extractPromiseHttpCall(
				"const requestOptions = { method: 'PATCH' }; return http.request(requestOptions);",
				"Promise<NodeItem>",
			),
		).toEqual({
			httpMethod: "PATCH",
			returnTypeHint: "NodeItem",
		});

		expect(
			extractPromiseHttpCall(
				"return this.axiosInstance.request({ url });",
				"Promise<Item>",
			),
		).toEqual({
			httpMethod: "GET",
			returnTypeHint: "Item",
		});

		expect(
			extractPromiseHttpCall("return fetch(url, { headers });", undefined),
		).toEqual({
			httpMethod: "GET",
		});
	});
});
