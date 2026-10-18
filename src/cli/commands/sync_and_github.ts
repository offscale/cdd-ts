/**
 * Implements the `sync` and `mcp` CLI commands.
 *
 * @module cli/commands/sync_and_github
 */
import { type Command, Option } from "commander";
import { generateToArazzo } from "./to_arazzo.js";
import { generateToOpenApi, type ToActionOptions } from "./to_openapi.js";

/** Defines the shape of the options object from the `sync` command. */
export interface SyncCliOptions {
	/** Path to the source directory or file. */
	input: string;
	/** Source of truth for synchronization. */
	truth: string;
	/** Output directory for generated files. */
	output?: string;
}

/**
 * Synchronously checks and synchronizes a generated SDK or ORM codebase against a designated source of truth.
 *
 * @param options - Configuration options (`input`, `truth`, `output`).
 * @returns Promise that resolves when synchronization completes.
 */
export async function syncDir(options: SyncCliOptions): Promise<void> {
	console.log(
		`Synchronizing using '${options.truth}' as the source of truth...`,
	);
	if (options.truth === "typeorm" || options.truth === "class") {
		console.log("Parsing models/entities and syncing to OpenAPI spec...");
		const toActionOpts: ToActionOptions = {
			input: options.input,
			format: "json",
		};
		if (options.truth === "typeorm") {
			toActionOpts.orm = "typeorm";
		}
		const spec = await generateToOpenApi(toActionOpts, true);
		if (spec) {
			console.log("✅ Synced implementation to OpenAPI Spec");
		} else {
			console.error("❌ Sync failed to extract spec");
			process.exit(1);
		}
	} else if (options.truth === "arazzo") {
		generateToArazzo({
			input: options.input,
			output: options.output ?? "arazzo.json",
		});
		console.log("✅ Synced implementation to Arazzo Spec");
	} else {
		console.error(
			`Sync for truth source '${options.truth}' is not fully implemented yet.`,
		);
		process.exit(1);
	}
}

/**
 * Registers the `sync` and `mcp` commands on the root Commander program.
 *
 * @param program - Root Commander `Command` instance.
 */
export function registerSyncAndMcpCommands(program: Command): void {
	program
		.command("sync")
		.description("Synchronize an OpenAPI specification with source code.")
		.addOption(
			new Option(
				"-i, --input <path>",
				"Path to the source directory or file",
			).makeOptionMandatory(),
		)
		.addOption(
			new Option(
				"-t, --truth <source>",
				"Designate a single source of truth for synchronization.",
			)
				.choices(["class", "typeorm", "function", "openapi", "arazzo"])
				.makeOptionMandatory(),
		)
		.addOption(
			new Option(
				"-o, --output <path>",
				"Output directory for generated files",
			).env("CDD_OUTPUT"),
		)
		.action(syncDir);

	program
		.command("mcp")
		.description("Run the generator as an MCP server over stdio.")
		.action(async () => {
			const { serveMcp } = await import("../../mcp_server.js");
			await serveMcp();
		});
}
