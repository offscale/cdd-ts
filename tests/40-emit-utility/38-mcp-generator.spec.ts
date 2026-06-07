import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { McpGenerator } from "../../src/vendors/mcp/emit.js";
import type { SwaggerParser } from "../../src/openapi/parse.js";
import type { GeneratorConfig } from "../../src/core/types/index.js";

describe("McpGenerator", () => {
	it("should generate mcp server file based on parser operations", async () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser = {
			spec: {
				info: { title: "Test API", version: "2.0.0" },
			},
			operations: [
				{
					tags: ["TestTag"],
					operationId: "testOp",
					path: "/test",
					summary: "A test operation",
					parameters: [
						{ name: "param1", required: true, description: "first param" },
						{ name: "param2", required: false },
						{
							/* nameless parameter should be ignored */
						},
					],
					requestBody: {},
				},
				{
					// No tags, no operationId, no parameters, no body
					path: "/fallback",
				},
				{
					// Tags as objects
					tags: [{ name: "ObjTag" }],
					path: "/obj",
				},
				{
					// Tag as object without name
					tags: [{}],
					path: "/objnoname",
				},
			],
		} as unknown as SwaggerParser;

		const config = {} as GeneratorConfig;
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
			"body: z.any().optional().describe('JSON request body')",
		);
		expect(text).toContain("const client = new services.TestTagService()");
		expect(text).toContain("const res = await client.testOp(args as any)");

		// Check fallback tool
		expect(text).toContain("'fallback'");
		expect(text).toContain("const client = new services.DefaultService()");
		expect(text).toContain("const res = await client.fallback(args as any)");

		// Check object tag tool
		expect(text).toContain("'obj'");
		expect(text).toContain("const client = new services.ObjTagService()");

		// Check object tag tool without name
		expect(text).toContain("'objnoname'");
		expect(text).toContain(
			"const client = new services.[object Object]Service()",
		);

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
			"async executeTool(name: string, args: any): Promise<CallToolResult>",
		);
		expect(adapterText).toContain("case 'test_op': {");
		expect(adapterText).toContain(
			"const client = new services.TestTagService()",
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
		const parser = {
			spec: {},
			operations: [],
		} as unknown as SwaggerParser;

		const generator = new McpGenerator();
		generator.generate(project, parser, {} as GeneratorConfig, "/out2");
		const mcpFile = project.getSourceFile("/out2/mcp.ts");
		const text = mcpFile?.getFullText();
		expect(text).toContain("name: 'api-mcp'");
		expect(text).toContain("version: '1.0.0'");
	});

	it("should handle partial info object", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser = {
			spec: { info: {} },
			operations: [],
		} as unknown as SwaggerParser;

		const generator = new McpGenerator();
		generator.generate(project, parser, {} as GeneratorConfig, "/out3");
		const mcpFile = project.getSourceFile("/out3/mcp.ts");
		const text = mcpFile?.getFullText();
		expect(text).toContain("name: 'api-mcp'");
		expect(text).toContain("version: '1.0.0'");
	});
});
