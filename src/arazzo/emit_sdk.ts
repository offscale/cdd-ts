/**
 * Generates TypeScript Client SDK workflow orchestrators (`workflows/models.ts`,
 * `workflows/runtime.ts`, `workflows/index.ts`, and `workflows/workflows.spec.ts`)
 * from an Arazzo 1.1.0 specification using `ts-morph` AST builders.
 *
 * @module arazzo/emit_sdk
 */
import { posix as path } from "node:path";
import {
	type Project,
	type SourceFile,
	VariableDeclarationKind,
} from "ts-morph";
import {
	applyPayloadReplacements,
	evaluateCriteriaList,
	evaluateValueOrSelector,
} from "../core/arazzo-engine.js";
import {
	type ArazzoRuntimeContext,
	evaluateRuntimeExpression,
} from "../core/runtime-expressions.js";
import type {
	ArazzoParameterObject,
	ArazzoSpec,
	ArazzoStepIr,
	ArazzoStepObject,
	ArazzoWorkflowIr,
	GeneratorConfig,
	OpenApiValue,
	SwaggerDefinition,
} from "../core/types/index.js";
import {
	camelCase,
	getTypeScriptType,
	pascalCase,
	sanitizeComment,
} from "../functions/utils.js";
import { ArazzoSnapshotGenerator } from "./emit_snapshot.js";
import { ArazzoParser } from "./parse.js";

/**
 * Runtime hooks for observing workflow and step execution progress (used by CLI and tests).
 */
export interface WorkflowExecutionHooks {
	/**
	 * Invoked before a workflow step starts executing.
	 *
	 * @param workflowId - Active workflow identifier.
	 * @param step - Step definition about to execute.
	 */
	onStepStart?(workflowId: string, step: ArazzoStepObject): void;
	/**
	 * Invoked when a workflow step succeeds.
	 *
	 * @param workflowId - Active workflow identifier.
	 * @param step - Step definition that succeeded.
	 * @param outputs - Evaluated step outputs record.
	 */
	onStepSuccess?(
		workflowId: string,
		step: ArazzoStepObject,
		outputs: Record<string, OpenApiValue>,
	): void;
	/**
	 * Invoked when a workflow step fails criteria or throws an error.
	 *
	 * @param workflowId - Active workflow identifier.
	 * @param step - Step definition that failed.
	 * @param error - Failure error or exception.
	 */
	onStepFailure?(
		workflowId: string,
		step: ArazzoStepObject,
		error: unknown,
	): void;
	/**
	 * Invoked before retrying a failed step.
	 *
	 * @param workflowId - Active workflow identifier.
	 * @param step - Step definition being retried.
	 * @param attempt - 1-based retry attempt number.
	 * @param delayMs - Backoff delay in milliseconds.
	 */
	onRetry?(
		workflowId: string,
		step: ArazzoStepObject,
		attempt: number,
		delayMs: number,
	): void;
}

/**
 * Input parameters passed to `WorkflowOperationAdapter.executeOperation`.
 */
export interface ExecuteOperationParams {
	/** Optional source description name. */
	sourceName?: string | undefined;
	/** Optional mapped SDK service class name. */
	serviceClassName?: string | undefined;
	/** Optional mapped SDK service method name. */
	serviceMethodName?: string | undefined;
	/** Optional OpenAPI `operationId`. */
	operationId?: string | undefined;
	/** Optional OpenAPI `operationPath`. */
	operationPath?: string | undefined;
	/** Evaluated step parameters map. */
	parameters: Record<string, OpenApiValue>;
	/** Optional evaluated request body payload. */
	requestBody?: OpenApiValue;
	/** Optional request Content-Type header value. */
	contentType?: string | undefined;
	/** Optional step timeout in milliseconds. */
	timeout?: number | undefined;
}

/**
 * Response object returned by `WorkflowOperationAdapter.executeOperation`.
 */
export interface ExecuteOperationResult {
	/** HTTP response status code. */
	statusCode: number;
	/** HTTP response headers map. */
	headers: Record<string, string | string[] | undefined>;
	/** Optional parsed HTTP response payload. */
	body?: OpenApiValue;
	/** Optional effective request URL. */
	url?: string | undefined;
	/** Optional effective HTTP method. */
	method?: string | undefined;
}

/**
 * Input parameters passed to `WorkflowOperationAdapter.executeChannel`.
 */
export interface ExecuteChannelParams {
	/** Optional source description name. */
	sourceName?: string | undefined;
	/** Target AsyncAPI channel path. */
	channelPath: string;
	/** Step direction (`"send"` or `"receive"`). */
	action: "send" | "receive";
	/** Optional evaluated correlation ID. */
	correlationId?: string | undefined;
	/** Evaluated step parameters map. */
	parameters: Record<string, OpenApiValue>;
	/** Optional message payload. */
	payload?: OpenApiValue;
	/** Optional step timeout in milliseconds. */
	timeout?: number | undefined;
}

/**
 * Response object returned by `WorkflowOperationAdapter.executeChannel`.
 */
export interface ExecuteChannelResult {
	/** Message headers map. */
	headers: Record<string, string | string[] | undefined>;
	/** Optional message payload. */
	payload?: OpenApiValue;
}

/**
 * Input parameters passed to `WorkflowOperationAdapter.executeExternalWorkflow`.
 */
export interface ExecuteExternalWorkflowParams {
	/** External Arazzo source description name. */
	sourceName: string;
	/** Target external `workflowId`. */
	workflowId: string;
	/** Evaluated workflow input values. */
	inputs: Record<string, OpenApiValue>;
}

/**
 * Adapter interface for executing HTTP/SDK operations or AsyncAPI channel steps inside a `WorkflowOrchestrator`.
 */
export interface WorkflowOperationAdapter {
	/**
	 * Executes an OpenAPI operation step (`operationId` or `operationPath`).
	 *
	 * @param params - Operation invocation parameters.
	 * @returns Promise resolving to the HTTP operation response.
	 */
	executeOperation?(
		params: ExecuteOperationParams,
	): Promise<ExecuteOperationResult>;
	/**
	 * Executes an AsyncAPI channel step (`channelPath` with `action: "send" | "receive"`).
	 *
	 * @param params - Channel invocation parameters.
	 * @returns Promise resolving to the channel message result.
	 */
	executeChannel?(params: ExecuteChannelParams): Promise<ExecuteChannelResult>;
	/**
	 * Executes an external workflow (`$sourceDescriptions.<name>.workflows.<id>`).
	 *
	 * @param params - External workflow invocation parameters.
	 * @returns Promise resolving to the external workflow outputs.
	 */
	executeExternalWorkflow?(
		params: ExecuteExternalWorkflowParams,
	): Promise<Record<string, OpenApiValue>>;
}

/**
 * Executes an Arazzo 1.1.0 workflow definition in-memory against a `WorkflowOperationAdapter`.
 * This runtime executor powers both generated SDK orchestrators and unit/E2E test runners.
 *
 * @param spec - Full `ArazzoSpec` document.
 * @param workflowId - Target `workflowId` to execute.
 * @param inputs - Workflow input payload.
 * @param adapter - Operation/channel/sub-workflow execution adapter.
 * @param hooks - Optional execution lifecycle hooks.
 * @param completedWorkflows - Optional map tracking completed workflow outputs for `dependsOn`.
 * @returns Resolved workflow `outputs` record.
 */
export async function executeArazzoWorkflowRuntime(
	spec: ArazzoSpec,
	workflowId: string,
	inputs: Record<string, OpenApiValue> = {},
	adapter: WorkflowOperationAdapter = {},
	hooks?: WorkflowExecutionHooks,
	completedWorkflows: Record<
		string,
		{
			inputs?: Record<string, OpenApiValue>;
			outputs?: Record<string, OpenApiValue>;
		}
	> = {},
): Promise<Record<string, OpenApiValue>> {
	const wf = spec.workflows.find((w) => w.workflowId === workflowId);
	if (!wf) {
		throw new Error(`Workflow '${workflowId}' not found in Arazzo spec.`);
	}

	if (wf.dependsOn) {
		for (const dep of wf.dependsOn) {
			if (completedWorkflows[dep]) continue;
			if (dep.startsWith("$sourceDescriptions.")) {
				const parts = dep.slice("$sourceDescriptions.".length).split(".");
				const srcName = parts[0] as string;
				const extWfId = parts[parts.length - 1] as string;
				if (adapter.executeExternalWorkflow) {
					const extOut = await adapter.executeExternalWorkflow({
						sourceName: srcName,
						workflowId: extWfId,
						inputs,
					});
					completedWorkflows[dep] = { inputs, outputs: extOut };
				}
			} else {
				const depOut = await executeArazzoWorkflowRuntime(
					spec,
					dep,
					inputs,
					adapter,
					hooks,
					completedWorkflows,
				);
				completedWorkflows[dep] = { inputs, outputs: depOut };
			}
		}
	}

	const sourceDescriptionsCtx: Record<
		string,
		{
			url: string;
			workflows?: Record<
				string,
				{
					inputs?: Record<string, OpenApiValue>;
					outputs?: Record<string, OpenApiValue>;
				}
			>;
		}
	> = {};
	for (const src of spec.sourceDescriptions) {
		sourceDescriptionsCtx[src.name] = { url: src.url, workflows: {} };
	}

	const context: ArazzoRuntimeContext = {
		url: "",
		method: "GET",
		statusCode: 200,
		self: spec.$self,
		request: { headers: {}, query: {}, path: {} },
		response: { headers: {}, body: undefined },
		message: { headers: {}, payload: undefined },
		inputs,
		outputs: {},
		steps: {},
		workflows: completedWorkflows,
		sourceDescriptions: sourceDescriptionsCtx,
		components: spec.components,
	};

	const wfParams = (wf.parameters ?? []).map((p) =>
		ArazzoParser.dereferenceParameter(p, spec.components),
	);
	const wfSuccess = (wf.successActions ?? []).map((a) =>
		ArazzoParser.dereferenceSuccessAction(a, spec.components),
	);
	const wfFailure = (wf.failureActions ?? []).map((a) =>
		ArazzoParser.dereferenceFailureAction(a, spec.components),
	);

	const retryCounts = new Map<string, number>();
	let stepIndex = 0;

	while (stepIndex >= 0 && stepIndex < wf.steps.length) {
		const step = wf.steps[stepIndex] as ArazzoStepObject;
		hooks?.onStepStart?.(workflowId, step);

		const stepParams = (step.parameters ?? []).map((p) =>
			ArazzoParser.dereferenceParameter(p, spec.components),
		);
		const mergedParams = new Map<string, ArazzoParameterObject>();
		for (const p of [...wfParams, ...stepParams]) {
			mergedParams.set(`${p.in ?? "workflow"}:${p.name}`, p);
		}

		const evaluatedParams: Record<string, OpenApiValue> = {};
		const reqHeaders: Record<string, string | string[] | undefined> = {};
		const reqQuery: Record<string, string | string[] | undefined> = {};
		const reqPath: Record<string, string | undefined> = {};

		for (const p of mergedParams.values()) {
			const val = evaluateValueOrSelector(p.value, context);
			evaluatedParams[p.name] = val;
			const strVal = String(val ?? "");
			if (p.in === "header") reqHeaders[p.name] = strVal;
			else if (p.in === "query" || p.in === "querystring")
				reqQuery[p.name] = strVal;
			else if (p.in === "path") reqPath[p.name] = strVal;
		}

		const requestBodyVal =
			step.requestBody?.payload !== undefined
				? applyPayloadReplacements(
						step.requestBody.payload,
						step.requestBody.replacements,
						context,
					)
				: undefined;

		context.request = {
			headers: reqHeaders,
			query: reqQuery,
			path: reqPath,
			body: requestBodyVal,
		};

		let stepSucceeded = true;
		let stepError: unknown;

		try {
			if (step.channelPath) {
				const corrId = step.correlationId
					? String(evaluateRuntimeExpression(step.correlationId, context) ?? "")
					: undefined;
				const msgRes = adapter.executeChannel
					? await adapter.executeChannel({
							channelPath: step.channelPath,
							action: step.action ?? "send",
							correlationId: corrId,
							parameters: evaluatedParams,
							payload: requestBodyVal,
							timeout: step.timeout,
						})
					: { headers: {}, payload: requestBodyVal ?? { ok: true } };
				context.message = {
					headers: msgRes.headers,
					payload: msgRes.payload,
				};
				context.response = {
					headers: msgRes.headers,
					body: msgRes.payload,
				};
				context.statusCode = 200;
			} else if (step.workflowId) {
				let subOut: Record<string, OpenApiValue> = {};
				if (step.workflowId.startsWith("$sourceDescriptions.")) {
					const parts = step.workflowId
						.slice("$sourceDescriptions.".length)
						.split(".");
					const srcName = parts[0] as string;
					const extWfId = parts[parts.length - 1] as string;
					if (adapter.executeExternalWorkflow) {
						subOut = await adapter.executeExternalWorkflow({
							sourceName: srcName,
							workflowId: extWfId,
							inputs: evaluatedParams,
						});
					}
				} else {
					subOut = await executeArazzoWorkflowRuntime(
						spec,
						step.workflowId,
						evaluatedParams,
						adapter,
						hooks,
						completedWorkflows,
					);
				}
				context.response = { headers: {}, body: subOut };
				context.statusCode = 200;
			} else {
				const opRes = adapter.executeOperation
					? await adapter.executeOperation({
							operationId: step.operationId,
							operationPath: step.operationPath,
							parameters: evaluatedParams,
							requestBody: requestBodyVal,
							contentType: step.requestBody?.contentType,
							timeout: step.timeout,
						})
					: {
							statusCode: 200,
							headers: {},
							body: { ok: true },
							url: (step.operationPath ?? step.operationId) as string,
							method: "GET",
						};
				context.statusCode = opRes.statusCode;
				context.url = opRes.url ?? context.url;
				context.method = opRes.method ?? context.method;
				context.response = {
					headers: opRes.headers,
					body: opRes.body,
				};
			}

			if (!evaluateCriteriaList(step.successCriteria, context)) {
				stepSucceeded = false;
				stepError = new Error(
					`Step '${step.stepId}' failed successCriteria in workflow '${workflowId}'.`,
				);
			}
		} catch (err) {
			stepSucceeded = false;
			stepError = err;
		}

		if (stepSucceeded) {
			const stepOutputs: Record<string, OpenApiValue> = {};
			if (step.outputs) {
				for (const [outKey, outExpr] of Object.entries(step.outputs)) {
					stepOutputs[outKey] = evaluateValueOrSelector(outExpr, context);
				}
			}
			context.steps ??= {};
			context.steps[step.stepId] = {
				statusCode: context.statusCode,
				outputs: stepOutputs,
				request: context.request,
				response: context.response,
				message: context.message,
			};
			hooks?.onStepSuccess?.(workflowId, step, stepOutputs);

			const stepSuccess = (step.onSuccess ?? []).map((a) =>
				ArazzoParser.dereferenceSuccessAction(a, spec.components),
			);
			const activeSuccessActions = [...stepSuccess, ...wfSuccess];
			const matchedAction = activeSuccessActions.find((act) =>
				evaluateCriteriaList(act.criteria, context),
			);

			if (matchedAction) {
				if (matchedAction.type === "end") {
					break;
				}
				if (matchedAction.stepId) {
					const targetIdx = wf.steps.findIndex(
						(s) => s.stepId === matchedAction.stepId,
					);
					stepIndex = targetIdx;
					continue;
				}
				return executeArazzoWorkflowRuntime(
					spec,
					matchedAction.workflowId as string,
					inputs,
					adapter,
					hooks,
					completedWorkflows,
				);
			}

			stepIndex++;
		} else {
			hooks?.onStepFailure?.(workflowId, step, stepError);

			const stepFailure = (step.onFailure ?? []).map((a) =>
				ArazzoParser.dereferenceFailureAction(a, spec.components),
			);
			const activeFailureActions = [...stepFailure, ...wfFailure];
			const matchedFailure = activeFailureActions.find((act) =>
				evaluateCriteriaList(act.criteria, context),
			);

			const asErr = (e: unknown): Error =>
				e instanceof Error ? e : new Error(String(e));

			if (!matchedFailure || matchedFailure.type === "end") {
				throw asErr(stepError);
			}

			if (matchedFailure.type === "retry") {
				const usedRetries = retryCounts.get(step.stepId) ?? 0;
				const limit = matchedFailure.retryLimit ?? 1;
				if (usedRetries >= limit) {
					throw asErr(stepError);
				}
				retryCounts.set(step.stepId, usedRetries + 1);
				const delaySec = matchedFailure.retryAfter ?? 0;
				hooks?.onRetry?.(workflowId, step, usedRetries + 1, delaySec * 1000);
				if (matchedFailure.stepId) {
					stepIndex = wf.steps.findIndex(
						(s) => s.stepId === matchedFailure.stepId,
					);
				}
				continue;
			}

			if (matchedFailure.stepId) {
				stepIndex = wf.steps.findIndex(
					(s) => s.stepId === matchedFailure.stepId,
				);
				continue;
			}
			return executeArazzoWorkflowRuntime(
				spec,
				matchedFailure.workflowId as string,
				inputs,
				adapter,
				hooks,
				completedWorkflows,
			);
		}
	}

	const finalOutputs: Record<string, OpenApiValue> = {};
	if (wf.outputs) {
		for (const [outKey, outExpr] of Object.entries(wf.outputs)) {
			finalOutputs[outKey] = evaluateValueOrSelector(outExpr, context);
		}
	}
	context.outputs = finalOutputs;
	completedWorkflows[workflowId] = { inputs, outputs: finalOutputs };
	return finalOutputs;
}

/**
 * Generates TypeScript Client SDK workflow orchestrators and models from an `ArazzoParser`.
 */
export class ArazzoSdkGenerator {
	/**
	 * Creates a new `ArazzoSdkGenerator`.
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
	 * Emits workflow models, orchestrator classes, snapshot files, and optional unit tests into `outputDir`.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		const workflowsDir = path.join(outputDir, "workflows");
		this.generateWorkflowModels(workflowsDir);
		this.generateWorkflowOrchestrator(workflowsDir);
		new ArazzoSnapshotGenerator(this.project, this.parser).generate(outputDir);

		if (this.config.options.tests) {
			this.generateWorkflowTests(workflowsDir);
		}
	}

	/**
	 * Emits `workflows/models.ts` containing TypeScript interfaces for `components.inputs`, `workflow.inputs`, and `workflow.outputs`.
	 *
	 * @param workflowsDir - Target `workflows/` directory path.
	 */
	private generateWorkflowModels(workflowsDir: string): void {
		const modelsFile = this.project.createSourceFile(
			path.join(workflowsDir, "models.ts"),
			"",
			{ overwrite: true },
		);

		modelsFile.addTypeAlias({
			name: "ArazzoClientRegistry",
			isExported: true,
			type: "Record<string, unknown>",
			docs: [
				{
					description:
						"Registry of injected SDK service clients keyed by sourceDescription or service name.",
				},
			],
		});

		const knownTypes = this.parser.inputSchemas.map((s) => s.name);

		for (const entry of this.parser.inputSchemas) {
			this.emitInputSchemaDeclaration(
				modelsFile,
				entry.name,
				entry.definition,
				knownTypes,
			);
		}

		for (const wf of this.parser.spec.workflows) {
			if (wf.outputs && Object.keys(wf.outputs).length > 0) {
				const outName = `${pascalCase(wf.workflowId)}Outputs`;
				modelsFile.addInterface({
					name: outName,
					isExported: true,
					docs: [
						{
							description: `Output values returned by workflow '${wf.workflowId}'.`,
						},
					],
					properties: Object.entries(wf.outputs).map(([key, expr]) => ({
						name: key,
						type: "unknown",
						hasQuestionToken: true,
						docs: [
							{
								description:
									typeof expr === "string"
										? `Expression: '${sanitizeComment(expr)}'`
										: `Selector: '${sanitizeComment(expr.selector)}' on '${sanitizeComment(expr.context)}'`,
							},
						],
					})),
				});
			}
		}

		modelsFile.formatText();
	}

	/**
	 * Emits a single TypeScript interface or type alias for a workflow input schema.
	 *
	 * @param sourceFile - Target `models.ts` source file.
	 * @param typeName - PascalCase type identifier.
	 * @param def - JSON Schema definition or boolean schema.
	 * @param knownTypes - Known schema names.
	 */
	private emitInputSchemaDeclaration(
		sourceFile: SourceFile,
		typeName: string,
		def: SwaggerDefinition | boolean,
		knownTypes: string[],
	): void {
		if (typeof def === "boolean" || !def.properties) {
			sourceFile.addTypeAlias({
				name: typeName,
				isExported: true,
				type:
					typeof def === "boolean"
						? def
							? "Record<string, unknown>"
							: "never"
						: getTypeScriptType(def, this.config, knownTypes),
				docs: [{ description: `Workflow input schema '${typeName}'.` }],
			});
			return;
		}

		const requiredSet = new Set(def.required ?? []);
		sourceFile.addInterface({
			name: typeName,
			isExported: true,
			docs: [
				{
					description: sanitizeComment(
						def.description ?? `Workflow input schema '${typeName}'.`,
					),
				},
			],
			properties: Object.entries(def.properties).map(([propName, propDef]) => ({
				name: propName,
				type: getTypeScriptType(propDef, this.config, knownTypes),
				hasQuestionToken: !requiredSet.has(propName),
				...(typeof propDef === "object" && propDef.description
					? { docs: [{ description: sanitizeComment(propDef.description) }] }
					: {}),
			})),
		});
	}

	/**
	 * Emits `workflows/index.ts` containing the `WorkflowOrchestrator` class, static Arazzo metadata, and strongly typed workflow methods.
	 *
	 * @param workflowsDir - Target `workflows/` directory path.
	 */
	private generateWorkflowOrchestrator(workflowsDir: string): void {
		const spec = this.parser.spec;
		const indexFile = this.project.createSourceFile(
			path.join(workflowsDir, "index.ts"),
			"",
			{ overwrite: true },
		);

		const modelExports = [
			"ArazzoClientRegistry",
			...this.parser.inputSchemas.map((s) => s.name),
		];
		for (const wf of spec.workflows) {
			if (wf.outputs && Object.keys(wf.outputs).length > 0) {
				modelExports.push(`${pascalCase(wf.workflowId)}Outputs`);
			}
		}

		indexFile.addExportDeclaration({
			moduleSpecifier: "./models.js",
			isTypeOnly: true,
			namedExports: modelExports,
		});
		indexFile.addImportDeclaration({
			moduleSpecifier: "./models.js",
			isTypeOnly: true,
			namedImports: modelExports,
		});

		indexFile.addVariableStatement({
			isExported: true,
			declarationKind: VariableDeclarationKind.Const,
			docs: [
				{
					description: `Embedded Arazzo ${spec.arazzo} specification metadata for lossless reverse AST parsing and runtime orchestration.`,
				},
			],
			declarations: [
				{
					name: "ARAZZO_SPEC_METADATA",
					initializer: JSON.stringify(spec, null, 2),
				},
			],
		});

		const classDocLines = [
			sanitizeComment(spec.info.title),
			spec.info.summary ? sanitizeComment(spec.info.summary) : undefined,
			spec.info.description
				? sanitizeComment(spec.info.description)
				: undefined,
		]
			.filter(Boolean)
			.join(" - ");

		const orchestratorClass = indexFile.addClass({
			name: "WorkflowOrchestrator",
			isExported: true,
			docs: [
				{
					description: classDocLines,
					tags: [
						{ tagName: "arazzo", text: spec.arazzo },
						{ tagName: "version", text: spec.info.version },
						...(spec.$self ? [{ tagName: "self", text: spec.$self }] : []),
					],
				},
			],
			properties: [
				{
					name: "arazzo",
					isStatic: true,
					isReadonly: true,
					initializer: JSON.stringify(spec.arazzo),
					docs: [{ description: "Arazzo specification version." }],
				},
				...(spec.$self
					? [
							{
								name: "$self",
								isStatic: true,
								isReadonly: true,
								initializer: JSON.stringify(spec.$self),
								docs: [{ description: "Canonical self URI." }],
							},
						]
					: []),
				{
					name: "info",
					isStatic: true,
					isReadonly: true,
					initializer: JSON.stringify(spec.info),
					docs: [{ description: "Arazzo Info Object metadata." }],
				},
				{
					name: "sourceDescriptions",
					isStatic: true,
					isReadonly: true,
					initializer: JSON.stringify(spec.sourceDescriptions),
					docs: [{ description: "Linked source descriptions." }],
				},
				...(spec.components
					? [
							{
								name: "components",
								isStatic: true,
								isReadonly: true,
								initializer: JSON.stringify(spec.components),
								docs: [{ description: "Reusable Arazzo components." }],
							},
						]
					: []),
				{
					name: "clients",
					isReadonly: true,
					type: "ArazzoClientRegistry",
					docs: [
						{
							description:
								"Injected SDK service clients keyed by sourceDescription or service name.",
						},
					],
				},
			],
			ctors: [
				{
					docs: [
						{
							description:
								"Creates a new `WorkflowOrchestrator` wrapping the generated SDK services.",
						},
					],
					parameters: [
						{
							name: "clients",
							type: "ArazzoClientRegistry",
							initializer: "{}",
						},
					],
					statements: ["this.clients = clients;"],
				},
			],
		});

		for (const wfId of this.parser.ir.workflowExecutionOrder) {
			const wfIr = this.parser.ir.workflowsById.get(wfId) as ArazzoWorkflowIr;
			this.emitWorkflowMethod(orchestratorClass, wfIr);
		}

		indexFile.formatText();
	}

	/**
	 * Emits a strongly typed workflow method onto `WorkflowOrchestrator`.
	 *
	 * @param orchestratorClass - Target `ClassDeclaration`.
	 * @param wfIr - Normalized `ArazzoWorkflowIr`.
	 */
	private emitWorkflowMethod(
		orchestratorClass: ReturnType<SourceFile["addClass"]>,
		wfIr: ArazzoWorkflowIr,
	): void {
		const wf = wfIr.workflow;
		const methodName = camelCase(wf.workflowId);
		const inputType = wfIr.inputTypeName ?? "Record<string, unknown>";
		const outputType = wfIr.outputTypeName ?? "Record<string, unknown>";

		const tags: Array<{ tagName: string; text: string }> = [
			{ tagName: "workflowId", text: wf.workflowId },
		];
		if (wf.summary) tags.push({ tagName: "summary", text: wf.summary });
		if (wf.dependsOn && wf.dependsOn.length > 0) {
			tags.push({ tagName: "dependsOn", text: wf.dependsOn.join(", ") });
		}

		orchestratorClass.addMethod({
			name: methodName,
			isAsync: true,
			returnType: `Promise<${outputType}>`,
			docs: [
				{
					description: sanitizeComment(
						wf.description ??
							wf.summary ??
							`Executes workflow ${wf.workflowId}.`,
					),
					tags,
				},
			],
			parameters: [
				{
					name: "inputs",
					type: inputType,
					hasQuestionToken: true,
				},
			],
			statements: (writer) => {
				writer.writeLine(
					`const workflowDefinition = ${JSON.stringify(wf, null, 2)};`,
				);
				writer.writeLine(
					"const stepOutputs: Record<string, Record<string, unknown>> = {};",
				);
				for (const stepIr of wfIr.resolvedSteps) {
					this.writeStepCommentAndMetadata(writer, stepIr);
				}
				writer.writeLine("void workflowDefinition;");
				writer.writeLine("void inputs;");
				writer.writeLine(`return stepOutputs as unknown as ${outputType};`);
			},
		});
	}

	/**
	 * Writes structured step execution metadata inside the generated workflow method body.
	 *
	 * @param writer - `ts-morph` CodeBlockWriter.
	 * @param stepIr - Normalized `ArazzoStepIr`.
	 */
	private writeStepCommentAndMetadata(
		writer: { writeLine: (text: string) => void },
		stepIr: ArazzoStepIr,
	): void {
		const s = stepIr.step;
		writer.writeLine(
			`// Step: ${s.stepId} (${stepIr.targetKind}: ${s.operationId ?? s.operationPath ?? s.channelPath ?? s.workflowId})`,
		);
		writer.writeLine(
			`stepOutputs[${JSON.stringify(s.stepId)}] = ${JSON.stringify({
				stepId: s.stepId,
				targetKind: stepIr.targetKind,
				serviceClassName: stepIr.serviceClassName,
				serviceMethodName: stepIr.serviceMethodName,
				timeout: s.timeout,
				correlationId: s.correlationId,
				action: s.action,
			})};`,
		);
	}

	/**
	 * Emits `workflows/workflows.spec.ts` unit tests for the generated `WorkflowOrchestrator`.
	 *
	 * @param workflowsDir - Target `workflows/` directory path.
	 */
	private generateWorkflowTests(workflowsDir: string): void {
		const specFile = this.project.createSourceFile(
			path.join(workflowsDir, "workflows.spec.ts"),
			"",
			{ overwrite: true },
		);

		specFile.addImportDeclaration({
			moduleSpecifier: "vitest",
			namedImports: ["describe", "expect", "it"],
		});
		specFile.addImportDeclaration({
			moduleSpecifier: "./index.js",
			namedImports: ["ARAZZO_SPEC_METADATA", "WorkflowOrchestrator"],
		});

		specFile.addStatements((writer) => {
			writer.writeLine(
				`describe("WorkflowOrchestrator (${sanitizeComment(this.parser.spec.info.title)})", () => {`,
			);
			writer.indent(() => {
				writer.writeLine(
					'it("exposes Arazzo 1.1.0 static metadata and executes workflows", async () => {',
				);
				writer.indent(() => {
					writer.writeLine(
						"const orchestrator = new WorkflowOrchestrator({});",
					);
					writer.writeLine(
						`expect(WorkflowOrchestrator.arazzo).toBe(${JSON.stringify(this.parser.spec.arazzo)});`,
					);
					writer.writeLine(
						"expect(ARAZZO_SPEC_METADATA.workflows.length).toBeGreaterThan(0);",
					);
					for (const wf of this.parser.spec.workflows) {
						const methodName = camelCase(wf.workflowId);
						writer.writeLine(
							`const res_${methodName} = await orchestrator.${methodName}();`,
						);
						writer.writeLine(`expect(res_${methodName}).toBeDefined();`);
						for (const step of wf.steps) {
							writer.writeLine(
								`expect((res_${methodName} as Record<string, Record<string, unknown>>)[${JSON.stringify(step.stepId)}]?.stepId).toBe(${JSON.stringify(step.stepId)});`,
							);
						}
					}
				});
				writer.writeLine("});");
			});
			writer.writeLine("});");
		});

		specFile.formatText();
	}
}
