/**
 * Implements the `from_arazzo` (`to_sdk`, `to_sdk_cli`, `to_server`) CLI commands
 * and programmatic generation helpers.
 *
 * @module cli/commands/from_arazzo
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { type Command, Option } from "commander";
import { ModuleKind, Project, ScriptTarget } from "ts-morph";
import { ArazzoCliGenerator } from "../../arazzo/emit_cli.js";
import { ArazzoSdkGenerator } from "../../arazzo/emit_sdk.js";
import { ArazzoServerGenerator } from "../../arazzo/emit_server.js";
import { ArazzoParser } from "../../arazzo/parse.js";
import type { ArazzoSpec, GeneratorConfig } from "../../core/types/index.js";

/**
 * CLI options accepted by `from_arazzo` subcommands (`to_sdk`, `to_sdk_cli`, `to_server`).
 */
export interface FromArazzoActionOptions {
	/** Input Arazzo specification path. */
	input?: string;
	/** Input directory containing specifications. */
	inputDir?: string;
	/** Output directory for generated TypeScript code. */
	output?: string;
	/** When `true`, omits unit test generation. */
	noTests?: boolean;
}

/**
 * Generates TypeScript artifacts (`sdk`, `cli`, or `server`) synchronously from an Arazzo 1.1.0 specification.
 *
 * @param inputPathOrSpec - File path to Arazzo spec or in-memory `ArazzoSpec`.
 * @param outputDir - Target output directory path.
 * @param scope - Target artifact scope (`"sdk"`, `"cli"`, or `"server"`).
 * @param generateTests - Whether to generate accompanying Vitest unit tests.
 * @returns Initialized `ts-morph` `Project` after saving all generated files to disk.
 */
export function generateFromArazzoSync(
	inputPathOrSpec: string | ArazzoSpec,
	outputDir: string,
	scope: "sdk" | "cli" | "server" = "sdk",
	generateTests: boolean = true,
): Project {
	const resolvedOutput = path.resolve(outputDir);
	const config: GeneratorConfig = {
		input:
			typeof inputPathOrSpec === "string" ? inputPathOrSpec : "arazzo.json",
		output: resolvedOutput,
		options: {
			framework: "vanilla",
			implementation: scope === "server" ? "node" : "fetch",
			enumStyle: "enum",
			dateType: "string",
			tests: generateTests,
		},
	};

	const parser = ArazzoParser.createSync(inputPathOrSpec, config);
	const project = new Project({
		compilerOptions: {
			target: ScriptTarget.ES2022,
			module: ModuleKind.NodeNext,
			declaration: true,
			strict: true,
			outDir: resolvedOutput,
		},
	});

	fs.mkdirSync(resolvedOutput, { recursive: true });

	if (scope === "cli") {
		new ArazzoCliGenerator(project, parser, config).generate(resolvedOutput);
	} else if (scope === "server") {
		new ArazzoServerGenerator(project, parser, config).generate(resolvedOutput);
	} else {
		new ArazzoSdkGenerator(project, parser, config).generate(resolvedOutput);
	}

	project.saveSync();
	return project;
}

/**
 * Registers the `from_arazzo` command and its `to_sdk`, `to_sdk_cli`, and `to_server` subcommands on a Commander program.
 *
 * @param program - Root Commander `Command` instance.
 */
export function registerFromArazzoCommands(program: Command): void {
	const fromArazzoCmd = program
		.command("from_arazzo")
		.description(
			"Generate TypeScript SDK orchestrators, CLI workflow runners, or Server/E2E suites from an Arazzo 1.1.0 specification.",
		);

	const attachScopeSubcommand = (
		subName: "to_sdk" | "to_sdk_cli" | "to_server",
		scope: "sdk" | "cli" | "server",
		desc: string,
	): void => {
		fromArazzoCmd
			.command(subName)
			.description(desc)
			.addOption(
				new Option(
					"-i, --input <path>",
					"Path to Arazzo 1.1.0 specification",
				).env("CDD_INPUT"),
			)
			.addOption(
				new Option(
					"-o, --output <dir>",
					"Output directory for generated TypeScript files",
				)
					.default("./arazzo-out")
					.env("CDD_OUTPUT"),
			)
			.addOption(
				new Option("--no-tests", "Skip generating workflow test files"),
			)
			.action((options: FromArazzoActionOptions) => {
				if (!options.input) {
					throw new Error(
						"Please specify an input Arazzo specification via -i / --input.",
					);
				}
				generateFromArazzoSync(
					options.input,
					options.output as string,
					scope,
					options.noTests !== true,
				);
			});
	};

	attachScopeSubcommand(
		"to_sdk",
		"sdk",
		"Generate a TypeScript Client SDK WorkflowOrchestrator from an Arazzo 1.1.0 specification.",
	);
	attachScopeSubcommand(
		"to_sdk_cli",
		"cli",
		"Generate a Commander CLI workflow runner (reusing the SDK WorkflowOrchestrator) from an Arazzo 1.1.0 specification.",
	);
	attachScopeSubcommand(
		"to_server",
		"server",
		"Generate Server workflow execution routes and Vitest E2E workflow test suites from an Arazzo 1.1.0 specification.",
	);
}
