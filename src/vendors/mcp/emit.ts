import { posix as path } from "node:path";
import type { Project } from "ts-morph";
import type { GeneratorConfig } from "../../core/types/index.js";
import type { Parameter } from "../../core/types/openapi.js";
import { snakeCase } from "../../functions/utils_string.js";
import type { SwaggerParser } from "../../openapi/parse.js";

export class McpGenerator {
	public generate(
		project: Project,
		parser: SwaggerParser,
		_config: GeneratorConfig,
		outputDir: string,
	) {
		const mcpFile = project.createSourceFile(
			path.join(outputDir, "mcp.ts"),
			"",
			{ overwrite: true },
		);

		mcpFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/server/mcp.js",
			namedImports: ["McpServer", "ResourceTemplate"],
		});
		mcpFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/server/stdio.js",
			namedImports: ["StdioServerTransport"],
		});
		mcpFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/server/sse.js",
			namedImports: ["SSEServerTransport"],
		});
		mcpFile.addImportDeclaration({
			moduleSpecifier: "express",
			defaultImport: "express",
		});
		mcpFile.addImportDeclaration({
			moduleSpecifier: "zod",
			namedImports: ["z"],
		});
		mcpFile.addImportDeclaration({
			moduleSpecifier: "./services/index.js",
			namespaceImport: "services",
		});

		const info = parser.spec.info || { title: "api-mcp", version: "1.0.0" };

		let statements = `
export function createMcpServer() {
    const server = new McpServer({
        name: '${info.title || "api-mcp"}',
        version: '${info.version || "1.0.0"}',
    });

    server.resource(
        'openapi_spec',
        'openapi://spec',
        { mimeType: 'application/json', description: 'The complete OpenAPI specification' },
        async (uri) => ({
            contents: [{
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify(${JSON.stringify(parser.spec)}, null, 2)
            }]
        })
    );

    server.prompt(
        'analyze_spec',
        {
            query: z.string().optional().describe('Specific query about the API (optional)'),
        },
        (args) => ({
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: \`Please analyze this OpenAPI specification. \${args.query ? \`Focus on: \${args.query}\` : 'Provide a general summary.'}\n\nSpec:\\n\${JSON.stringify(${JSON.stringify(parser.spec)}, null, 2)}\`
                    }
                }
            ]
        })
    );
`;

		for (const op of parser.operations) {
			const group = op.tags?.[0]
				? typeof op.tags[0] === "string"
					? op.tags[0]
					: (op.tags[0] as object as { name?: string }).name ||
						String(op.tags[0])
				: "Default";
			const serviceName = `${group}Service`;
			const methodName =
				op.operationId || op.path.replace(/\//g, "_").replace(/^_/, "");
			const toolName = snakeCase(methodName);
			const opDesc = (op.summary || op.description || "").replace(/'/g, "\\'");

			statements += `
    server.resource(
        'openapi_operation_${toolName}',
        new ResourceTemplate('openapi://operations/${toolName}'),
        { mimeType: 'application/json', description: 'Operation details for ${toolName}', annotations: { audience: ["developer"], priority: 0 } },
        async (uri) => ({
            contents: [{
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify(${JSON.stringify(op).replace(/\n/g, "\\n").replace(/'/g, "\\'")}, null, 2)
            }]
        })
    );

    server.tool(
        '${toolName}',
        '${opDesc}',
        {`;

			if (op.parameters) {
				for (const param of op.parameters) {
					const p = param as Parameter;
					if (p.name) {
						const zodType = p.required ? "z.string()" : "z.string().optional()";
						const desc = (p.description || "").replace(/'/g, "\\'");
						statements += `\n            ${p.name}: ${zodType}${desc ? `.describe('${desc}')` : ""},`;
					}
				}
			}
			if (op.requestBody) {
				statements += `\n            body: z.any().optional().describe('JSON request body'),`;
			}

			statements += `
        },
        async (args) => {
            try {
                const client = new services.${serviceName}();
                const res = await client.${methodName}(args as any);
                return {
                    content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }]
                };
            }
        }
    );
`;
		}

		statements += `
    return server;
}

export async function serveMcp() {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

export function serveMcpSse(port = 3001) {
    const app = express();
    const server = createMcpServer();
    let transport: SSEServerTransport;

    app.get("/mcp/sse", async (req, res) => {
        transport = new SSEServerTransport("/mcp/messages", res);
        await server.connect(transport);
    });

    app.post("/mcp/messages", async (req, res) => {
        if (transport) {
            await transport.handlePostMessage(req, res);
        } else {
            res.status(400).send("SSE connection not established");
        }
    });

    app.listen(port, () => {
        console.log(\`MCP SSE Server listening on port \${port}\`);
    });
}
`;
		mcpFile.addStatements(statements);
		mcpFile.saveSync();

		// Generate mcp-adapter.ts for programmatic SDK integration
		const adapterFile = project.createSourceFile(
			path.join(outputDir, "mcp-adapter.ts"),
			"",
			{ overwrite: true },
		);

		// Generate mcp-client.ts for consuming remote or stdio MCP servers
		const clientFile = project.createSourceFile(
			path.join(outputDir, "mcp-client.ts"),
			"",
			{ overwrite: true },
		);
		clientFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/client/index.js",
			namedImports: ["Client"],
		});
		clientFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/client/stdio.js",
			namedImports: ["StdioClientTransport"],
		});
		clientFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/client/sse.js",
			namedImports: ["SSEClientTransport"],
		});
		clientFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/types.js",
			namedImports: [
				"CallToolResult",
				"CallToolRequest",
				"CompleteRequest",
				"CompleteResult",
				"ListRootsResult",
				"ListToolsResult",
				"ListPromptsResult",
				"ListResourcesResult",
				"ListResourceTemplatesResult",
				"CreateMessageResult",
				"ReadResourceResult",
			],
		});

		const clientStatements = `
export class McpClient {
    private client: Client;
    private stdioTransport?: StdioClientTransport;
    private sseTransport?: SSEClientTransport;

    constructor() {
        this.client = new Client(
            {
                name: '${info.title || "api-mcp"}-client',
                version: '${info.version || "1.0.0"}',
            },
            {
                capabilities: {
                    tools: {},
                    prompts: {},
                    resources: { subscribe: true },
                    roots: { listChanged: true },
                    sampling: {},
                    experimental: {}
                },
            }
        );
    }

    async connectStdio(
        serverCommand: string,
        serverArgs: string[] = [],
        env?: Record<string, string>
    ): Promise<void> {
        this.stdioTransport = new StdioClientTransport({
            command: serverCommand,
            args: serverArgs,
            env
        });
        await this.client.connect(this.stdioTransport);
    }

    async connectSSE(url: string | URL): Promise<void> {
        this.sseTransport = new SSEClientTransport(new URL(url));
        await this.client.connect(this.sseTransport);
    }

    async close(): Promise<void> {
        if (this.stdioTransport) {
            await this.stdioTransport.close();
        }
        if (this.sseTransport) {
            await this.sseTransport.close();
        }
    }

    async ping(): Promise<void> {
        await this.client.ping();
    }

    async executeTool(name: string, args: Record<string, any>): Promise<CallToolResult> {
        return await this.client.callTool({
            name,
            arguments: args
        });
    }

    async getTools(cursor?: string): Promise<ListToolsResult> {
        return await this.client.listTools({ cursor });
    }

    async getPrompts(cursor?: string): Promise<ListPromptsResult> {
        return await this.client.listPrompts({ cursor });
    }

    async getPrompt(name: string, args?: Record<string, string>) {
        return await this.client.getPrompt({
            name,
            arguments: args
        });
    }

    async getResources(cursor?: string): Promise<ListResourcesResult> {
        return await this.client.listResources({ cursor });
    }

    async getResourceTemplates(cursor?: string): Promise<ListResourceTemplatesResult> {
        return await this.client.listResourceTemplates({ cursor });
    }

    async readResource(uri: string): Promise<ReadResourceResult> {
        return await this.client.readResource({ uri });
    }

    async subscribeResource(uri: string): Promise<void> {
        await this.client.subscribeResource({ uri });
    }

    async unsubscribeResource(uri: string): Promise<void> {
        await this.client.unsubscribeResource({ uri });
    }

    async complete(ref: any, argument: { name: string, value: string }): Promise<CompleteResult> {
        return await this.client.complete({
            ref,
            argument
        });
    }

    async setLoggingLevel(level: any): Promise<void> {
        await this.client.setLoggingLevel({ level });
    }

    async sendRootsListChanged(): Promise<void> {
        await this.client.sendRootsListChanged();
    }
}
`;
		clientFile.addStatements(clientStatements);
		clientFile.saveSync();
		adapterFile.addImportDeclaration({
			moduleSpecifier: "@modelcontextprotocol/sdk/types.js",
			namedImports: [
				"CallToolResult",
				"Tool",
				"Resource",
				"ReadResourceResult",
				"Prompt",
				"GetPromptResult",
			],
		});
		adapterFile.addImportDeclaration({
			moduleSpecifier: "./services/index.js",
			namespaceImport: "services",
		});

		let adapterStatements = `
		export class McpAdapter {
		getResources(): Resource[] {
		return [
		{
		uri: 'openapi://spec',
		name: 'openapi_spec',
		mimeType: 'application/json',
		description: 'The complete OpenAPI specification'
		}
		];
		}

		async readResource(uri: string): Promise<ReadResourceResult> {
		if (uri === 'openapi://spec') {
		return {
		contents: [{
		    uri,
		    mimeType: 'application/json',
		    text: JSON.stringify(${JSON.stringify(parser.spec)}, null, 2)
		}]
		};
		}

		if (uri.startsWith('openapi://operations/')) {
		const toolName = uri.replace('openapi://operations/', '');
		switch (toolName) {`;

		let toolStatements = `
		getTools(): Tool[] {
		return [`;

		let executeStatements = `
		async executeTool(name: string, args: any): Promise<CallToolResult> {
		try {
		switch (name) {`;

		for (const op of parser.operations) {
			const group = op.tags?.[0]
				? typeof op.tags[0] === "string"
					? op.tags[0]
					: (op.tags[0] as object as { name?: string }).name ||
						String(op.tags[0])
				: "Default";
			const serviceName = `${group}Service`;
			const methodName =
				op.operationId || op.path.replace(/\//g, "_").replace(/^_/, "");
			const toolName = snakeCase(methodName);
			const opDesc = (op.summary || op.description || "").replace(/'/g, "\\'");

			const properties: Record<string, unknown> = {};
			const required: string[] = [];

			if (op.parameters) {
				for (const param of op.parameters) {
					const p = param as Parameter;
					if (p.name) {
						properties[p.name] = {
							type: "string",
							description: p.description || "",
						};
						if (p.required) {
							required.push(p.name);
						}
					}
				}
			}
			if (op.requestBody) {
				properties.body = {
					type: "object",
					description: "JSON request body",
				};
			}

			const inputSchema = {
				type: "object",
				properties,
				required: required.length > 0 ? required : undefined,
			};

			adapterStatements += `
		case '${toolName}':
		    return {
		        contents: [{
		            uri,
		            mimeType: 'application/json',
		            text: JSON.stringify(${JSON.stringify(op).replace(/\n/g, "\\n").replace(/'/g, "\\'")}, null, 2)
		        }]
		    };`;

			toolStatements += `
		{
		name: '${toolName}',
		description: '${opDesc}',
		inputSchema: ${JSON.stringify(inputSchema, null, 16).replace(/\n/g, "\n                ")},
		},`;

			executeStatements += `
		case '${toolName}': {
		    const client = new services.${serviceName}();
		    const res = await client.${methodName}(args);
		    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
		}`;
		}

		adapterStatements += `
		default:
		    throw new Error(\`Resource not found: \${uri}\`);
		}
		}
		throw new Error(\`Resource not found: \${uri}\`);
		}
		`;

		toolStatements += `
		];
		}
		`;

		executeStatements += `
		default:
		    return { isError: true, content: [{ type: 'text', text: \`Unknown tool: \${name}\` }] };
		}
		} catch (err) {
		return {
		isError: true,
		content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }]
		};
		}
		}

		getPrompts(): Prompt[] {
		return [
		{
		name: 'analyze_spec',
		description: 'Analyze the OpenAPI specification',
		arguments: [
		    {
		        name: 'query',
		        description: 'Specific query about the API (optional)',
		        required: false
		    }
		]
		}
		];
		}

		async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
		if (name === 'analyze_spec') {
		return {
		description: 'Analyze the OpenAPI specification',
		messages: [
		    {
		        role: 'user',
		        content: {
		            type: 'text',
		            text: \`Please analyze this OpenAPI specification. \${args?.query ? \`Focus on: \${args.query}\` : 'Provide a general summary.'}\n\nSpec:\n${JSON.stringify(parser.spec, null, 2).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`
		        }
		    }
		]
		};
		}
		throw new Error(\`Prompt not found: \${name}\`);
		}
		}
		`;
		adapterFile.addStatements(
			adapterStatements + toolStatements + executeStatements,
		);
		adapterFile.saveSync();
	}
}
