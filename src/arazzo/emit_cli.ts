/**
 * Generates a Commander-based CLI workflow runner (`cli.ts` / `arazzo-cli.ts`)
 * from an Arazzo 1.1.0 specification that directly imports and reuses the generated
 * SDK `WorkflowOrchestrator`.
 *
 * @module arazzo/emit_cli
 */
import { posix as path } from "node:path";
import type { Project } from "ts-morph";
import type {
	GeneratorConfig,
	SwaggerDefinition,
} from "../core/types/index.js";
import { camelCase, sanitizeComment } from "../functions/utils.js";
import { ArazzoSdkGenerator } from "./emit_sdk.js";
import type { ArazzoParser } from "./parse.js";

/**
 * Generates an Arazzo 1.1.0 CLI workflow runner (`cli.ts`) backed by the SDK `WorkflowOrchestrator`.
 */
export class ArazzoCliGenerator {
	/**
	 * Creates a new `ArazzoCliGenerator`.
	 *
	 * @param project - Target `ts-morph` Project.
	 * @param parser - Initialized `ArazzoParser`.
	 * @param config - Active generator configuration.
	 */
	public constructor(
		private readonly project: Project,
		private readonly parser: ArazzoParser,
		private readonly config: GeneratorConfig,
	) {}

	/**
	 * Emits the SDK workflow orchestrator (if not already present) and the Commander `cli.ts` entrypoint into `outputDir`.
	 *
	 * @param outputDir - Target output directory path.
	 */
	public generate(outputDir: string): void {
		new ArazzoSdkGenerator(this.project, this.parser, this.config).generate(
			outputDir,
		);

		const spec = this.parser.spec;
		const cliFile = this.project.createSourceFile(
			path.join(outputDir, "cli.ts"),
			"",
			{ overwrite: true },
		);

		cliFile.addImportDeclaration({
			moduleSpecifier: "commander",
			namedImports: ["Command"],
		});
		cliFile.addImportDeclaration({
			moduleSpecifier: "./workflows/index.js",
			namedImports: ["ARAZZO_SPEC_METADATA", "WorkflowOrchestrator"],
		});

		cliFile.addStatements((writer) => {
			writer.writeLine("export const program = new Command();");
			const safeName = spec.info.title
				.toLowerCase()
				.replace(/[^a-z0-9-]+/g, "-")
				.replace(/^-|-$/g, "");
			const cliDescription = sanitizeComment(
				spec.info.description ?? spec.info.title,
			);
			writer.writeLine(
				`program.name(${JSON.stringify(safeName)}).description(${JSON.stringify(cliDescription)}).version(${JSON.stringify(spec.info.version)});`,
			);
			writer.writeLine(
				'program.option("-f, --format <format>", "Output format (json, yaml, table)", "json");',
			);
			writer.writeLine(
				'program.option("-v, --verbose", "Enable verbose step-by-step execution logging", false);',
			);
			writer.writeLine(
				'program.option("--step <stepId>", "Run up to or target a specific stepId");',
			);
			for (const src of spec.sourceDescriptions) {
				writer.writeLine(
					`program.option("--source-${src.name}-url <url>", ${JSON.stringify(`Override URL for sourceDescription ${src.name}`)}, ${JSON.stringify(src.url)});`,
				);
			}

			writer.writeLine(
				'const workflowCmd = program.command("workflow").description("Execute Arazzo 1.1.0 workflows via the SDK WorkflowOrchestrator");',
			);

			for (const wf of spec.workflows) {
				const cmdVar = `wf_${camelCase(wf.workflowId)}`;
				const desc = sanitizeComment(
					wf.summary ?? wf.description ?? `Run workflow ${wf.workflowId}`,
				);
				writer.writeLine(
					`const ${cmdVar} = workflowCmd.command(${JSON.stringify(wf.workflowId)}).description(${JSON.stringify(desc)});`,
				);

				if (wf.inputs !== undefined) {
					const resolved = this.parser.resolveInputSchemaRef(wf.inputs);
					const props =
						typeof resolved === "object" ? resolved.properties : undefined;
					if (props) {
						for (const [propKey, propSchema] of Object.entries(props)) {
							const propDesc =
								typeof propSchema === "object" &&
								(propSchema as SwaggerDefinition).description
									? sanitizeComment(
											(propSchema as SwaggerDefinition).description as string,
										)
									: `Workflow input ${propKey}`;
							writer.writeLine(
								`${cmdVar}.option("--${propKey} <value>", ${JSON.stringify(propDesc)});`,
							);
						}
					}
				}

				const methodName = camelCase(wf.workflowId);
				writer.writeLine(
					`${cmdVar}.action(async (options: Record<string, unknown>) => {`,
				);
				writer.indent(() => {
					writer.writeLine(
						"const orchestrator = new WorkflowOrchestrator({});",
					);
					writer.writeLine(
						`const result = await orchestrator.${methodName}(options as Parameters<WorkflowOrchestrator[${JSON.stringify(methodName)}]>[0]);`,
					);
					writer.writeLine("console.log(JSON.stringify(result, null, 2));");
					writer.writeLine("void ARAZZO_SPEC_METADATA;");
				});
				writer.writeLine("});");
			}
		});

		cliFile.formatText();
	}
}
