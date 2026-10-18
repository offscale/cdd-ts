/**
 * Implements the `to_arazzo` reverse-parser CLI command and programmatic helper.
 *
 * @module cli/commands/to_arazzo
 */
import { type Command, Option } from "commander";
import {
	extractArazzoFromTypeScript,
	writeFormattedArazzoSpec,
} from "../../arazzo/emit_arazzo.js";
import type { ArazzoSpec } from "../../core/types/index.js";

/**
 * CLI options accepted by the `to_arazzo` command.
 */
export interface ToArazzoActionOptions {
	/** Input TypeScript file or project directory. */
	input: string;
	/** Output Arazzo specification file path. */
	output: string;
	/** Optional output format (`"json"` or `"yaml"`). */
	format?: "json" | "yaml";
	/** When `true`, ignores `arazzo.snapshot.{json,yaml}` and forces AST reverse-parsing. */
	ignoreSnapshot?: boolean;
}

/**
 * Reverse-parses a TypeScript directory or source file into a formatted Arazzo 1.1.0 specification file.
 *
 * @param options - `ToArazzoActionOptions` configuration.
 * @returns Reconstructed `ArazzoSpec`.
 */
export function generateToArazzo(options: ToArazzoActionOptions): ArazzoSpec {
	const spec = extractArazzoFromTypeScript(
		options.input,
		options.ignoreSnapshot === true,
	);
	writeFormattedArazzoSpec(spec, options.output, options.format);
	return spec;
}

/**
 * Registers the `to_arazzo` command onto a Commander `Command` instance.
 *
 * @param program - Root Commander `Command` instance.
 */
export function registerToArazzoCommands(program: Command): void {
	program
		.command("to_arazzo")
		.description(
			"Reverse-parse TypeScript SDK workflows, CLI runners, or Server E2E tests into an Arazzo 1.1.0 specification.",
		)
		.requiredOption(
			"-i, --input <path>",
			"Input TypeScript file or project directory",
		)
		.addOption(
			new Option("-o, --output <path>", "Output Arazzo specification file path")
				.default("arazzo.json")
				.env("CDD_OUTPUT"),
		)
		.addOption(
			new Option(
				"-f, --format <format>",
				"Output format (json or yaml)",
			).choices(["json", "yaml"]),
		)
		.addOption(
			new Option(
				"--ignore-snapshot",
				"Force static ts-morph AST reverse-parsing even if arazzo.snapshot.json exists",
			),
		)
		.action((options: ToArazzoActionOptions) => {
			generateToArazzo(options);
		});
}
