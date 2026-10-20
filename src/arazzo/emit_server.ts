/**
 * Generates backend server workflow execution routes (`workflows/engine.routes.ts`)
 * and multi-step Vitest E2E workflow integration test suites (`workflows/workflows.e2e.spec.ts`)
 * from an Arazzo 1.1.0 specification.
 *
 * @module arazzo/emit_server
 */
import { posix as path } from "node:path";
import type { Project } from "ts-morph";
import type { ArazzoWorkflowIr, GeneratorConfig } from "../core/types/index.js";
import { camelCase, sanitizeComment } from "../functions/utils.js";
import { ArazzoSdkGenerator } from "./emit_sdk.js";
import type { ArazzoParser } from "./parse.js";

/**
 * Generates server-side Arazzo 1.1.0 workflow execution endpoints and E2E test suites.
 */
export class ArazzoServerGenerator {
	/**
	 * Creates a new `ArazzoServerGenerator`.
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
	 * Emits `workflows/index.ts`, `workflows/engine.routes.ts`, and `workflows/workflows.e2e.spec.ts` into `outputDir`.
	 *
	 * @param outputDir - Target server output directory.
	 */
	public generate(outputDir: string): void {
		new ArazzoSdkGenerator(this.project, this.parser, this.config).generate(
			outputDir,
		);

		const workflowsDir = path.join(outputDir, "workflows");
		this.generateEngineRoutes(workflowsDir);
		this.generateE2eSuite(workflowsDir);
	}

	/**
	 * Emits `workflows/engine.routes.ts` exposing stateful server workflow execution handlers.
	 *
	 * @param workflowsDir - Target `workflows/` directory path.
	 */
	private generateEngineRoutes(workflowsDir: string): void {
		const routesFile = this.project.createSourceFile(
			path.join(workflowsDir, "engine.routes.ts"),
			"",
			{ overwrite: true },
		);

		routesFile.addImportDeclaration({
			moduleSpecifier: "./index.js",
			namedImports: ["ARAZZO_SPEC_METADATA", "WorkflowOrchestrator"],
		});

		routesFile.addStatements((writer) => {
			writer.writeLine("/**");
			writer.writeLine(
				" * Dispatches a server-side Arazzo 1.1.0 workflow by `workflowId`.",
			);
			writer.writeLine(" */");
			writer.writeLine(
				"export async function runServerWorkflow(workflowId: string, inputs: Record<string, unknown> = {}): Promise<unknown> {",
			);
			writer.indent(() => {
				writer.writeLine("const orchestrator = new WorkflowOrchestrator({});");
				writer.writeLine("switch (workflowId) {");
				writer.indent(() => {
					for (const wf of this.parser.spec.workflows) {
						const methodName = camelCase(wf.workflowId);
						writer.writeLine(`case ${JSON.stringify(wf.workflowId)}:`);
						writer.indent(() => {
							writer.writeLine(
								`return orchestrator.${methodName}(inputs as Parameters<WorkflowOrchestrator[${JSON.stringify(methodName)}]>[0]);`,
							);
						});
					}
					writer.writeLine("default:");
					writer.indent(() => {
						writer.writeLine(
							"throw new Error(`Unknown workflowId: ${workflowId}`);",
						);
					});
				});
				writer.writeLine("}");
			});
			writer.writeLine("}");
			writer.writeLine("export { ARAZZO_SPEC_METADATA };");
		});

		routesFile.formatText();
	}

	/**
	 * Emits `workflows/workflows.e2e.spec.ts` containing multi-step Vitest E2E workflow tests.
	 *
	 * @param workflowsDir - Target `workflows/` directory path.
	 */
	private generateE2eSuite(workflowsDir: string): void {
		const spec = this.parser.spec;
		const e2eFile = this.project.createSourceFile(
			path.join(workflowsDir, "workflows.e2e.spec.ts"),
			"",
			{ overwrite: true },
		);

		e2eFile.addImportDeclaration({
			moduleSpecifier: "vitest",
			namedImports: ["describe", "expect", "it"],
		});
		e2eFile.addImportDeclaration({
			moduleSpecifier: "./engine.routes.js",
			namedImports: ["ARAZZO_SPEC_METADATA", "runServerWorkflow"],
		});

		e2eFile.addStatements((writer) => {
			writer.writeLine(
				`describe("Arazzo E2E Workflows: ${sanitizeComment(spec.info.title)}", () => {`,
			);
			writer.indent(() => {
				for (const wfId of this.parser.ir.workflowExecutionOrder) {
					const wfIr = this.parser.ir.workflowsById.get(
						wfId,
					) as ArazzoWorkflowIr;
					const wf = wfIr.workflow;
					writer.writeLine(`describe("workflow: ${wf.workflowId}", () => {`);
					writer.indent(() => {
						for (const stepIr of wfIr.resolvedSteps) {
							const s = stepIr.step;
							const stepLabel = sanitizeComment(s.description ?? s.stepId);
							writer.writeLine(
								`it("step ${s.stepId}: ${stepLabel}", async () => {`,
							);
							writer.indent(() => {
								writer.writeLine(`const stepMeta = ${JSON.stringify(s)};`);
								writer.writeLine(
									`expect(stepMeta.stepId).toBe(${JSON.stringify(s.stepId)});`,
								);
							});
							writer.writeLine("});");
						}
						writer.writeLine(
							`it("executes full workflow '${wf.workflowId}' end-to-end", async () => {`,
						);
						writer.indent(() => {
							writer.writeLine(
								`const out = await runServerWorkflow(${JSON.stringify(wf.workflowId)}, {});`,
							);
							writer.writeLine("expect(out).toBeDefined();");
							writer.writeLine(
								"expect(ARAZZO_SPEC_METADATA.arazzo).toBeDefined();",
							);
						});
						writer.writeLine("});");
					});
					writer.writeLine("});");
				}
			});
			writer.writeLine("});");
		});

		e2eFile.formatText();
	}
}
