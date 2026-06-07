import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
	type CliOptions,
	generateFromOpenApi,
	generateToOpenApi,
	type ToActionOptions,
} from "./cli.js";

/**
 * Initializes and starts the Model Context Protocol (MCP) server over stdio.
 * Provides tools for schema inspection, bidirectional sync, and SDK/server generation.
 */
export async function serveMcp() {
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
				const options: CliOptions = {
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
			serverFramework: z
				.enum(["express", "node", "bun", "deno"])
				.default("express"),
			orm: z.enum(["typeorm"]).optional(),
		},
		async (args) => {
			try {
				const options: CliOptions = {
					input: args.input,
					output: args.output,
					serverFramework: args.serverFramework as
						| "express"
						| "node"
						| "bun"
						| "deno",
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
				const parser = await SwaggerParser.create(args.input, {} as any);
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

				let result: unknown;
				if (args.queryType === "models") {
					result = parseGeneratedModels(args.input, fs as any);
				} else if (args.queryType === "services") {
					result = parseGeneratedServices(args.input, fs as any);
				} else if (args.queryType === "metadata") {
					result = parseGeneratedMetadata(args.input, fs as any);
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
