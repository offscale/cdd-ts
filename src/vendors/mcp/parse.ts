/**
 * Reverse-parses generated MCP server, client, and adapter TypeScript source files (`mcp.ts`, `mcp-client.ts`, `mcp-adapter.ts`, `mcp.routes.ts`) into structured metadata.
 *
 * @module vendors/mcp/parse
 */
import type { Project } from "ts-morph";

/**
 * Structured metadata extracted by `McpParser` from MCP source files in a `ts-morph` project.
 */
export interface ParsedMcpArtifact {
	/** Extracted MCP server name. */
	serverName: string;
	/** Extracted MCP server version. */
	serverVersion: string;
	/** Registered MCP tool names. */
	tools: string[];
	/** Registered MCP resource identifiers. */
	resources: string[];
	/** Registered MCP prompt identifiers. */
	prompts: string[];
	/** Whether human-in-the-loop sampling approval is present. */
	supportsHumanInTheLoopSampling: boolean;
	/** Whether human-in-the-loop tool call approval is present. */
	supportsHumanInTheLoopTools: boolean;
	/** Imported `@modelcontextprotocol/sdk/types.js` schema type names. */
	protocolTypes: string[];
}

/**
 * Reverse-parses Model Context Protocol (MCP) server, client, and adapter files in a `ts-morph` project.
 */
export class McpParser {
	/**
	 * Parses MCP artifacts from the given `ts-morph` project.
	 *
	 * @param project - The `ts-morph` project containing MCP source files.
	 * @returns Extracted `ParsedMcpArtifact` metadata.
	 */
	public parse(project: Project): ParsedMcpArtifact {
		let serverName = "api-mcp";
		let serverVersion = "1.0.0";
		const tools = new Set<string>();
		const resources = new Set<string>();
		const prompts = new Set<string>();
		const protocolTypes = new Set<string>();
		let supportsHumanInTheLoopSampling = false;
		let supportsHumanInTheLoopTools = false;

		for (const sourceFile of project.getSourceFiles()) {
			const text = sourceFile.getFullText();

			const nameMatch = /new McpServer\(\{\s*name:\s*['"]([^'"]+)['"]/.exec(
				text,
			);
			if (nameMatch?.[1]) {
				serverName = nameMatch[1];
			}

			const versionMatch =
				/new McpServer\(\{[\s\S]*?version:\s*['"]([^'"]+)['"]/.exec(text);
			if (versionMatch?.[1]) {
				serverVersion = versionMatch[1];
			}

			for (const m of text.match(/server\.tool\(\s*['"][^'"]+['"]/g) ?? []) {
				tools.add(m.replace(/^server\.tool\(\s*['"]|['"]$/g, ""));
			}

			for (const m of text.match(/server\.resource\(\s*['"][^'"]+['"]/g) ??
				[]) {
				resources.add(m.replace(/^server\.resource\(\s*['"]|['"]$/g, ""));
			}

			for (const m of text.match(/server\.prompt\(\s*['"][^'"]+['"]/g) ?? []) {
				prompts.add(m.replace(/^server\.prompt\(\s*['"]|['"]$/g, ""));
			}

			if (text.includes("samplingApprovalHandler")) {
				supportsHumanInTheLoopSampling = true;
			}
			if (text.includes("toolApprovalHandler")) {
				supportsHumanInTheLoopTools = true;
			}

			for (const imp of sourceFile.getImportDeclarations()) {
				if (
					imp.getModuleSpecifierValue() === "@modelcontextprotocol/sdk/types.js"
				) {
					for (const named of imp.getNamedImports()) {
						protocolTypes.add(named.getName());
					}
				}
			}
		}

		return {
			serverName,
			serverVersion,
			tools: Array.from(tools),
			resources: Array.from(resources),
			prompts: Array.from(prompts),
			supportsHumanInTheLoopSampling,
			supportsHumanInTheLoopTools,
			protocolTypes: Array.from(protocolTypes),
		};
	}
}
