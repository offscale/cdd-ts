import type { PathInfo } from "@src/core/types/analysis.js";
import type { GeneratorConfig } from "@src/core/types/index.js";
import {
	buildSampleArgs,
	buildWorkflowSampleArgs,
	formatSampleSchemaValue,
	generateDocsJson,
} from "@src/functions/docs_generator.js";
import { describe, expect, it } from "vitest";
import { createTestConfig, createTestOptions } from "../shared/helpers.js";

describe("generateDocsJson", () => {
	it("should generate concise documentation correctly without imports or wrapping", () => {
		const parser = {
			operations: [
				{
					path: "/users",
					method: "get",
					methodName: "getUsers",
					operationId: "getUsers",
					tags: ["Users"],
				} as PathInfo,
			],
		};

		const config: GeneratorConfig = createTestConfig({
			output: "",
			input: "",
			options: { imports: false, wrapping: false },
		});
		const result = generateDocsJson(parser, config);

		expect(result.endpoints).toBeDefined();
		expect(result.endpoints["/users"]).toBeDefined();
		expect(result.endpoints["/users"]?.get).toBe(
			`const response = await firstValueFrom(this.service.getUsers());
console.log(response);`,
		);
		expect(result.operations).toHaveLength(1);
		expect(result.operations[0]?.code).toEqual({
			imports: `import { Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UsersService } from './api/services/users.service';`,
			wrapper_start: `@Component({ selector: 'app-example', template: '' })
export class ExampleComponent {
    private readonly service = inject(UsersService);
    async execute() {`,
			snippet: `        const response = await firstValueFrom(this.service.getUsers());
        console.log(response);`,
			wrapper_end: `    }
}`,
		});
	});

	it("should generate documentation with imports and wrapping for angular", () => {
		const parser = {
			operations: [
				{
					path: "/posts/{id}",
					method: "post",
					methodName: "createPost",
					operationId: "createPost",
					tags: [],
					parameters: [{ name: "id", in: "path", required: true }],
				},
			],
		};

		const config: GeneratorConfig = createTestConfig({
			output: "",
			input: "",
			options: { imports: false, wrapping: false },
		});
		const result = generateDocsJson(parser, config, {
			imports: true,
			wrapping: true,
		});

		const snippet = result.endpoints["/posts/{id}"]?.post;
		expect(snippet).toContain(
			"import { PostsService } from './api/services/posts.service';",
		);
		expect(snippet).toContain("import { firstValueFrom } from 'rxjs';");
		expect(snippet).toContain(
			"@Component({ selector: 'app-example', template: '' })",
		);
		expect(snippet).toContain("export class ExampleComponent {");
		expect(snippet).toContain(
			"        const response = await firstValueFrom(this.service.createPost({ id: 'example' }));",
		);
		expect(snippet).toContain(`    }
}`);
	});

	it("should handle imports without wrapping correctly", () => {
		const parser = {
			operations: [
				{
					path: "/comments",
					method: "delete",
					methodName: "deleteComment",
					operationId: "deleteComment",
					requestBody: { content: {} },
				},
			],
		};

		const config: GeneratorConfig = createTestConfig({
			output: "",
			input: "",
			options: { imports: false, wrapping: false },
		});
		const result = generateDocsJson(parser, config, {
			imports: true,
			wrapping: false,
		});

		const snippet = result.endpoints["/comments"]?.delete;
		expect(snippet).toContain(
			"import { CommentsService } from './api/services/comments.service';",
		);
		expect(snippet).toContain(
			"const response = await firstValueFrom(this.service.deleteComment({ body: {} }));",
		);
		expect(snippet).not.toContain("export class ExampleComponent");
	});

	it("should generate documentation with and without imports/wrapping for react", () => {
		const parser = {
			operations: [
				{
					path: "/posts/{id}",
					method: "post",
					methodName: "createPost",
					operationId: "createPost",
					tags: [],
					parameters: [{ name: "id", in: "path", required: true }],
				},
			],
		};

		const config: GeneratorConfig = {
			output: "",
			input: "",
			options: createTestOptions({
				framework: "react",
				imports: false,
				wrapping: false,
			}),
		};
		const wrapped = generateDocsJson(parser, config, {
			imports: true,
			wrapping: true,
		});

		const snippet = wrapped.endpoints["/posts/{id}"]?.post;
		expect(snippet).toContain(
			"import { usePostsService } from './api/services/posts.service';",
		);
		expect(snippet).toContain("export function ExampleComponent() {");
		expect(snippet).toContain("    const service = usePostsService();");
		expect(snippet).toContain("    async function execute() {");
		expect(snippet).toContain(
			"        const response = await service.createPost({ id: 'example' });",
		);
		expect(snippet).toContain(`    }
}`);
		expect(wrapped.operations[0]?.code).toEqual({
			imports:
				"import { usePostsService } from './api/services/posts.service';",
			wrapper_start: `export function ExampleComponent() {
    const service = usePostsService();
    async function execute() {`,
			snippet: `        const response = await service.createPost({ id: 'example' });
        console.log(response);`,
			wrapper_end: `    }
}`,
		});

		const unwrapped = generateDocsJson(parser, config, {
			imports: false,
			wrapping: false,
		});
		expect(unwrapped.endpoints["/posts/{id}"]?.post).toBe(
			`const response = await service.createPost({ id: 'example' });
console.log(response);`,
		);
	});

	it("should generate documentation for vanilla framework across all import/wrapping combinations", () => {
		const parser = {
			operations: [
				{
					path: "/posts/{id}",
					method: "post",
					methodName: "createPost",
					operationId: "createPost",
					tags: [],
					parameters: [{ name: "id", in: "path", required: true }],
				},
			],
		};

		const config: GeneratorConfig = {
			output: "",
			input: "",
			options: createTestOptions({
				framework: "vanilla",
				imports: false,
				wrapping: false,
			}),
		};
		const wrapped = generateDocsJson(parser, config, {
			imports: true,
			wrapping: true,
		});

		const snippet = wrapped.endpoints["/posts/{id}"]?.post;
		expect(snippet).toContain(
			"import { PostsClient } from './api/services/posts.client';",
		);
		expect(snippet).toContain("export async function execute() {");
		expect(snippet).toContain("    const client = new PostsClient();");
		expect(snippet).toContain(
			"    const response = await client.createPost({ id: 'example' });",
		);
		expect(wrapped.operations[0]?.code).toEqual({
			imports: "import { PostsClient } from './api/services/posts.client';",
			wrapper_start: "export async function execute() {",
			snippet: `    const client = new PostsClient();
    const response = await client.createPost({ id: 'example' });
    console.log(response);`,
			wrapper_end: "}",
		});

		const unwrapped = generateDocsJson(parser, config, {
			imports: false,
			wrapping: false,
		});
		expect(unwrapped.endpoints["/posts/{id}"]?.post).toBe(
			`const client = new PostsClient();
const response = await client.createPost({ id: 'example' });
console.log(response);`,
		);
	});

	it("should generate documentation with and without imports/wrapping for vue", () => {
		const parser = {
			operations: [
				{
					path: "/posts/{id}",
					method: "post",
					methodName: "createPost",
					operationId: "createPost",
					tags: [],
					parameters: [{ name: "id", in: "path", required: true }],
				},
			],
		};

		const config: GeneratorConfig = {
			output: "",
			input: "",
			options: createTestOptions({
				framework: "vue",
				imports: false,
				wrapping: false,
			}),
		};
		const result = generateDocsJson(parser, config, {
			imports: true,
			wrapping: true,
		});

		const snippet = result.endpoints["/posts/{id}"]?.post;
		expect(snippet).toContain(
			"import { usePostsService } from './api/services/posts.service';",
		);
		expect(snippet).toContain("<script setup>");
		expect(snippet).toContain("const service = usePostsService();");
		expect(snippet).toContain("async function execute() {");
		expect(snippet).toContain(
			"    const response = await service.createPost({ id: 'example' });",
		);
		expect(snippet).toContain(`}
</script>`);
		expect(result.operations[0]?.code).toEqual({
			imports:
				"import { usePostsService } from './api/services/posts.service';",
			wrapper_start: `<script setup>
const service = usePostsService();
async function execute() {`,
			snippet: `    const response = await service.createPost({ id: 'example' });
    console.log(response);`,
			wrapper_end: `}
</script>`,
		});

		const unwrapped = generateDocsJson(parser, config, {
			imports: false,
			wrapping: false,
		});
		expect(unwrapped.endpoints["/posts/{id}"]?.post).toBe(
			`const response = await service.createPost({ id: 'example' });
console.log(response);`,
		);
	});

	it("should populate realistic named parameter keys from parameters and requestBody", () => {
		expect(formatSampleSchemaValue(undefined, "custom")).toBe('"custom"');
		expect(formatSampleSchemaValue({ example: 42 })).toBe("42");
		expect(formatSampleSchemaValue({ default: "fallback" })).toBe('"fallback"');
		expect(formatSampleSchemaValue({ type: "integer" })).toBe("1");
		expect(formatSampleSchemaValue({ type: "number" })).toBe("1");
		expect(formatSampleSchemaValue({ type: "boolean" })).toBe("true");
		expect(formatSampleSchemaValue({ type: "array" })).toBe("[]");
		expect(formatSampleSchemaValue({ type: "object" })).toBe("{}");
		expect(formatSampleSchemaValue({ type: "string" })).toBe("'example'");

		const opWithTypedParamsAndBody: PathInfo = {
			path: "/items/{item_id}",
			method: "put",
			operationId: "updateItem",
			parameters: [
				{
					name: "item_id",
					in: "path",
					required: true,
					schema: { type: "integer" },
				},
				{
					name: "include_meta",
					in: "query",
					schema: { type: "boolean" },
				},
				{
					name: "",
					in: "query",
				},
			],
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								display_name: { type: "string" },
								quantity: { type: "number" },
								active: true,
							},
						},
					},
				},
			},
		};

		expect(buildSampleArgs(opWithTypedParamsAndBody)).toBe(
			"{ itemId: 1, includeMeta: true, body: { displayName: 'example', quantity: 1, active: 'example' } }",
		);
		expect(
			buildSampleArgs({
				path: "/raw",
				method: "post",
				parameters: [{ name: "flag", in: "query", schema: true as never }],
				requestBody: {
					content: {
						"text/plain": {
							schema: true as never,
						},
					},
				},
			}),
		).toBe("{ flag: 'example', body: {} }");
		expect(
			buildSampleArgs({
				path: "/no-content",
				method: "post",
				requestBody: { required: true } as never,
			}),
		).toBe("{ body: {} }");
	});

	it("should emit OpenAPI webhooks and Arazzo workflows snippets", () => {
		const config: GeneratorConfig = createTestConfig({
			output: "",
			input: "",
			options: { framework: "vanilla" },
		});

		const parserWithWebhooksAndWorkflows = {
			operations: [],
			webhooks: [
				{
					path: "newPet",
					method: "post",
					operationId: "onNewPet",
					tags: ["Events"],
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: { petId: { type: "integer" } },
								},
							},
						},
					},
				} as PathInfo,
				{
					path: "newPet",
					method: "get",
					tags: ["Events"],
				} as PathInfo,
			],
			workflows: [
				{
					workflowId: "loginAndCheckout",
					inputs: {
						type: "object",
						properties: {
							username: { type: "string" },
							rememberMe: true,
						},
					},
				},
				{
					workflowId: "healthCheck",
				},
			],
		};

		const wrappedResult = generateDocsJson(
			parserWithWebhooksAndWorkflows,
			config,
			{ imports: true, wrapping: true },
		);

		expect(wrappedResult.webhooks?.newPet?.post).toContain(
			"const response = await client.onNewPet({ body: { petId: 1 } });",
		);
		expect(wrappedResult.webhooks?.newPet?.get).toContain(
			"const response = await client.getNewPet();",
		);
		expect(wrappedResult.workflows?.loginAndCheckout).toContain(
			"import { WorkflowOrchestrator } from './workflows/index';",
		);
		expect(wrappedResult.workflows?.loginAndCheckout).toContain(
			"const outputs = await orchestrator.loginAndCheckout({ username: 'example', rememberMe: 'example' });",
		);
		expect(wrappedResult.workflows?.healthCheck).toContain(
			"const outputs = await orchestrator.healthCheck();",
		);

		// Also verify fallback extraction from parser.spec.webhooks and parser.spec.workflows without wrapping/imports
		const specBasedParser = {
			operations: [],
			spec: {
				openapi: "3.1.0",
				info: { title: "Webhook Spec", version: "1.0.0" },
				webhooks: {
					orderCreated: {
						post: {
							operationId: "orderCreatedHook",
							responses: { "200": { description: "ok" } },
						},
					},
				},
				workflows: [
					{
						workflowId: "syncOrders",
						inputs: true,
					},
				],
			},
		};
		const unwrappedSpecResult = generateDocsJson(
			specBasedParser as never,
			config,
			{ imports: false, wrapping: false },
		);
		expect(unwrappedSpecResult.webhooks?.orderCreated?.post).toBe(
			`const client = new OrderCreatedClient();
const response = await client.orderCreatedHook();
console.log(response);`,
		);
		expect(unwrappedSpecResult.workflows?.syncOrders).toBe(
			`const orchestrator = new WorkflowOrchestrator();
const outputs = await orchestrator.syncOrders();
console.log(outputs);`,
		);
		expect(buildWorkflowSampleArgs(false)).toBe("");
	});

	it("should fallback method names correctly and deduplicate", () => {
		const parser = {
			operations: [
				{
					path: "/test1",
					method: "get",
					methodName: "",
					operationId: "",
					tags: ["TestTag"],
				},
				{
					path: "/test2",
					method: "get",
					methodName: "",
					operationId: "Invalid-Name-Format!",
					tags: ["TestTag"],
				},
				{
					path: "/test3",
					method: "get",
					methodName: "invalidNameFormat!",
					operationId: "Invalid-Name-Format!",
					tags: ["TestTag"],
				},
				{
					path: "/test4",
					method: "get",
					methodName: "validName",
					operationId: "validName",
					tags: ["TestTag"],
				},
				{
					path: "/",
					method: "get",
					methodName: "rootMethod",
					operationId: "rootMethod",
					tags: [],
				},
			],
		};

		const config: GeneratorConfig = createTestConfig({
			output: "",
			input: "",
			options: { imports: false, wrapping: false },
		});

		const result = generateDocsJson(parser, config, {});

		expect(result.endpoints["/test1"]?.get).toContain(".getTest1()");
		expect(result.endpoints["/test2"]?.get).toContain(".invalidNameFormat()");
		expect(result.endpoints["/test3"]?.get).toContain(".invalidNameFormat2()");
	});

	it("should respect custom method name from config", () => {
		const parser = {
			operations: [
				{
					path: "/custom",
					method: "get",
					methodName: "getCustom",
					operationId: "customId",
				},
			],
		};

		const config: GeneratorConfig = {
			output: "",
			input: "",
			options: {
				customizeMethodName: (id: string) => {
					if (id === "customId") return "myCustomMethodName";
					return undefined;
				},
			},
		};
		const result = generateDocsJson(parser, config, {});

		expect(result.endpoints["/custom"]?.get).toContain(".myCustomMethodName()");
	});

	it("should handle multiple methods on the same path", () => {
		const parser = {
			operations: [
				{
					path: "/users",
					method: "get",
					methodName: "getUsers",
					operationId: "getUsers",
				},
				{
					path: "/users",
					method: "post",
					methodName: "createUser",
					operationId: "createUser",
				},
			],
		};

		const config = {
			output: "",
			input: "",
			options: {},
		};
		const result = generateDocsJson(parser, config, { wrapping: true });

		expect(result.endpoints["/users"]?.get).toContain("getUsers");
		expect(result.endpoints["/users"]?.post).toContain("createUser");
	});
});
