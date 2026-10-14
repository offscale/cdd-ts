/**
 * Main Command-Line Interface (CLI) entry facade orchestrating `from_openapi`, `to_openapi`, `to_docs_json`, `sync`, `mcp`, and `serve_json_rpc`.
 *
 * @module cli
 */
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
	type CliRunner,
	registerFromOpenApiCommands,
	runJavyStdinIfPresent,
} from "./cli/commands/from_openapi.js";
import { registerServeJsonRpcCommand } from "./cli/commands/serve_json_rpc.js";
import { registerSyncAndMcpCommands } from "./cli/commands/sync_and_github.js";
import { registerToOpenApiCommands } from "./cli/commands/to_openapi.js";

/** Re-exports `CliRunner` from `./cli/commands/from_openapi.js`. */
/** Re-exports `FromOpenApiOptions` from `./cli/commands/from_openapi.js`. */
/** Re-exports `ToSdkCliGenOptions` from `./cli/commands/from_openapi.js`. */
/** Re-exports `ToSdkCliOptions` from `./cli/commands/from_openapi.js`. */
/** Re-exports `ToServerCliOptions` from `./cli/commands/from_openapi.js`. */
export type {
	CliRunner,
	FromOpenApiOptions,
	ToSdkCliGenOptions,
	ToSdkCliOptions,
	ToServerCliOptions,
} from "./cli/commands/from_openapi.js";
/** Re-exports `generateFromOpenApi` from `./cli/commands/from_openapi.js`. */
/** Re-exports `parseFrameworkOption` from `./cli/commands/from_openapi.js`. */
/** Re-exports `parseServerFrameworkOption` from `./cli/commands/from_openapi.js`. */
export {
	generateFromOpenApi,
	parseFrameworkOption,
	parseServerFrameworkOption,
} from "./cli/commands/from_openapi.js";
/** Re-exports `ServeJsonRpcOptions` from `./cli/commands/serve_json_rpc.js`. */
export type { ServeJsonRpcOptions } from "./cli/commands/serve_json_rpc.js";
/** Re-exports `serveJsonRpc` from `./cli/commands/serve_json_rpc.js`. */
export { serveJsonRpc } from "./cli/commands/serve_json_rpc.js";
/** Re-exports `SyncCliOptions` from `./cli/commands/sync_and_github.js`. */
export type { SyncCliOptions } from "./cli/commands/sync_and_github.js";
/** Re-exports `syncDir` from `./cli/commands/sync_and_github.js`. */
export { syncDir } from "./cli/commands/sync_and_github.js";
/** Re-exports `DocsJsonOptions` from `./cli/commands/to_openapi.js`. */
/** Re-exports `ToActionOptions` from `./cli/commands/to_openapi.js`. */
export type {
	DocsJsonOptions,
	ToActionOptions,
} from "./cli/commands/to_openapi.js";
/** Re-exports `generateDocsJson` from `./cli/commands/to_openapi.js`. */
/** Re-exports `generateToOpenApi` from `./cli/commands/to_openapi.js`. */
export {
	generateDocsJson,
	generateToOpenApi,
} from "./cli/commands/to_openapi.js";

const program = new Command();
program.name("cdd-ts").description("OpenAPI ↔ TypeScript.").version("0.0.3");

registerFromOpenApiCommands(program);
registerToOpenApiCommands(program);
registerServeJsonRpcCommand(program);
registerSyncAndMcpCommands(program);

/**
 * Parses and executes the CLI program with the provided `argv` array.
 *
 * @param argv - Command-line argument vector (e.g., `process.argv`).
 * @returns Promise that resolves once command execution completes.
 */
export async function run(argv: string[]): Promise<void> {
	await program.parseAsync(argv);
}

/**
 * Checks whether the current module is being executed directly as the main script.
 *
 * @param argv1 - `process.argv[1]` script path.
 * @param metaUrl - `import.meta.url` of the module.
 * @returns `true` if `argv1` matches the file path of `metaUrl`; otherwise `false`.
 */
export function checkIsMain(argv1: string, metaUrl?: string): boolean {
	if (!metaUrl) return false;
	try {
		return argv1 === fileURLToPath(metaUrl);
	} catch {
		return false;
	}
}

/**
 * Executes the CLI when invoked directly as the main entrypoint or under Javy WebAssembly stdin.
 *
 * @param argv - Command-line argument vector.
 * @param metaUrl - Module `import.meta.url` string.
 * @param runner - CLI runner function to invoke.
 */
export function executeIfMain(
	argv: string[] = process.argv,
	metaUrl: string = import.meta.url,
	runner: CliRunner = run,
): void {
	const isMain = checkIsMain(argv[1] ?? "", metaUrl);
	if (isMain) {
		runner(argv).catch((err: unknown) => {
			console.error(err);
			process.exit(1);
		});
	} else {
		runJavyStdinIfPresent(runner);
	}
}

executeIfMain();
