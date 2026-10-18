/**
 * Model Context Protocol (MCP) server implementation over stdio for cdd-ts.
 *
 * @module mcp_server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
	type FromOpenApiOptions,
	generateFromArazzoSync,
	generateFromOpenApi,
	generateToArazzo,
	generateToOpenApi,
	type ToActionOptions,
} from "./cli.js";

/**
 * Initializes and starts the Model Context Protocol (MCP) server over stdio.
 * Provides tools for schema inspection, bidirectional sync, and SDK/server generation.
 *
 * @returns A promise that resolves once the MCP stdio transport is connected.
 * @throws {Error} When the stdio transport fails to connect.
 */
export async function serveMcp(): Promise<void> {
	const mcp = new McpServer({
		name: "cdd-ts-mcp-server",
		version: "1.0.0",
	});

	mcp.tool(
		"cdd_generate_sdk",
		"Generate an SDK from an OpenAPI spec",
		{
			input: z.string().describe("Path to the OpenAPI input spec"),
			output: z.string().describe("Output directory"),
			framework: z
				.enum(["angular", "react", "vue", "vanilla", "Vanilla JS"])
				.default("vanilla"),
			implementation: z
				.enum(["angular", "fetch", "axios", "node"])
				.default("fetch"),
			clientName: z.string().optional(),
			tests: z.boolean().default(true),
		},
		async (args) => {
			try {
				const options: FromOpenApiOptions = {
					input: args.input,
					output: args.output,
					framework: args.framework as
						| "angular"
						| "react"
						| "vue"
						| "vanilla"
						| "Vanilla JS",
					implementation: args.implementation as
						| "angular"
						| "fetch"
						| "axios"
						| "node",
					tests: args.tests,
				};
				if (args.clientName) {
					options.clientName = args.clientName;
				}
				await generateFromOpenApi(options, "to_sdk");
				return {
					content: [
						{
							type: "text",
							text: `Successfully generated SDK in ${args.output}`,
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to generate SDK: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			}
		},
	);

	mcp.tool(
		"cdd_generate_server",
		"Generate a server from an OpenAPI spec",
		{
			input: z.string().describe("Path to the OpenAPI input spec"),
			output: z.string().describe("Output directory"),
			framework: z.enum(["express", "node", "bun", "deno"]).default("express"),
			orm: z.enum(["typeorm"]).optional(),
		},
		async (args) => {
			try {
				const options: FromOpenApiOptions = {
					input: args.input,
					output: args.output,
					framework: args.framework as "express" | "node" | "bun" | "deno",
				};
				if (args.orm) {
					options.orm = args.orm;
				}
				await generateFromOpenApi(options, "to_server");
				return {
					content: [
						{
							type: "text",
							text: `Successfully generated server in ${args.output}`,
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to generate server: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			}
		},
	);

	mcp.tool(
		"cdd_to_openapi",
		"Bidirectional sync: Generate OpenAPI spec from source code",
		{
			input: z.string().describe("Path to source code directory"),
			output: z.string().describe("Output OpenAPI spec file path"),
			format: z.enum(["json", "yaml"]).default("yaml"),
			orm: z.enum(["typeorm"]).optional(),
		},
		async (args) => {
			try {
				const options: ToActionOptions = {
					input: args.input,
					output: args.output,
					format: args.format as "json" | "yaml",
				};
				if (args.orm) {
					options.orm = args.orm;
				}
				await generateToOpenApi(options);
				return {
					content: [
						{
							type: "text",
							text: `Successfully extracted OpenAPI spec to ${args.output}`,
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to extract OpenAPI spec: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			}
		},
	);

	mcp.tool(
		"cdd_inspect_schema",
		"Inspect loaded OpenAPI schemas",
		{
			input: z.string().describe("Path to the OpenAPI input spec"),
		},
		async (args) => {
			try {
				const { SwaggerParser } = await import("./openapi/parse.js");
				const parser = await SwaggerParser.create(args.input, {
					input: args.input,
					output: "",
					options: {},
				});
				const info = parser.spec.info || { title: "Unknown", version: "1.0.0" };
				const pathsCount = Object.keys(parser.spec.paths || {}).length;
				return {
					content: [
						{
							type: "text",
							text: `Schema: ${info.title} (v${info.version})\nPaths: ${pathsCount}\nComponents: ${Object.keys(parser.spec.components?.schemas || {}).length} schemas`,
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to inspect schema: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			}
		},
	);

	mcp.tool(
		"cdd_ast_query",
		"Query the internal AST or type structures of a project",
		{
			input: z.string().describe("Path to the project directory or file"),
			queryType: z.enum(["services", "models", "metadata"]).default("models"),
		},
		async (args) => {
			try {
				const {
					parseGeneratedModels,
					parseGeneratedServices,
					parseGeneratedMetadata,
				} = await import("./functions/utils.js");
				const fs = await import("node:fs");
				const fsAdapter = {
					statSync: fs.statSync,
					readFileSync: fs.readFileSync as (
						filePath: string,
						encoding: string,
					) => string,
					readdirSync: fs.readdirSync,
					existsSync: fs.existsSync,
				};

				let result: unknown;
				if (args.queryType === "models") {
					result = parseGeneratedModels(args.input, fsAdapter);
				} else if (args.queryType === "services") {
					result = parseGeneratedServices(args.input, fsAdapter);
				} else if (args.queryType === "metadata") {
					result = parseGeneratedMetadata(args.input, fsAdapter);
				}

				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to query AST: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			}
		},
	);

	mcp.tool(
		"cdd_generate_arazzo_sdk",
		"Generate a TypeScript SDK WorkflowOrchestrator from an Arazzo 1.1.0 spec",
		{
			input: z.string().describe("Path to the Arazzo 1.1.0 input spec"),
			output: z.string().describe("Output directory"),
			scope: z.enum(["sdk", "cli", "server"]).default("sdk"),
		},
		async (args) => {
			try {
				generateFromArazzoSync(args.input, args.output, args.scope);
				return {
					content: [
						{
							type: "text",
							text: `Successfully generated Arazzo ${args.scope} in ${args.output}`,
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to generate Arazzo ${args.scope}: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			}
		},
	);

	mcp.tool(
		"cdd_generate_arazzo_server",
		"Generate Server workflow routes and Vitest E2E workflow suites from an Arazzo 1.1.0 spec",
		{
			input: z.string().describe("Path to the Arazzo 1.1.0 input spec"),
			output: z.string().describe("Output directory"),
		},
		async (args) => {
			try {
				generateFromArazzoSync(args.input, args.output, "server");
				return {
					content: [
						{
							type: "text",
							text: `Successfully generated Arazzo server in ${args.output}`,
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to generate Arazzo server: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			}
		},
	);

	mcp.tool(
		"cdd_to_arazzo",
		"Reverse-parse TypeScript workflows into an Arazzo 1.1.0 spec",
		{
			input: z
				.string()
				.describe("Path to TypeScript workflow file or directory"),
			output: z.string().describe("Output Arazzo spec file path"),
			format: z.enum(["json", "yaml"]).default("yaml"),
		},
		async (args) => {
			try {
				generateToArazzo({
					input: args.input,
					output: args.output,
					format: args.format,
				});
				return {
					content: [
						{
							type: "text",
							text: `Successfully extracted Arazzo spec to ${args.output}`,
						},
					],
				};
			} catch (err) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `Failed to extract Arazzo spec: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
				};
			}
		},
	);

	mcp.resource(
		"cdd_architecture",
		"file:///ARCHITECTURE.md",
		{
			mimeType: "text/markdown",
			description: "cdd-ts architecture documentation",
		},
		async (uri) => {
			const fs = await import("node:fs/promises");
			const path = await import("node:path");
			try {
				const text = await fs.readFile(
					path.join(process.cwd(), "ARCHITECTURE.md"),
					"utf-8",
				);
				return {
					contents: [
						{
							uri: uri.href,
							mimeType: "text/markdown",
							text,
						},
					],
				};
			} catch (_e) {
				throw new Error("Could not read ARCHITECTURE.md");
			}
		},
	);

	mcp.prompt(
		"cdd_instructions",
		{
			topic: z.string().optional().describe("Specific code generation topic"),
		},
		(args) => ({
			messages: [
				{
					role: "user",
					content: {
						type: "text",
						text: `Here are the cdd-ts code generation instructions. ${args.topic ? `Focus on: ${args.topic}` : ""} 
This generator creates strictly typed SDKs and servers from OpenAPI specifications.`,
					},
				},
			],
		}),
	);

	const transport = new StdioServerTransport();
	await mcp.connect(transport);
}
