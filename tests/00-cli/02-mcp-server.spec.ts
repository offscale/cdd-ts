import { describe, expect, it, vi } from "vitest";
import * as cli from "../../src/cli.js";
import { serveMcp } from "../../src/mcp_server.js";

const mockTool = vi.fn();
const mockPrompt = vi.fn();
const mockResource = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
	class MockMcpServer {
		tool = mockTool;
		prompt = mockPrompt;
		resource = mockResource;
		connect = mockConnect;
	}
	return { McpServer: MockMcpServer };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => {
	class MockStdioServerTransport {}
	return { StdioServerTransport: MockStdioServerTransport };
});

describe("serveMcp", () => {
	it("should initialize McpServer and register tools", async () => {
		const spyGenerateFromOpenApi = vi
			.spyOn(cli, "generateFromOpenApi")
			.mockResolvedValue("");
		const spyGenerateToOpenApi = vi
			.spyOn(cli, "generateToOpenApi")
			.mockResolvedValue("");

		await serveMcp();

		expect(mockTool).toHaveBeenCalledTimes(5);

		const cdd_generate_sdk = mockTool.mock.calls.find(
			(call) => call[0] === "cdd_generate_sdk",
		);
		expect(cdd_generate_sdk).toBeDefined();

		// Simulate invoking cdd_generate_sdk
		const sdkHandler = cdd_generate_sdk?.[3];
		const resSdk = await sdkHandler({
			input: "test.yaml",
			output: "out",
			framework: "vanilla",
			implementation: "fetch",
			tests: true,
		});
		expect(resSdk.isError).toBeUndefined();
		expect(spyGenerateFromOpenApi).toHaveBeenCalledWith(
			expect.objectContaining({ input: "test.yaml" }),
			"to_sdk",
		);

		// Simulate invoking with error (string) to test fallback
		spyGenerateFromOpenApi.mockRejectedValueOnce("fail sdk string");
		const errSdkStr = await sdkHandler({
			input: "test.yaml",
			output: "out",
			framework: "vanilla",
			implementation: "fetch",
			tests: true,
		});
		expect(errSdkStr.isError).toBe(true);
		expect(errSdkStr.content[0].text).toContain("fail sdk string");

		spyGenerateFromOpenApi.mockRejectedValueOnce(new Error("fail sdk error"));
		const errSdkErr = await sdkHandler({
			input: "test.yaml",
			output: "out",
			framework: "vanilla",
			implementation: "fetch",
			tests: true,
		});
		expect(errSdkErr.isError).toBe(true);
		expect(errSdkErr.content[0].text).toContain("fail sdk error");

		const cdd_generate_server = mockTool.mock.calls.find(
			(call) => call[0] === "cdd_generate_server",
		);
		expect(cdd_generate_server).toBeDefined();

		// Simulate invoking cdd_generate_server
		const serverHandler = cdd_generate_server?.[3];
		const resServer = await serverHandler({
			input: "test.yaml",
			output: "out",
			serverFramework: "express",
			orm: "typeorm",
		});
		expect(resServer.isError).toBeUndefined();
		expect(spyGenerateFromOpenApi).toHaveBeenCalledWith(
			expect.objectContaining({ orm: "typeorm" }),
			"to_server",
		);

		// Simulate invoking with error (string)
		spyGenerateFromOpenApi.mockRejectedValueOnce("fail server string");
		const errServerStr = await serverHandler({
			input: "test.yaml",
			output: "out",
			serverFramework: "express",
		});
		expect(errServerStr.isError).toBe(true);
		expect(errServerStr.content[0].text).toContain("fail server string");

		spyGenerateFromOpenApi.mockRejectedValueOnce(
			new Error("fail server error"),
		);
		const errServerErr = await serverHandler({
			input: "test.yaml",
			output: "out",
			serverFramework: "express",
		});
		expect(errServerErr.isError).toBe(true);
		expect(errServerErr.content[0].text).toContain("fail server error");

		const cdd_to_openapi = mockTool.mock.calls.find(
			(call) => call[0] === "cdd_to_openapi",
		);
		expect(cdd_to_openapi).toBeDefined();

		const cdd_inspect_schema = mockTool.mock.calls.find(
			(call) => call[0] === "cdd_inspect_schema",
		);
		expect(cdd_inspect_schema).toBeDefined();

		// Simulate invoking cdd_inspect_schema
		const inspectSchemaHandler = cdd_inspect_schema?.[3];

		// Mock SwaggerParser to simulate success
		vi.doMock("../../src/openapi/parse.js", () => ({
			SwaggerParser: {
				create: vi.fn().mockResolvedValue({
					spec: {
						info: { title: "Test API", version: "1.2.3" },
						paths: { "/test": {} },
						components: { schemas: { TestModel: {} } },
					},
				}),
			},
		}));

		const resInspect = await inspectSchemaHandler({ input: "test.yaml" });
		expect(resInspect.isError).toBeUndefined();
		expect(resInspect.content[0].text).toContain("Schema: Test API (v1.2.3)");
		expect(resInspect.content[0].text).toContain("Paths: 1");
		expect(resInspect.content[0].text).toContain("Components: 1 schemas");

		// Simulate invoking cdd_inspect_schema with minimal spec (cover fallback branches)
		vi.doMock("../../src/openapi/parse.js", () => ({
			SwaggerParser: {
				create: vi.fn().mockResolvedValue({
					spec: {}, // no info, no paths, no components
				}),
			},
		}));
		const resInspectEmpty = await inspectSchemaHandler({ input: "empty.yaml" });
		expect(resInspectEmpty.isError).toBeUndefined();
		expect(resInspectEmpty.content[0].text).toContain(
			"Schema: Unknown (v1.0.0)",
		);
		expect(resInspectEmpty.content[0].text).toContain("Paths: 0");
		expect(resInspectEmpty.content[0].text).toContain("Components: 0 schemas");

		// Simulate invoking cdd_inspect_schema with error (Error object)
		vi.doMock("../../src/openapi/parse.js", () => ({
			SwaggerParser: {
				create: vi.fn().mockRejectedValue(new Error("fail inspect schema")),
			},
		}));

		const errInspectErr = await inspectSchemaHandler({ input: "test.yaml" });
		expect(errInspectErr.isError).toBe(true);
		expect(errInspectErr.content[0].text).toContain("fail inspect schema");

		// Simulate invoking cdd_inspect_schema with error (string to cover String(err) branch)
		vi.doMock("../../src/openapi/parse.js", () => ({
			SwaggerParser: {
				create: vi.fn().mockRejectedValue("fail inspect schema string"),
			},
		}));

		const errInspectStr = await inspectSchemaHandler({ input: "test.yaml" });
		expect(errInspectStr.isError).toBe(true);
		expect(errInspectStr.content[0].text).toContain(
			"fail inspect schema string",
		);

		// Restore mocks
		vi.doUnmock("../../src/openapi/parse.js");

		// Simulate invoking cdd_to_openapi
		const toOpenApiHandler = cdd_to_openapi?.[3];
		const resToOpenApi = await toOpenApiHandler({
			input: "src",
			output: "out.yaml",
			format: "yaml",
			orm: "typeorm",
		});
		expect(resToOpenApi.isError).toBeUndefined();
		expect(spyGenerateToOpenApi).toHaveBeenCalledWith(
			expect.objectContaining({ orm: "typeorm" }),
		);

		// Simulate invoking with error (string)
		spyGenerateToOpenApi.mockRejectedValueOnce("fail openapi string");
		const errToOpenApiStr = await toOpenApiHandler({
			input: "src",
			output: "out.yaml",
			format: "yaml",
		});
		expect(errToOpenApiStr.isError).toBe(true);
		expect(errToOpenApiStr.content[0].text).toContain("fail openapi string");

		spyGenerateToOpenApi.mockRejectedValueOnce(new Error("fail openapi error"));
		const errToOpenApiErr = await toOpenApiHandler({
			input: "src",
			output: "out.yaml",
			format: "yaml",
		});
		expect(errToOpenApiErr.isError).toBe(true);
		expect(errToOpenApiErr.content[0].text).toContain("fail openapi error");

		// Simulate invoking cdd_ast_query
		const cdd_ast_query = mockTool.mock.calls.find(
			(call) => call[0] === "cdd_ast_query",
		);
		expect(cdd_ast_query).toBeDefined();

		const astQueryHandler = cdd_ast_query?.[3];

		vi.doMock("../../src/functions/utils.js", () => ({
			parseGeneratedModels: vi.fn().mockReturnValue({ model: "test" }),
			parseGeneratedServices: vi.fn().mockReturnValue({ service: "test" }),
			parseGeneratedMetadata: vi.fn().mockReturnValue({ metadata: "test" }),
		}));

		const resAstModels = await astQueryHandler({
			input: "test",
			queryType: "models",
		});
		expect(resAstModels.isError).toBeUndefined();
		expect(resAstModels.content[0].text).toContain('"model": "test"');

		const resAstServices = await astQueryHandler({
			input: "test",
			queryType: "services",
		});
		expect(resAstServices.isError).toBeUndefined();
		expect(resAstServices.content[0].text).toContain('"service": "test"');

		const resAstMetadata = await astQueryHandler({
			input: "test",
			queryType: "metadata",
		});
		expect(resAstMetadata.isError).toBeUndefined();
		expect(resAstMetadata.content[0].text).toContain('"metadata": "test"');

		// Test error handling
		vi.doMock("../../src/functions/utils.js", () => ({
			parseGeneratedModels: vi.fn().mockImplementation(() => {
				throw new Error("fail ast query");
			}),
			parseGeneratedServices: vi.fn(),
			parseGeneratedMetadata: vi.fn(),
		}));

		const errAstErr = await astQueryHandler({
			input: "test",
			queryType: "models",
		});
		expect(errAstErr.isError).toBe(true);
		expect(errAstErr.content[0].text).toContain("fail ast query");

		vi.doMock("../../src/functions/utils.js", () => ({
			parseGeneratedModels: vi.fn().mockImplementation(() => {
				throw "fail ast query string";
			}),
			parseGeneratedServices: vi.fn(),
			parseGeneratedMetadata: vi.fn(),
		}));

		const errAstStr = await astQueryHandler({
			input: "test",
			queryType: "models",
		});
		expect(errAstStr.isError).toBe(true);
		expect(errAstStr.content[0].text).toContain("fail ast query string");

		// Test unknown queryType fallback
		vi.doMock("../../src/functions/utils.js", () => ({
			parseGeneratedModels: vi.fn(),
			parseGeneratedServices: vi.fn(),
			parseGeneratedMetadata: vi.fn(),
		}));

		const resAstUnknown = await astQueryHandler({
			input: "test",
			queryType: "unknown" as any,
		});
		expect(resAstUnknown.isError).toBeUndefined();
		expect(resAstUnknown.content[0].text).toBeUndefined();

		vi.doUnmock("../../src/functions/utils.js");

		// Also simulate clientName
		await sdkHandler({
			input: "test.yaml",
			output: "out",
			framework: "vanilla",
			implementation: "fetch",
			tests: true,
			clientName: "Test",
		});
		expect(spyGenerateFromOpenApi).toHaveBeenCalledWith(
			expect.objectContaining({ clientName: "Test" }),
			"to_sdk",
		);

		expect(mockPrompt).toHaveBeenCalledTimes(1);
		const cdd_instructions = mockPrompt.mock.calls.find(
			(call) => call[0] === "cdd_instructions",
		);
		expect(cdd_instructions).toBeDefined();

		const promptHandler = cdd_instructions?.[2];
		const resPrompt1 = promptHandler({ topic: "SDK" });
		expect(resPrompt1.messages[0].content.text).toContain("Focus on: SDK");

		const resPrompt2 = promptHandler({});
		expect(resPrompt2.messages[0].content.text).not.toContain("Focus on:");

		expect(mockResource).toHaveBeenCalledTimes(1);
		const cdd_architecture = mockResource.mock.calls.find(
			(call) => call[0] === "cdd_architecture",
		);
		expect(cdd_architecture).toBeDefined();

		const resourceHandler = cdd_architecture?.[3];
		vi.doMock("node:fs/promises", () => ({
			readFile: vi.fn().mockResolvedValue("mock architecture content"),
		}));
		const resResource = await resourceHandler({
			href: "file:///ARCHITECTURE.md",
		} as any);
		expect(resResource.contents[0].text).toContain("mock architecture content");

		vi.doMock("node:fs/promises", () => ({
			readFile: vi.fn().mockRejectedValue(new Error("fail")),
		}));
		await expect(
			resourceHandler({ href: "file:///ARCHITECTURE.md" } as any),
		).rejects.toThrow("Could not read ARCHITECTURE.md");
		vi.doUnmock("node:fs/promises");
	});
});
