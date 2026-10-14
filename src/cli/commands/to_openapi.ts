/**
 * Implements the `to_openapi` reverse-parser command and `to_docs_json` documentation generator command.
 *
 * @module cli/commands/to_openapi
 */
import * as fs from "node:fs";
import { type Command, Option } from "commander";
import type { GeneratorConfig, OpenApiValue } from "../../core/types/index.js";
import { generateDocsJson as generateDocsJsonImpl } from "../../functions/docs_generator.js";
import {
	applyReverseMetadata,
	buildOpenApiSpecFromScan,
	buildOpenApiSpecFromServices,
	parseGeneratedMetadata,
	parseGeneratedModels,
	parseGeneratedServices,
	readOpenApiSnapshot,
	scanTypeScriptProject,
} from "../../functions/utils.js";
import { SwaggerParser } from "../../openapi/parse.js";
import { writeDocsJsonOutput, writeFormattedSpec } from "../spec_writer.js";

/** Defines the shape of the options object from the `to_openapi` command. */
export interface ToActionOptions {
	/** Path to the source code directory or file. */
	input: string;
	/** Output serialization format (`"json"` or `"yaml"`). */
	format: "json" | "yaml";
	/** Optional output file path. */
	output?: string;
	/** Optional ORM entity parser to invoke (`"typeorm"`). */
	orm?: "typeorm";
}

/** Defines the shape of the options object from the `to_docs_json` command. */
export interface DocsJsonOptions {
	/** Path or URL to the OpenAPI specification. */
	input: string;
	/** Optional output file path. */
	output?: string;
	/** Whether to include the `imports` section in generated snippets. */
	imports: boolean;
	/** Whether to include class/component wrapper code around snippets. */
	wrapping: boolean;
	/** Target client framework for code snippets. */
	framework?: "angular" | "react" | "vue" | "vanilla" | "Vanilla JS";
}

/**
 * Generates an OpenAPI specification from TypeScript source code, generated services, or snapshots.
 *
 * @param options - Options controlling input path, format, output path, and ORM.
 * @param returnObject - When `true`, returns the parsed `OpenApiValue` instead of writing to disk/stdout.
 * @returns Promise resolving to the `OpenApiValue` when `returnObject` is `true`, otherwise `undefined`.
 * @throws {Error} When reading or reverse-parsing the input fails.
 */
export async function generateToOpenApi(
	options: ToActionOptions,
	returnObject = false,
): Promise<undefined | OpenApiValue> {
	let spec: OpenApiValue;
	try {
		({ spec } = readOpenApiSnapshot(
			options.input,
			fs as OpenApiValue as Parameters<typeof readOpenApiSnapshot>[1],
		));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const shouldFallback =
			message.includes("No OpenAPI snapshot found") ||
			message.includes("Unsupported snapshot file extension");
		if (!shouldFallback) {
			throw error;
		}

		console.warn(`⚠️  ${message}`);
		console.warn("ℹ️  Falling back to parsing generated service files.");

		try {
			const services = parseGeneratedServices(
				options.input,
				fs as OpenApiValue as Parameters<typeof parseGeneratedServices>[1],
			);
			let schemas: Record<string, OpenApiValue> | undefined;

			try {
				schemas = parseGeneratedModels(
					options.input,
					fs as OpenApiValue as Parameters<typeof parseGeneratedModels>[1],
				);
			} catch (modelError) {
				const modelMessage =
					modelError instanceof Error ? modelError.message : String(modelError);
				console.warn(`⚠️  ${modelMessage}`);
				console.warn("ℹ️  Continuing without reconstructed component schemas.");
			}

			if (options.orm === "typeorm") {
				console.log(`📡 Parsing TypeORM entities from ${options.input}`);
				const { Project } = await import("ts-morph");
				const { TypeOrmParser } = await import(
					"../../vendors/typeorm/parse.js"
				);
				const project = new Project();
				project.addSourceFilesAtPaths(`${options.input}/**/*.ts`);
				const ormSchemas = new TypeOrmParser().parse(project);
				schemas = { ...schemas, ...ormSchemas };
			}

			spec = buildOpenApiSpecFromServices(
				services,
				{},
				schemas as OpenApiValue as Parameters<
					typeof buildOpenApiSpecFromServices
				>[2],
			);

			try {
				const metadata = parseGeneratedMetadata(
					options.input,
					fs as OpenApiValue as Parameters<typeof parseGeneratedMetadata>[1],
				);
				spec = applyReverseMetadata(
					spec as OpenApiValue as Parameters<typeof applyReverseMetadata>[0],
					metadata,
				);
			} catch (metaError) {
				const metaMessage =
					metaError instanceof Error ? metaError.message : String(metaError);
				console.warn(`⚠️  ${metaMessage}`);
				console.warn("ℹ️  Continuing without reconstructed metadata.");
			}
		} catch (serviceError) {
			const serviceMessage =
				serviceError instanceof Error
					? serviceError.message
					: String(serviceError);
			console.warn(`⚠️  ${serviceMessage}`);
			console.warn("ℹ️  Falling back to AST-based TypeScript scanning.");
			const scan = scanTypeScriptProject(
				options.input,
				fs as OpenApiValue as Parameters<typeof scanTypeScriptProject>[1],
			);
			spec = buildOpenApiSpecFromScan(scan);
			try {
				const metadata = parseGeneratedMetadata(
					options.input,
					fs as OpenApiValue as Parameters<typeof parseGeneratedMetadata>[1],
				);
				spec = applyReverseMetadata(
					spec as OpenApiValue as Parameters<typeof applyReverseMetadata>[0],
					metadata,
				);
			} catch (metaError) {
				const metaMessage =
					metaError instanceof Error ? metaError.message : String(metaError);
				console.warn(`⚠️  ${metaMessage}`);
				console.warn("ℹ️  Continuing without reconstructed metadata.");
			}
		}
	}

	if (returnObject) {
		return spec;
	}

	writeFormattedSpec(spec, options.format, options.output);
	return undefined;
}

/**
 * Generates JSON documentation with code snippets for an OpenAPI specification.
 *
 * @param options - Options controlling input spec, framework, wrapper flags, and output path.
 * @param returnObject - When `true`, returns the generated documentation object instead of writing to disk/stdout.
 * @returns Promise resolving to the documentation object when `returnObject` is `true`, otherwise `undefined`.
 */
export async function generateDocsJson(
	options: DocsJsonOptions,
	returnObject = false,
): Promise<undefined | OpenApiValue> {
	const config = {
		input: options.input,
		output: "./generated",
		options: {
			framework: options.framework || "vanilla",
			dateType: "Date",
			enumStyle: "enum",
		},
		compilerOptions: {},
	} as GeneratorConfig;
	const parser = await SwaggerParser.create(options.input, config);
	const docsOptions = {
		imports: options.imports !== false,
		wrapping: options.wrapping !== false,
	};
	const docs = generateDocsJsonImpl(parser, config, docsOptions);

	if (returnObject) {
		return docs;
	}

	writeDocsJsonOutput(docs, options.output);
	return undefined;
}

/**
 * Registers the `to_openapi` and `to_docs_json` commands on the root Commander program.
 *
 * @param program - Root Commander `Command` instance.
 */
export function registerToOpenApiCommands(program: Command): void {
	program
		.command("to_openapi")
		.description("Generate an OpenAPI specification from source code.")
		.addOption(
			new Option("-i, --input <path>", "Path to source code directory or file")
				.env("CDD_INPUT")
				.makeOptionMandatory(),
		)
		.addOption(
			new Option("-o, --output <path>", "Output file").env("CDD_OUTPUT"),
		)
		.addOption(
			new Option("-f, --format <format>", "Output format for the OpenAPI spec")
				.choices(["json", "yaml"])
				.default("yaml")
				.env("CDD_FORMAT"),
		)
		.addOption(
			new Option(
				"--orm <type>",
				"Target ORM implementation to parse entities from",
			)
				.choices(["typeorm"])
				.env("CDD_ORM"),
		)
		.action(async (options: ToActionOptions) => {
			try {
				await generateToOpenApi(options);
			} catch (error) {
				console.error(
					"❌ to_openapi failed:",
					error instanceof Error
						? error.message
						: `Unknown error: ${String(error)}`,
				);
				process.exit(1);
			}
		});

	program
		.command("to_docs_json")
		.description(
			"Generate JSON documentation with code snippets for an OpenAPI specification",
		)
		.addOption(
			new Option(
				"-i, --input <path>",
				"Path or URL to the OpenAPI specification",
			)
				.env("CDD_INPUT")
				.makeOptionMandatory(),
		)
		.addOption(
			new Option("-o, --output <path>", "Path to write the JSON to").env(
				"CDD_OUTPUT",
			),
		)
		.addOption(
			new Option("-f, --framework <framework>", "Target framework")
				.choices(["angular", "react", "vue", "vanilla", "Vanilla JS"])
				.default("vanilla")
				.env("CDD_FRAMEWORK"),
		)
		.addOption(
			new Option("--no-imports", "Omit the imports field").env(
				"CDD_NO_IMPORTS",
			),
		)
		.addOption(
			new Option("--no-wrapping", "Omit the wrapper fields").env(
				"CDD_NO_WRAPPING",
			),
		)
		.action(async (options: DocsJsonOptions) => {
			try {
				await generateDocsJson(options);
			} catch (error) {
				console.error(
					"❌ to_docs_json failed:",
					error instanceof Error
						? error.message
						: `Unknown error: ${String(error)}`,
				);
				process.exit(1);
			}
		});
}
