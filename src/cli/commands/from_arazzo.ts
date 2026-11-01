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
import type {
	ArazzoSpec,
	GeneratorConfig,
	TargetFramework,
} from "../../core/types/index.js";
import {
	emitGithubActionsScaffolding,
	emitPackageScaffolding,
} from "../scaffold.js";

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
	/** Target client framework (e.g. `"angular"`, `"react"`, `"vue"`, `"vanilla"`). */
	framework?: TargetFramework;
	/** Whether to generate an MCP server (`mcp-server.ts`) for the Arazzo workflows. */
	mcp?: boolean;
	/** GitHub organization or user name for package and repository metadata. */
	githubOrg?: string;
	/** GitHub repository name for package and repository metadata. */
	repoName?: string;
}

/**
 * Additional generation options for `generateFromArazzoSync`.
 */
export interface ArazzoExtraOptions {
	/** Target client framework. */
	framework?: TargetFramework | undefined;
	/** Whether to emit an MCP server (`mcp-server.ts` and `src/mcp-server.ts`). */
	mcp?: boolean | undefined;
	/** GitHub organization or user name for package scaffolding. */
	githubOrg?: string | undefined;
	/** GitHub repository name for package scaffolding. */
	repoName?: string | undefined;
}

/**
 * Generates TypeScript artifacts (`sdk`, `cli`, or `server`) synchronously from an Arazzo 1.1.0 specification.
 *
 * @param inputPathOrSpec - File path to Arazzo spec or in-memory `ArazzoSpec`.
 * @param outputDir - Target output directory path.
 * @param scope - Target artifact scope (`"sdk"`, `"cli"`, or `"server"`).
 * @param generateTests - Whether to generate accompanying Vitest unit tests.
 * @param extraOptions - Optional framework, MCP, and repository naming options.
 * @returns Initialized `ts-morph` `Project` after saving all generated files to disk.
 */
export function generateFromArazzoSync(
	inputPathOrSpec: string | ArazzoSpec,
	outputDir: string,
	scope: "sdk" | "cli" | "server" = "sdk",
	generateTests: boolean = true,
	extraOptions?: ArazzoExtraOptions,
): Project {
	const resolvedOutput = path.resolve(outputDir);
	const config: GeneratorConfig = {
		input:
			typeof inputPathOrSpec === "string" ? inputPathOrSpec : "arazzo.json",
		output: resolvedOutput,
		options: {
			framework: extraOptions?.framework ?? "vanilla",
			implementation: scope === "server" ? "node" : "fetch",
			enumStyle: "enum",
			dateType: "string",
			tests: generateTests,
			mcp: extraOptions?.mcp,
			githubOrg: extraOptions?.githubOrg,
			repoName: extraOptions?.repoName,
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

	if (extraOptions?.framework === "angular") {
		const ngServiceFile = project.createSourceFile(
			path.join(resolvedOutput, "workflows", "workflows.service.ts"),
			[
				'import { Service, inject } from "@angular/core";',
				'import { HttpClient } from "@angular/common/http";',
				'import { WorkflowOrchestrator } from "./index.js";',
				"",
				"/**",
				" * Angular HTTP workflow service (@Service() / @Injectable({ providedIn: 'root' })).",
				" */",
				"@Service()",
				"export class WorkflowsService {",
				"\tprivate readonly http = inject(HttpClient);",
				"\tpublic readonly orchestrator = new WorkflowOrchestrator({});",
				"}",
				"",
			].join("\n"),
			{ overwrite: true },
		);
		ngServiceFile.formatText();
	}

	if (extraOptions?.mcp) {
		const wfTools = parser.spec.workflows.map((wf) => ({
			name: wf.workflowId,
			description: wf.summary ?? wf.description ?? `Workflow ${wf.workflowId}`,
			inputSchema: wf.inputs ?? { type: "object", properties: {} },
		}));
		const mcpContent = [
			'import { WorkflowOrchestrator } from "./workflows/index.js";',
			"",
			"export async function handleMcpRequest(request: {",
			"\tmethod: string;",
			"\tid?: string | number;",
			"\tparams?: Record<string, unknown>;",
			"}) {",
			'\tif (request.method === "initialize") {',
			"\t\treturn {",
			'\t\t\tprotocolVersion: "2024-11-05",',
			"\t\t\tcapabilities: { tools: { listChanged: true } },",
			`\t\t\tserverInfo: { name: ${JSON.stringify(parser.spec.info.title)}, version: ${JSON.stringify(parser.spec.info.version)} },`,
			"\t\t};",
			"\t}",
			'\tif (request.method === "tools/list") {',
			`\t\treturn { tools: ${JSON.stringify(wfTools)} };`,
			"\t}",
			'\tif (request.method === "tools/call") {',
			"\t\tconst orchestrator = new WorkflowOrchestrator({});",
			'\t\tconst name = String(request.params?.name ?? "");',
			"\t\tconst args = (request.params?.arguments ?? {}) as Record<string, unknown>;",
			"\t\tconst fn = (orchestrator as unknown as Record<string, (a: Record<string, unknown>) => Promise<unknown>>)[name];",
			'\t\tconst res = fn ? await fn.call(orchestrator, args) : { error: "Unknown workflow" };',
			'\t\treturn { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };',
			"\t}",
			"\tthrow new Error(`Unsupported MCP method: ${request.method}`);",
			"}",
			"",
		].join("\n");
		project.createSourceFile(
			path.join(resolvedOutput, "mcp-server.ts"),
			mcpContent,
			{ overwrite: true },
		);
		project.createSourceFile(
			path.join(resolvedOutput, "src", "mcp-server.ts"),
			mcpContent.replace("./workflows/index.js", "../workflows/index.js"),
			{ overwrite: true },
		);
	}

	if (extraOptions?.githubOrg || extraOptions?.repoName) {
		const targetScope =
			scope === "cli"
				? "to_sdk_cli"
				: scope === "server"
					? "to_server"
					: "to_sdk";
		emitPackageScaffolding(resolvedOutput, config, targetScope);
		emitGithubActionsScaffolding(resolvedOutput);
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
			.addOption(
				new Option("-f, --framework <framework>", "Target client framework")
					.choices(["angular", "react", "vue", "vanilla"])
					.env("CDD_FRAMEWORK"),
			)
			.addOption(
				new Option(
					"-m, --mcp",
					"Generate Model Context Protocol (MCP) server",
				).env("CDD_MCP"),
			)
			.addOption(
				new Option(
					"--github-org <org>",
					"GitHub organization or user name for package and repository metadata",
				).env("GITHUB_ORG_NAME"),
			)
			.addOption(
				new Option(
					"--repo-name <name>",
					"GitHub repository name for package and repository metadata",
				).env("CDD_REPO_NAME"),
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
					{
						framework: options.framework,
						mcp: options.mcp,
						githubOrg: options.githubOrg,
						repoName: options.repoName,
					},
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
