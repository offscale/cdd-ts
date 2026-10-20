/**
 * Generates Express routes for Model Context Protocol (MCP) SSE and message handling.
 *
 * @module vendors/express/express-mcp.generator
 */
import path from "node:path";
import type { CodeBlockWriter, Project } from "ts-morph";
import type { GeneratorConfig } from "../../core/types/config.js";
import type { Parameter } from "../../core/types/openapi.js";
import type { SwaggerParser } from "../../openapi/parse.js";

/**
 * Generates Express routes for Model Context Protocol (MCP) SSE and message handling.
 *
 * @param project - The `ts-morph` project.
 * @param parser - The parsed OpenAPI specification.
 * @param outputDir - Target directory for `mcp.routes.ts`.
 * @param _config - Optional generator configuration.
 */
export function generateExpressMcpRoutes(
	project: Project,
	parser: {
		spec?: SwaggerParser["spec"] | undefined;
		operations: SwaggerParser["operations"];
	},
	outputDir: string,
	_config?: GeneratorConfig,
): void {
	const filePath = path.join(outputDir, "mcp.routes.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "express",
		namedImports: ["Router", "Request", "Response"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "@modelcontextprotocol/sdk/server/mcp.js",
		namedImports: ["McpServer"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "@modelcontextprotocol/sdk/server/sse.js",
		namedImports: ["SSEServerTransport"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "zod",
		namedImports: ["z"],
	});
	if (_config?.options?.generateServices) {
		sourceFile.addImportDeclaration({
			moduleSpecifier: "../services/index.js",
			namespaceImport: "services",
		});
	}

	const info = parser?.spec?.info;
	const title = info?.title || "api-mcp";
	const version = info?.version || "1.0.0";

	sourceFile.addFunction({
		isExported: true,
		name: "createMcpRouter",
		statements: (writer: CodeBlockWriter) => {
			writer.writeLine("const router = Router();");
			writer.writeLine("const server = new McpServer({");
			writer.indent(() => {
				writer.writeLine(`name: '${title}',`);
				writer.writeLine(`version: '${version}',`);
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine("server.resource(");
			writer.indent(() => {
				writer.writeLine("'openapi_spec',");
				writer.writeLine("'openapi://spec',");
				writer.writeLine(
					"{ mimeType: 'application/json', description: 'The complete OpenAPI specification' },",
				);
				writer.writeLine("async (uri) => ({");
				writer.indent(() => {
					writer.writeLine("contents: [{");
					writer.indent(() => {
						writer.writeLine("uri: uri.href,");
						writer.writeLine("mimeType: 'application/json',");
						writer.writeLine('text: "{}"');
					});
					writer.writeLine("}]");
				});
				writer.writeLine("})");
			});
			writer.writeLine(");");
			writer.blankLine();
			writer.writeLine("server.prompt(");
			writer.indent(() => {
				writer.writeLine("'analyze_spec',");
				writer.writeLine("{");
				writer.indent(() => {
					writer.writeLine(
						"query: z.string().optional().describe('Specific query about the API (optional)'),",
					);
				});
				writer.writeLine("},");
				writer.writeLine("async (args: { query?: string }) => ({");
				writer.indent(() => {
					writer.writeLine("messages: [");
					writer.indent(() => {
						writer.writeLine("{");
						writer.indent(() => {
							writer.writeLine("role: 'user' as const,");
							writer.writeLine("content: {");
							writer.indent(() => {
								writer.writeLine("type: 'text' as const,");
								writer.writeLine(
									"text: `Please analyze this OpenAPI specification. ${args.query ? `Focus on: ${args.query}` : 'Provide a general summary.'}` + ' {}',",
								);
							});
							writer.writeLine("}");
						});
						writer.writeLine("}");
					});
					writer.writeLine("]");
				});
				writer.writeLine("})");
			});
			writer.writeLine(");");

			for (const op of parser.operations) {
				const group = op.tags?.[0] || "Default";
				const serviceName = `${group}Service`;
				const methodName =
					op.operationId || op.path.replace(/\//g, "_").replace(/^_/, "");

				let toolName = methodName.replace(
					/[A-Z]/g,
					(letter: string) => `_${letter.toLowerCase()}`,
				);
				if (toolName.startsWith("_")) toolName = toolName.slice(1);

				const opDesc = (op.summary || op.description || "").replace(/'/g, "'");

				writer.blankLine();
				writer.writeLine("server.tool(");
				writer.indent(() => {
					writer.writeLine(`'${toolName}',`);
					writer.writeLine(`'${opDesc}',`);
					writer.writeLine("{");
					writer.indent(() => {
						if (op.parameters) {
							for (const param of op.parameters) {
								const p = param as Parameter;
								if (p.name) {
									const zodType = p.required
										? "z.string()"
										: "z.string().optional()";
									const desc = (p.description || "").replace(/'/g, "'");
									writer.writeLine(
										`${p.name}: ${zodType}${desc ? `.describe('${desc}')` : ""},`,
									);
								}
							}
						}
						if (op.requestBody) {
							writer.writeLine(
								"body: z.unknown().optional().describe('JSON request body'),",
							);
						}
					});
					writer.writeLine("},");
					writer.writeLine("async (args: Record<string, unknown>) => {");
					writer.indent(() => {
						writer.writeLine("try {");
						writer.indent(() => {
							if (_config?.options?.generateServices) {
								writer.writeLine(
									`const client = new services.${serviceName}();`,
								);
								writer.writeLine(
									`const res = await client.${methodName}(args);`,
								);
							} else {
								writer.writeLine(
									'const res = { message: "Mock MCP execution. Enable --generateServices to bind real clients." };',
								);
							}
							writer.writeLine("return {");
							writer.indent(() => {
								writer.writeLine(
									"content: [{ type: 'text' as const, text: JSON.stringify(res, null, 2) }]",
								);
							});
							writer.writeLine("};");
						});
						writer.writeLine("} catch (err) {");
						writer.indent(() => {
							writer.writeLine("return {");
							writer.indent(() => {
								writer.writeLine("isError: true,");
								writer.writeLine(
									"content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }]",
								);
							});
							writer.writeLine("};");
						});
						writer.writeLine("}");
					});
					writer.writeLine("}");
				});
				writer.writeLine(");");
			}

			writer.blankLine();
			writer.writeLine("let transport: SSEServerTransport;");
			writer.blankLine();
			writer.writeLine(
				"router.get('/mcp/sse', async (req: Request, res: Response) => {",
			);
			writer.indent(() => {
				writer.writeLine(
					"transport = new SSEServerTransport('/mcp/messages', res);",
				);
				writer.writeLine("await server.connect(transport);");
				writer.writeLine("if (req.headers.authorization) {");
				writer.indent(() => {
					writer.writeLine(
						"Reflect.set(server, 'auth', req.headers.authorization);",
					);
				});
				writer.writeLine("}");
				writer.writeLine("await transport.start();");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine(
				"router.post('/mcp/messages', async (req: Request, res: Response) => {",
			);
			writer.indent(() => {
				writer.writeLine("if (!transport) {");
				writer.indent(() => {
					writer.writeLine(
						"res.status(503).json({ error: 'SSE connection not established' });",
					);
					writer.writeLine("return;");
				});
				writer.writeLine("}");
				writer.writeLine("await transport.handlePostMessage(req, res);");
			});
			writer.writeLine("});");
			writer.blankLine();
			writer.writeLine("return router;");
		},
	});
	sourceFile.formatText();
}
