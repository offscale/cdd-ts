/**
 * Implements the `from_openapi` (`to_sdk`, `to_server`, `to_sdk_cli`) CLI commands and configuration loading logic.
 *
 * @module cli/commands/from_openapi
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { type Command, Option } from "commander";
import * as yaml from "js-yaml";
import type {
	GeneratorConfig,
	GeneratorConfigOptions,
	TargetFramework,
	TargetServerFramework,
} from "../../core/types/index.js";
import {
	createJavyFsPolyfill,
	runJavyStdinIfPresent,
} from "../../core/wasm-fs.js";
import { isUrl } from "../../functions/utils.js";
import { generateFromConfigSync } from "../../index.js";
import {
	emitGithubActionsScaffolding,
	emitPackageScaffolding,
} from "../scaffold.js";

/** Re-exports `CliRunner` from `../../core/wasm-fs.js`. */
export type { CliRunner } from "../../core/wasm-fs.js";
/** Re-exports `createJavyFsPolyfill` and `runJavyStdinIfPresent` from `../../core/wasm-fs.js`. */
export { createJavyFsPolyfill, runJavyStdinIfPresent };

const NEWLINE = String.fromCharCode(10);

/** Defines the shape of the options object from the `from_openapi` command. */
export interface FromOpenApiOptions {
	/** Optional path to a configuration file. */
	config?: string;
	/** Path or URL to the OpenAPI specification. */
	input?: string;
	/** Path to a directory of OpenAPI specifications. */
	inputDir?: string;
	/** Output directory for generated files. */
	output?: string;
	/** Name for the generated client. */
	clientName?: string;
	/** Target client or server framework. */
	framework?:
		| "angular"
		| "react"
		| "vue"
		| "vanilla"
		| "Vanilla JS"
		| "express"
		| "node"
		| "bun"
		| "deno";
	/** Underlying HTTP client implementation. */
	implementation?: "angular" | "fetch" | "axios" | "node";
	/** Representation for date/date-time fields. */
	dateType?: "string" | "Date";
	/** TypeScript style for OpenAPI enums. */
	enumStyle?: "enum" | "union";
	/** Whether to generate an auto-admin UI. */
	admin?: boolean;
	/** Whether to generate service classes. */
	generateServices?: boolean;
	/** Whether to generate service unit tests. */
	testsForService?: boolean;
	/** Whether to generate admin UI unit tests. */
	testsForAdmin?: boolean;
	/** Whether to generate an MCP server adapter. */
	mcp?: boolean;
	/** Whether to generate integration tests and mocks. */
	tests?: boolean | string;
	/** Whether test generation is enabled (`--no-test-gen` sets `false`). */
	testGen?: boolean;
	/** Whether GitHub Actions scaffolding is enabled (`--no-github-actions` sets `false`). */
	githubActions?: boolean;
	/** Whether installable package scaffolding is enabled (`--no-installable-package` sets `false`). */
	installablePackage?: boolean;
	/** Target ORM implementation for server/entity models. */
	orm?: "typeorm";
	/** TypeScript type used for `int64` schemas. */
	int64Type?: "number" | "string" | "bigint";
	/** Target runtime platform. */
	platform?: "browser" | "node";
	/** Custom HTTP headers formatted as `Key:Value`. */
	customHeader?: string[];
}

/** Defines the shape of the options object from the `to_sdk` command. */
export type ToSdkCliOptions = FromOpenApiOptions;

/** Defines the shape of the options object from the `to_server` command. */
export type ToServerCliOptions = FromOpenApiOptions;

/** Defines the shape of the options object from the `to_sdk_cli` command. */
export type ToSdkCliGenOptions = FromOpenApiOptions;

/**
 * Validates and narrows a CLI framework string to `TargetFramework`.
 *
 * @param value - Raw framework option value.
 * @returns Validated `TargetFramework`.
 */
export function parseFrameworkOption(value: string): TargetFramework {
	if (value === "Vanilla JS") {
		return "vanilla";
	}
	if (
		value === "angular" ||
		value === "react" ||
		value === "vue" ||
		value === "vanilla"
	) {
		return value;
	}
	return "vanilla";
}

/**
 * Validates and narrows a CLI server framework string to `TargetServerFramework`.
 *
 * @param value - Raw server framework option value.
 * @returns Validated `TargetServerFramework`.
 */
export function parseServerFrameworkOption(
	value: string,
): TargetServerFramework {
	if (value === "express") {
		return value;
	}
	return "express";
}

/**
 * Dynamically imports and resolves a generator configuration file from disk.
 *
 * @param configPath - Relative or absolute path to the configuration file.
 * @returns Resolved partial `GeneratorConfig`.
 * @throws {Error} When the file does not exist or fails to import.
 */
async function loadConfigFile(
	configPath: string,
): Promise<Partial<GeneratorConfig>> {
	const resolvedPath = path.resolve(process.cwd(), configPath);
	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`Configuration file not found: ${resolvedPath}`);
	}

	try {
		const configModule = (await import(`file://${resolvedPath}`)) as Record<
			string,
			unknown
		>;
		const config = (configModule.default ||
			configModule.config ||
			configModule) as GeneratorConfig;

		const configDir = path.dirname(resolvedPath);
		if (
			config.input &&
			!isUrl(config.input) &&
			!path.isAbsolute(config.input)
		) {
			config.input = path.resolve(configDir, config.input);
		}
		if (config.output && !path.isAbsolute(config.output)) {
			config.output = path.resolve(configDir, config.output);
		}
		return config;
	} catch (error) {
		throw new Error(
			`Failed to load configuration file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Generates SDK, CLI, or Server code and optional package scaffolding from an OpenAPI specification.
 *
 * @param options - CLI options parsed from Commander or JSON-RPC.
 * @param targetScope - Generation target scope (`"to_sdk"`, `"to_sdk_cli"`, or `"to_server"`).
 * @returns Promise resolving to `"Success"` on completion.
 * @throws {Error} When input is missing or code generation fails.
 */
export async function generateFromOpenApi(
	options: FromOpenApiOptions,
	targetScope?: "to_sdk" | "to_sdk_cli" | "to_server",
): Promise<string> {
	const startTime = Date.now();
	const extractArg = (flag: string): string | undefined => {
		const argv = process.argv;
		for (let i = 0; i < argv.length; i++) {
			const arg = argv[i] as string;
			if (arg === flag && i + 1 < argv.length) return argv[i + 1];
			if (arg.startsWith(`${flag}=`)) return arg.substring(flag.length + 1);
		}
		return undefined;
	};
	try {
		let baseConfig: Partial<GeneratorConfig> = {};
		if (options.config) {
			baseConfig = await loadConfigFile(options.config);
		}

		const cliOptions: Partial<GeneratorConfigOptions> = {};
		if (targetScope === "to_server" && options.framework) {
			cliOptions.serverFramework = parseServerFrameworkOption(
				options.framework,
			);
		} else if (options.framework) {
			cliOptions.framework = parseFrameworkOption(options.framework);
		}
		if (options.implementation)
			cliOptions.implementation = options.implementation;
		if (options.dateType) cliOptions.dateType = options.dateType;
		if (options.enumStyle) cliOptions.enumStyle = options.enumStyle;
		if (options.generateServices === false) cliOptions.generateServices = false;
		if (options.admin !== undefined) cliOptions.admin = options.admin;

		if (options.testsForService === false)
			cliOptions.generateServiceTests = false;
		if (options.testsForAdmin === false) cliOptions.generateAdminTests = false;
		if (options.installablePackage === false)
			cliOptions.noInstallablePackage = true;
		if (options.githubActions === false) cliOptions.noGithubActions = true;
		if (options.testGen === false) {
			cliOptions.generateServiceTests = false;
			cliOptions.generateAdminTests = false;
			cliOptions.composableTests = false;
		}
		if (options.mcp !== undefined) {
			cliOptions.mcp = options.mcp;
		}

		if (options.tests !== undefined) {
			const isTestsEnabled =
				typeof options.tests === "string"
					? options.tests !== "false" && options.tests !== "0"
					: Boolean(options.tests);
			cliOptions.composableTests = isTestsEnabled;
			cliOptions.tests = isTestsEnabled;
		}
		if (options.orm) cliOptions.orm = options.orm;
		if (options.int64Type) cliOptions.int64Type = options.int64Type;
		if (options.platform) cliOptions.platform = options.platform;
		if (options.customHeader && options.customHeader.length > 0) {
			cliOptions.customHeaders = {};
			for (const header of options.customHeader) {
				const [key, ...valueParts] = header.split(":");
				if (key && valueParts.length > 0) {
					cliOptions.customHeaders[key.trim()] = valueParts.join(":").trim();
				}
			}
		}

		const defaults: GeneratorConfigOptions = {
			framework: "vanilla",
			dateType: "Date",
			enumStyle: "enum",
			generateServices: true,
			admin: false,
			generateServiceTests: false,
			generateAdminTests: false,
		};

		const finalConfigInProgress: Partial<GeneratorConfig> = {
			options: {
				...defaults,
				...baseConfig.options,
				...cliOptions,
			},
			compilerOptions: {
				...baseConfig.compilerOptions,
			},
		};

		const input =
			options.input ??
			options.inputDir ??
			baseConfig.input ??
			extractArg("-i") ??
			extractArg("--input");
		if (input) {
			finalConfigInProgress.input = input;
		}

		const output =
			options.output ??
			baseConfig.output ??
			extractArg("-o") ??
			extractArg("--output");
		if (output) {
			finalConfigInProgress.output = output;
		}

		const clientName = options.clientName ?? baseConfig.clientName;
		if (clientName) {
			finalConfigInProgress.clientName = clientName;
		}

		if (!finalConfigInProgress.input) {
			throw new Error(
				"Input path or URL is required. Provide it via --input, --input-dir or a config file.",
			);
		}
		if (!finalConfigInProgress.output) {
			finalConfigInProgress.output = process.cwd();
			console.warn(
				`Output path not specified, defaulting to '${finalConfigInProgress.output}'.`,
			);
		}

		if (!path.isAbsolute(finalConfigInProgress.output)) {
			finalConfigInProgress.output = path.resolve(
				process.cwd(),
				finalConfigInProgress.output,
			);
		}

		console.log(
			yaml.dump(
				{ ...finalConfigInProgress },
				{
					indent: 2,
					skipInvalid: true,
				},
			),
		);

		const targetOutputRoot = finalConfigInProgress.output;
		if (
			!finalConfigInProgress.options?.noInstallablePackage &&
			(targetScope === "to_sdk" || targetScope === "to_server")
		) {
			finalConfigInProgress.output = path.join(targetOutputRoot, "src");
		}

		generateFromConfigSync(
			finalConfigInProgress as GeneratorConfig,
			undefined,
			undefined,
			targetScope,
		);

		if (!finalConfigInProgress.options?.noInstallablePackage) {
			emitPackageScaffolding(
				targetOutputRoot,
				finalConfigInProgress,
				targetScope,
			);
		}

		if (!finalConfigInProgress.options?.noGithubActions) {
			emitGithubActionsScaffolding(targetOutputRoot);
		}

		return "Success";
	} catch (error: unknown) {
		console.error("runGeneration error:", error);
		throw error;
	} finally {
		const duration = (Date.now() - startTime) / 1000;
		console.log(`${NEWLINE}⏱️  Duration: ${duration.toFixed(2)} seconds`);

		if ((globalThis as { __FsData?: unknown }).__FsData) {
			console.log(
				"JAVY_FS_DUMP:" +
					JSON.stringify((globalThis as { __FsData?: unknown }).__FsData),
			);
		}
	}
}

/**
 * Adds common OpenAPI code generation options to a Commander subcommand.
 *
 * @param cmd - Target Commander `Command`.
 * @returns The configured `Command`.
 */
function addCommonOptions(cmd: Command): Command {
	return cmd
		.addOption(
			new Option("-c, --config <path>", "Path to a configuration file").env(
				"CDD_CONFIG",
			),
		)
		.addOption(
			new Option(
				"-i, --input <path>",
				"Path or URL to the OpenAPI specification",
			),
		)
		.addOption(
			new Option(
				"-d, --input-dir <path>",
				"Path to directory of OpenAPI specs",
			).env("CDD_INPUT_DIR"),
		)
		.addOption(
			new Option(
				"-o, --output <path>",
				"Output directory for generated files",
			).env("CDD_OUTPUT"),
		)
		.addOption(
			new Option("--dateType <type>", "Date type to use")
				.choices(["string", "Date"])
				.env("CDD_DATE_TYPE"),
		)
		.addOption(
			new Option("--enumStyle <style>", "Style for enums")
				.choices(["enum", "union"])
				.env("CDD_ENUM_STYLE"),
		)
		.addOption(
			new Option("--int64Type <type>", "Type for int64 formatting")
				.choices(["number", "string", "bigint"])
				.env("CDD_INT64_TYPE"),
		)
		.addOption(
			new Option("--no-test-gen", "Disable all test generation").env(
				"CDD_NO_TEST_GEN",
			),
		)
		.addOption(
			new Option("--tests", "Generate integration tests and mocks").env(
				"CDD_TESTS",
			),
		)
		.addOption(
			new Option(
				"-m, --mcp",
				"Generate Model Context Protocol (MCP) server and adapter",
			).env("CDD_MCP"),
		)
		.addOption(
			new Option(
				"--no-github-actions",
				"Do not generate GitHub Actions scaffolding",
			).env("CDD_NO_GITHUB_ACTIONS"),
		)
		.addOption(
			new Option(
				"--no-installable-package",
				"Do not generate installable package scaffolding",
			).env("CDD_NO_INSTALLABLE_PACKAGE"),
		);
}

/**
 * Adds client SDK-specific options to a Commander subcommand.
 *
 * @param cmd - Target Commander `Command`.
 * @returns The configured `Command`.
 */
function addSdkOptions(cmd: Command): Command {
	return cmd
		.addOption(
			new Option("--clientName <name>", "Name for the generated client").env(
				"CDD_CLIENT_NAME",
			),
		)
		.addOption(
			new Option("-f, --framework <framework>", "Target framework")
				.choices(["angular", "react", "vue", "vanilla", "Vanilla JS"])
				.env("CDD_FRAMEWORK"),
		)
		.addOption(
			new Option("--implementation <implementation>", "HTTP implementation")
				.choices(["angular", "fetch", "axios", "node"])
				.env("CDD_IMPLEMENTATION"),
		)
		.addOption(
			new Option("-p, --platform <platform>", "Target runtime platform")
				.choices(["browser", "node"])
				.env("CDD_PLATFORM"),
		)
		.addOption(
			new Option(
				"--customHeader <header...>",
				"Custom headers to add to generated requests, formatted as Key:Value",
			),
		)
		.addOption(
			new Option("--admin", "Generate an auto-admin UI").env("CDD_ADMIN"),
		)
		.addOption(
			new Option(
				"--no-generate-services",
				"Disable generation of services",
			).env("CDD_NO_GENERATE_SERVICES"),
		)
		.addOption(
			new Option(
				"--no-tests-for-service",
				"Disable generation of tests for services",
			).env("CDD_NO_TESTS_FOR_SERVICE"),
		)
		.addOption(
			new Option(
				"--no-tests-for-admin",
				"Disable generation of tests for the admin UI",
			).env("CDD_NO_TESTS_FOR_ADMIN"),
		);
}

/**
 * Adds server-specific options to a Commander subcommand.
 *
 * @param cmd - Target Commander `Command`.
 * @returns The configured `Command`.
 */
function addServerOptions(cmd: Command): Command {
	return cmd
		.addOption(
			new Option("-f, --framework <type>", "Target server framework")
				.choices(["express", "node", "bun", "deno"])
				.env("CDD_SERVER_FRAMEWORK"),
		)
		.addOption(
			new Option("--orm <type>", "Target ORM implementation for models")
				.choices(["typeorm"])
				.env("CDD_ORM"),
		);
}

/**
 * Executes a `from_openapi` subcommand action and exits with code 1 on failure.
 *
 * @param options - Parsed CLI options.
 * @param targetScope - Generation target scope.
 */
async function executeFromOpenApiSubcommand(
	options: FromOpenApiOptions,
	targetScope: "to_sdk" | "to_sdk_cli" | "to_server",
): Promise<void> {
	try {
		await generateFromOpenApi(options, targetScope);
	} catch (err: unknown) {
		console.error(
			"❌ Generation failed:",
			err instanceof Error ? err.message : String(err),
		);
		process.exit(1);
	}
}

/**
 * Registers the `from_openapi` command group (`to_sdk_cli`, `to_sdk`, `to_server`) on the root Commander program.
 *
 * @param program - Root Commander `Command` instance.
 */
export function registerFromOpenApiCommands(program: Command): void {
	const fromOpenApi = program
		.command("from_openapi")
		.description("Generate code from an OpenAPI specification.");

	addSdkOptions(addCommonOptions(fromOpenApi.command("to_sdk_cli")))
		.description(
			"Generate a client SDK and a corresponding command-line interface (CLI) from an OpenAPI specification.",
		)
		.action(async (options: ToSdkCliGenOptions) => {
			await executeFromOpenApiSubcommand(options, "to_sdk_cli");
		});

	addSdkOptions(addCommonOptions(fromOpenApi.command("to_sdk")))
		.description("Generate Client SDK from an OpenAPI specification.")
		.action(async (options: ToSdkCliOptions) => {
			await executeFromOpenApiSubcommand(options, "to_sdk");
		});

	addServerOptions(addCommonOptions(fromOpenApi.command("to_server")))
		.description("Generate Server from an OpenAPI specification.")
		.action(async (options: ToServerCliOptions) => {
			await executeFromOpenApiSubcommand(options, "to_server");
		});
}
