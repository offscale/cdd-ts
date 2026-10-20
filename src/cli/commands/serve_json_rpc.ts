/**
 * Implements the `serve_json_rpc` HTTP JSON-RPC 2.0 server command for CLI operations.
 *
 * @module cli/commands/serve_json_rpc
 */
import * as http from "node:http";
import { type Command, Option } from "commander";
import type { OpenApiValue } from "../../core/types/index.js";
import { loadPackageVersion } from "../spec_writer.js";
import { generateFromArazzoSync } from "./from_arazzo.js";
import {
	type FromOpenApiOptions,
	generateFromOpenApi,
} from "./from_openapi.js";
import { generateToArazzo, type ToArazzoActionOptions } from "./to_arazzo.js";
import {
	type DocsJsonOptions,
	generateDocsJson,
	generateToOpenApi,
	type ToActionOptions,
} from "./to_openapi.js";

const cliVersion = loadPackageVersion(import.meta.url);

/**
 * Options for the `serve_json_rpc` command.
 */
export interface ServeJsonRpcOptions {
	/** TCP port string to listen on. */
	port: string;
	/** Host/IP address to bind to. */
	listen: string;
}

/**
 * Exposes the CLI interface as an HTTP JSON-RPC 2.0 server.
 *
 * @param options - Server port and listen address options.
 * @returns Promise that resolves when the server begins listening.
 */
export async function serveJsonRpc(
	options: ServeJsonRpcOptions,
): Promise<void> {
	const port = Number.parseInt(options.port, 10);
	const host = options.listen;
	const server = http.createServer(async (req, res) => {
		if (req.method === "POST") {
			let body = "";
			req.on("data", (chunk: Buffer) => {
				body += chunk.toString();
			});
			req.on("end", async () => {
				let parsed: {
					method?: string;
					params?: Record<string, OpenApiValue>;
					id?: string | number | null;
				};
				try {
					parsed = JSON.parse(body);
				} catch (_err) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							jsonrpc: "2.0",
							error: { code: -32700, message: "Parse error" },
							id: null,
						}),
					);
					return;
				}
				try {
					let result: OpenApiValue;
					switch (parsed.method) {
						case "from_openapi_to_sdk_cli":
							result = await generateFromOpenApi(
								parsed.params as OpenApiValue as FromOpenApiOptions,
								"to_sdk_cli",
							);
							break;
						case "from_openapi_to_sdk":
							result = await generateFromOpenApi(
								parsed.params as Partial<FromOpenApiOptions> as FromOpenApiOptions,
								"to_sdk",
							);
							break;
						case "from_openapi_to_server":
							result = await generateFromOpenApi(
								parsed.params as Partial<FromOpenApiOptions> as FromOpenApiOptions,
								"to_server",
							);
							break;
						case "to_openapi":
							result = (await generateToOpenApi(
								parsed.params as Partial<ToActionOptions> as ToActionOptions,
								true,
							)) as OpenApiValue;
							break;
						case "from_arazzo_to_sdk":
							generateFromArazzoSync(
								String(parsed.params?.input ?? ""),
								String(parsed.params?.output ?? "./arazzo-out"),
								"sdk",
							);
							result = "ok";
							break;
						case "from_arazzo_to_sdk_cli":
							generateFromArazzoSync(
								String(parsed.params?.input ?? ""),
								String(parsed.params?.output ?? "./arazzo-out"),
								"cli",
							);
							result = "ok";
							break;
						case "from_arazzo_to_server":
							generateFromArazzoSync(
								String(parsed.params?.input ?? ""),
								String(parsed.params?.output ?? "./arazzo-out"),
								"server",
							);
							result = "ok";
							break;
						case "to_arazzo":
							result = generateToArazzo(
								parsed.params as Partial<ToArazzoActionOptions> as ToArazzoActionOptions,
							) as unknown as OpenApiValue;
							break;
						case "to_docs_json":
							result = (await generateDocsJson(
								parsed.params as Partial<DocsJsonOptions> as DocsJsonOptions,
								true,
							)) as unknown as OpenApiValue;
							break;
						case "version":
							result = cliVersion;
							break;
						default:
							throw { code: -32601, message: "Method not found" };
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ jsonrpc: "2.0", result, id: parsed.id }));
				} catch (err) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							jsonrpc: "2.0",
							error: (err as { code?: number }).code
								? err
								: {
										code: -32000,
										message:
											(err as { message?: string }).message || String(err),
									},
							id: parsed.id,
						}),
					);
				}
			});
		} else {
			res.writeHead(405);
			res.end();
		}
	});
	server.listen(port, host, () => {
		console.log(`JSON-RPC server running at http://${host}:${port}/`);
	});
}

/**
 * Registers the `serve_json_rpc` command on the root Commander program.
 *
 * @param program - Root Commander `Command` instance.
 */
export function registerServeJsonRpcCommand(program: Command): void {
	program
		.command("serve_json_rpc")
		.description("Expose CLI interface as a JSON-RPC server.")
		.addOption(
			new Option("-p, --port <port>", "Port to listen on")
				.default("8080")
				.env("CDD_PORT"),
		)
		.addOption(
			new Option("-l, --listen <address>", "Address to listen on")
				.default("127.0.0.1")
				.env("CDD_LISTEN"),
		)
		.action(serveJsonRpc);
}
