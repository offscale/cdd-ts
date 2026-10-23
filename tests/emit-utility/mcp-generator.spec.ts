import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import type { GeneratorConfig } from "../../src/core/types/index.js";
import { IdpAuthHelperGenerator } from "../../src/openapi/emit_idp_auth.js";
import type { SwaggerParser } from "../../src/openapi/parse.js";
import { McpGenerator } from "../../src/vendors/mcp/emit.js";
import { McpParser } from "../../src/vendors/mcp/parse.js";
import { createTestConfig, createTestSpec } from "../shared/helpers.js";

describe("McpGenerator", () => {
	it("should generate mcp server file based on parser operations", async () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser: Pick<SwaggerParser, "spec" | "operations"> = {
			spec: {
				info: { title: "Test API", version: "2.0.0" },
			},
			operations: [
				{
					tags: ["TestTag"],
					operationId: "testOp",
					path: "/test",
					method: "GET",
					summary: "A test operation",
					parameters: [
						{
							name: "param1",
							in: "query",
							required: true,
							description: "first param",
						},
						{ name: "param2", in: "query", required: false },
						{
							name: "",
							in: "query",
						},
					],
					requestBody: { content: {} },
				},
				{
					// No tags, no operationId, no parameters, no body
					path: "/fallback",
					method: "GET",
				},
				{
					// Hyphenated tag
					tags: ["obj-tag"],
					path: "/obj",
					method: "GET",
				},
			],
		};

		const config: GeneratorConfig = createTestConfig({});
		const generator = new McpGenerator();
		generator.generate(project, parser, config, "/out");

		const mcpFile = project.getSourceFile("/out/mcp.ts");
		expect(mcpFile).toBeDefined();

		const text = mcpFile?.getFullText();
		expect(text).toContain("name: 'Test API'");
		expect(text).toContain("version: '2.0.0'");

		expect(text).toContain("server.resource(");
		expect(text).toContain("'openapi_spec'");
		expect(text).toContain("'openapi://spec'");
		expect(text).toContain("mimeType: 'application/json'");
		expect(text).toContain(
			'text: JSON.stringify({"info":{"title":"Test API","version":"2.0.0"}}, null, 2)',
		);

		expect(text).toContain("server.resource(");
		expect(text).toContain("new ResourceTemplate(");
		expect(text).toContain("'openapi_operation_test_op'");
		expect(text).toContain("'openapi://operations/test_op'");

		expect(text).toContain("server.prompt(");
		expect(text).toContain("'analyze_spec'");
		expect(text).toContain("query: z.string().optional()");

		// Check testOp tool
		expect(text).toContain("server.tool(");
		expect(text).toContain("'test_op'");
		expect(text).toContain("'A test operation'");
		expect(text).toContain("param1: z.string().describe('first param')");
		expect(text).toContain("param2: z.string().optional()");
		expect(text).toContain(
			"body: z.unknown().optional().describe('JSON request body')",
		);
		expect(text).toContain("const client = new services.TestTagClient()");
		expect(text).toContain("const res = await client.testOp(args)");

		// Check fallback tool
		expect(text).toContain("'fallback'");
		expect(text).toContain("const client = new services.DefaultClient()");
		expect(text).toContain("const res = await client.fallback(args)");

		// Check hyphenated tag tool
		expect(text).toContain("'obj'");
		expect(text).toContain("const client = new services.ObjTagClient()");

		const adapterFile = project.getSourceFile("/out/mcp-adapter.ts");
		expect(adapterFile).toBeDefined();

		const adapterText = adapterFile?.getFullText();
		expect(adapterText).toContain("export class McpAdapter");
		expect(adapterText).toContain("getTools(): Tool[]");
		expect(adapterText).toContain("name: 'test_op'");
		expect(adapterText).toContain("description: 'A test operation'");
		expect(adapterText).toContain('"required": [');
		expect(adapterText).toContain('"param1"');
		expect(adapterText).toContain(
			"async executeTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>",
		);
		expect(adapterText).toContain("case 'test_op': {");
		expect(adapterText).toContain(
			"const client = new services.TestTagClient()",
		);
		expect(adapterText).toContain(
			"return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };",
		);
		expect(adapterText).toContain("default:");
		expect(adapterText).toContain(
			"return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };",
		);
	});

	it("should handle missing info object completely", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser: Pick<SwaggerParser, "spec" | "operations"> = {
			spec: createTestSpec({}),
			operations: [],
		};

		const generator = new McpGenerator();
		generator.generate(project, parser, createTestConfig({}), "/out2");
		const mcpFile = project.getSourceFile("/out2/mcp.ts");
		const text = mcpFile?.getFullText();
		expect(text).toContain("name: 'api-mcp'");
		expect(text).toContain("version: '1.0.0'");
	});

	it("should handle partial info object", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser: Pick<SwaggerParser, "spec" | "operations"> = {
			spec: createTestSpec({ info: {} }),
			operations: [],
		};

		const generator = new McpGenerator();
		generator.generate(project, parser, createTestConfig({}), "/out3");
		const mcpFile = project.getSourceFile("/out3/mcp.ts");
		const text = mcpFile?.getFullText();
		expect(text).toContain("name: 'api-mcp'");
		expect(text).toContain("version: '1.0.0'");
	});

	it("should reverse-parse generated MCP artifacts via McpParser", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser: Pick<SwaggerParser, "spec" | "operations"> = {
			spec: {
				info: { title: "Parsed MCP API", version: "3.1.0" },
			},
			operations: [
				{
					tags: ["Users"],
					operationId: "listUsers",
					path: "/users",
					method: "GET",
					summary: "List users",
				},
			],
		};

		new McpGenerator().generate(project, parser, createTestConfig({}), "/mcp");
		project.createSourceFile(
			"/mcp/other.ts",
			'import { z } from "zod"; export const x = 1;',
		);

		const mcpParser = new McpParser();
		const parsed = mcpParser.parse(project);
		expect(parsed.serverName).toBe("Parsed MCP API");
		expect(parsed.serverVersion).toBe("3.1.0");
		expect(parsed.tools).toContain("list_users");
		expect(parsed.resources).toContain("openapi_spec");
		expect(parsed.prompts).toContain("analyze_spec");
		expect(parsed.supportsHumanInTheLoopSampling).toBe(true);
		expect(parsed.supportsHumanInTheLoopTools).toBe(true);
		expect(parsed.protocolTypes).toContain("CreateMessageRequest");
		expect(parsed.protocolTypes).toContain("CallToolRequest");

		const emptyProject = new Project({ useInMemoryFileSystem: true });
		const emptyParsed = mcpParser.parse(emptyProject);
		expect(emptyParsed.serverName).toBe("api-mcp");
		expect(emptyParsed.serverVersion).toBe("1.0.0");
		expect(emptyParsed.supportsHumanInTheLoopSampling).toBe(false);
		expect(emptyParsed.supportsHumanInTheLoopTools).toBe(false);
	});

	it("should generate utils/auth-session.ts via IdpAuthHelperGenerator", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const authGen = new IdpAuthHelperGenerator(project);
		authGen.generate("/sdk-out");

		const authFile = project.getSourceFileOrThrow(
			"/sdk-out/utils/auth-session.ts",
		);
		const text = authFile.getFullText();
		expect(text).toContain("export interface AuthSession");
		expect(text).toContain("export class SdkAuthClient");
		expect(text).toContain("async register(");
		expect(text).toContain("async login(");
		expect(text).toContain("async refresh(");
		expect(text).toContain("async logout(");
		expect(text).toContain("getAuthorizationHeader()");
	});
});
