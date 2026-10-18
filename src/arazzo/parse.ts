/**
 * Contains `ArazzoParser`, the central component responsible for loading, validating,
 * dereferencing, and building the normalized Intermediate Representation (`ArazzoIr`)
 * for Arazzo 1.1.0 specifications and their linked OpenAPI / AsyncAPI / Arazzo sources.
 *
 * @module arazzo/parse
 */
import {
	topologicalSortSteps,
	topologicalSortWorkflows,
} from "../core/arazzo-engine.js";
import { decodeJsonPointerToken } from "../core/runtime-expressions.js";
import {
	type ArazzoComponentsObject,
	type ArazzoFailureActionObject,
	type ArazzoIr,
	type ArazzoParameterObject,
	type ArazzoReusableObject,
	type ArazzoSpec,
	type ArazzoStepIr,
	type ArazzoStepObject,
	type ArazzoStepTargetKind,
	type ArazzoSuccessActionObject,
	type ArazzoWorkflowIr,
	type ArazzoWorkflowObject,
	type GeneratorConfig,
	isArazzoReusableObject,
	type OpenApiValue,
	type PathInfo,
	type SwaggerDefinition,
	type SwaggerSpec,
} from "../core/types/index.js";
import { camelCase, pascalCase } from "../functions/utils.js";
import type { NamedSchemaEntry, SwaggerParser } from "../openapi/parse.js";
import {
	ArazzoLoader,
	type AsyncApiChannelRecord,
	type LoadedArazzoBundle,
} from "./parse_loader.js";
import { validateArazzoSpec } from "./parse_validator.js";

/**
 * Central parser and normalizer for Arazzo 1.1.0 workflow specifications.
 */
export class ArazzoParser {
	/** Validated root Arazzo 1.1.0 specification. */
	public readonly spec: ArazzoSpec;
	/** Generator configuration options. */
	public readonly config: GeneratorConfig;
	/** Canonical base URI of the Arazzo document. */
	public readonly documentUri: string;
	/** Map of `sourceDescription.name` to parsed `SwaggerParser` instances. */
	public readonly openApiSources: Map<string, SwaggerParser>;
	/** Map of `sourceDescription.name` to nested `ArazzoSpec` instances. */
	public readonly arazzoSources: Map<string, ArazzoSpec>;
	/** Map of `sourceDescription.name` to AsyncAPI channel maps. */
	public readonly asyncApiSources: Map<
		string,
		Map<string, AsyncApiChannelRecord>
	>;
	/** Map of `sourceDescription.name` to resolved canonical URLs. */
	public readonly resolvedSourceUrls: Map<string, string>;
	/** Normalized Arazzo Intermediate Representation (`ArazzoIr`). */
	public readonly ir: ArazzoIr;
	/** Named JSON Schemas extracted from `components.inputs` and `workflow.inputs`. */
	public readonly inputSchemas: NamedSchemaEntry[];

	/**
	 * Creates a new `ArazzoParser` from a loaded bundle or in-memory `ArazzoSpec`.
	 *
	 * @param bundleOrSpec - Loaded bundle from `ArazzoLoader.loadSync` or raw `ArazzoSpec`.
	 * @param config - Generator configuration options.
	 */
	public constructor(
		bundleOrSpec: LoadedArazzoBundle | ArazzoSpec,
		config: GeneratorConfig,
	) {
		this.config = config;
		const bundle: LoadedArazzoBundle =
			"entrySpec" in bundleOrSpec
				? bundleOrSpec
				: ArazzoLoader.loadSync(bundleOrSpec, config);

		validateArazzoSpec(bundle.entrySpec);
		this.spec = bundle.entrySpec;
		this.documentUri = bundle.documentUri;
		this.openApiSources = bundle.openApiSources;
		this.arazzoSources = bundle.arazzoSources;
		this.asyncApiSources = bundle.asyncApiSources;
		this.resolvedSourceUrls = bundle.resolvedSourceUrls;
		this.inputSchemas = this.collectInputSchemas();
		this.ir = this.buildIr();
	}

	/**
	 * Synchronously loads and parses an Arazzo 1.1.0 specification from a file path or object.
	 *
	 * @param inputPathOrSpec - File path or in-memory `ArazzoSpec`.
	 * @param config - Generator configuration options.
	 * @param preloadedSpecs - Optional pre-loaded source description specifications.
	 * @returns Initialized `ArazzoParser`.
	 */
	public static createSync(
		inputPathOrSpec: string | ArazzoSpec,
		config: GeneratorConfig,
		preloadedSpecs?: Record<
			string,
			SwaggerSpec | ArazzoSpec | Record<string, OpenApiValue>
		>,
	): ArazzoParser {
		const bundle = ArazzoLoader.loadSync(
			inputPathOrSpec,
			config,
			preloadedSpecs,
		);
		return new ArazzoParser(bundle, config);
	}

	/**
	 * Asynchronously loads and parses an Arazzo 1.1.0 specification from a file path or object.
	 *
	 * @param inputPathOrSpec - File path or in-memory `ArazzoSpec`.
	 * @param config - Generator configuration options.
	 * @param preloadedSpecs - Optional pre-loaded source description specifications.
	 * @returns Promise resolving to an initialized `ArazzoParser`.
	 */
	public static async create(
		inputPathOrSpec: string | ArazzoSpec,
		config: GeneratorConfig,
		preloadedSpecs?: Record<
			string,
			SwaggerSpec | ArazzoSpec | Record<string, OpenApiValue>
		>,
	): Promise<ArazzoParser> {
		return ArazzoParser.createSync(inputPathOrSpec, config, preloadedSpecs);
	}

	/**
	 * Returns the raw validated `ArazzoSpec`.
	 *
	 * @returns Root `ArazzoSpec`.
	 */
	public getSpec(): ArazzoSpec {
		return this.spec;
	}

	/**
	 * Dereferences a parameter or reusable parameter reference against `components.parameters`.
	 *
	 * @param item - Parameter or reusable parameter object.
	 * @param components - Optional `ArazzoComponentsObject`.
	 * @returns Dereferenced `ArazzoParameterObject` with any reusable `value` override applied.
	 */
	public static dereferenceParameter(
		item: ArazzoParameterObject | ArazzoReusableObject,
		components: ArazzoComponentsObject | undefined,
	): ArazzoParameterObject {
		if (!isArazzoReusableObject(item)) {
			return item;
		}
		const key = item.reference.slice("$components.parameters.".length);
		const base = components?.parameters?.[key] as ArazzoParameterObject;
		if (item.value !== undefined) {
			return { ...base, value: item.value };
		}
		return { ...base };
	}

	/**
	 * Dereferences a success action or reusable success action reference against `components.successActions`.
	 *
	 * @param item - Success action or reusable reference.
	 * @param components - Optional `ArazzoComponentsObject`.
	 * @returns Dereferenced `ArazzoSuccessActionObject`.
	 */
	public static dereferenceSuccessAction(
		item: ArazzoSuccessActionObject | ArazzoReusableObject,
		components: ArazzoComponentsObject | undefined,
	): ArazzoSuccessActionObject {
		if (!isArazzoReusableObject(item)) {
			return item;
		}
		const key = item.reference.slice("$components.successActions.".length);
		return {
			...(components?.successActions?.[key] as ArazzoSuccessActionObject),
		};
	}

	/**
	 * Dereferences a failure action or reusable failure action reference against `components.failureActions`.
	 *
	 * @param item - Failure action or reusable reference.
	 * @param components - Optional `ArazzoComponentsObject`.
	 * @returns Dereferenced `ArazzoFailureActionObject`.
	 */
	public static dereferenceFailureAction(
		item: ArazzoFailureActionObject | ArazzoReusableObject,
		components: ArazzoComponentsObject | undefined,
	): ArazzoFailureActionObject {
		if (!isArazzoReusableObject(item)) {
			return item;
		}
		const key = item.reference.slice("$components.failureActions.".length);
		return {
			...(components?.failureActions?.[key] as ArazzoFailureActionObject),
		};
	}

	/**
	 * Collects all JSON Schema definitions from `components.inputs` and `workflow.inputs`.
	 *
	 * @returns Array of `NamedSchemaEntry` items for TypeScript interface generation.
	 */
	private collectInputSchemas(): NamedSchemaEntry[] {
		const entries: NamedSchemaEntry[] = [];
		const seen = new Set<string>();

		if (this.spec.components?.inputs) {
			for (const [name, schema] of Object.entries(
				this.spec.components.inputs,
			)) {
				const typeName = pascalCase(name);
				seen.add(typeName);
				entries.push({ name: typeName, definition: schema });
			}
		}

		for (const wf of this.spec.workflows) {
			if (wf.inputs !== undefined) {
				const resolvedSchema = this.resolveInputSchemaRef(wf.inputs);
				const typeName = `${pascalCase(wf.workflowId)}Inputs`;
				if (!seen.has(typeName)) {
					seen.add(typeName);
					entries.push({ name: typeName, definition: resolvedSchema });
				}
			}
		}

		return entries;
	}

	/**
	 * Resolves `$ref` or `$components.inputs.<name>` references inside a workflow `inputs` schema.
	 *
	 * @param schema - Workflow `inputs` schema or boolean.
	 * @returns Resolved `SwaggerDefinition | boolean`.
	 */
	public resolveInputSchemaRef(
		schema: SwaggerDefinition | boolean,
	): SwaggerDefinition | boolean {
		if (typeof schema === "boolean") return schema;
		const ref = schema.$ref;
		if (typeof ref === "string") {
			const prefix = ref.startsWith("#/components/inputs/")
				? "#/components/inputs/"
				: ref.startsWith("$components.inputs.")
					? "$components.inputs."
					: undefined;
			if (prefix) {
				const key = ref.slice(prefix.length);
				const found = this.spec.components?.inputs?.[key];
				if (found !== undefined) return found;
			}
		}
		return schema;
	}

	/**
	 * Builds the normalized `ArazzoIr` for all workflows and steps.
	 *
	 * @returns Normalized `ArazzoIr`.
	 */
	private buildIr(): ArazzoIr {
		const workflowExecutionOrder = topologicalSortWorkflows(
			this.spec.workflows,
		);
		const workflowsById = new Map<string, ArazzoWorkflowIr>();

		for (const wf of this.spec.workflows) {
			const wfIr = this.buildWorkflowIr(wf);
			workflowsById.set(wf.workflowId, wfIr);
		}

		return {
			spec: this.spec,
			documentUri: this.documentUri,
			workflowsById,
			workflowExecutionOrder,
		};
	}

	/**
	 * Builds the normalized `ArazzoWorkflowIr` for a single workflow.
	 *
	 * @param wf - Raw `ArazzoWorkflowObject`.
	 * @returns Normalized `ArazzoWorkflowIr`.
	 */
	private buildWorkflowIr(wf: ArazzoWorkflowObject): ArazzoWorkflowIr {
		const stepExecutionOrder = topologicalSortSteps(wf.steps);
		const wfParams = (wf.parameters ?? []).map((p) =>
			ArazzoParser.dereferenceParameter(p, this.spec.components),
		);
		const wfSuccess = (wf.successActions ?? []).map((a) =>
			ArazzoParser.dereferenceSuccessAction(a, this.spec.components),
		);
		const wfFailure = (wf.failureActions ?? []).map((a) =>
			ArazzoParser.dereferenceFailureAction(a, this.spec.components),
		);

		const resolvedSteps = wf.steps.map((step) =>
			this.buildStepIr(step, wfParams, wfSuccess, wfFailure),
		);

		return {
			workflow: wf,
			inputTypeName:
				wf.inputs !== undefined
					? `${pascalCase(wf.workflowId)}Inputs`
					: undefined,
			outputTypeName:
				wf.outputs && Object.keys(wf.outputs).length > 0
					? `${pascalCase(wf.workflowId)}Outputs`
					: undefined,
			stepExecutionOrder,
			resolvedSteps,
		};
	}

	/**
	 * Builds the normalized `ArazzoStepIr` for a single step, merging workflow-level defaults.
	 *
	 * @param step - Raw `ArazzoStepObject`.
	 * @param wfParams - Dereferenced workflow-level parameters.
	 * @param wfSuccess - Dereferenced workflow-level success actions.
	 * @param wfFailure - Dereferenced workflow-level failure actions.
	 * @returns Normalized `ArazzoStepIr`.
	 */
	private buildStepIr(
		step: ArazzoStepObject,
		wfParams: ArazzoParameterObject[],
		wfSuccess: ArazzoSuccessActionObject[],
		wfFailure: ArazzoFailureActionObject[],
	): ArazzoStepIr {
		const stepParams = (step.parameters ?? []).map((p) =>
			ArazzoParser.dereferenceParameter(p, this.spec.components),
		);
		const mergedParamsMap = new Map<string, ArazzoParameterObject>();
		for (const p of [...wfParams, ...stepParams]) {
			mergedParamsMap.set(`${p.in ?? "workflow"}:${p.name}`, p);
		}

		const stepSuccess = (step.onSuccess ?? []).map((a) =>
			ArazzoParser.dereferenceSuccessAction(a, this.spec.components),
		);
		const mergedSuccessMap = new Map<string, ArazzoSuccessActionObject>();
		for (const a of [...wfSuccess, ...stepSuccess]) {
			mergedSuccessMap.set(a.name, a);
		}

		const stepFailure = (step.onFailure ?? []).map((a) =>
			ArazzoParser.dereferenceFailureAction(a, this.spec.components),
		);
		const mergedFailureMap = new Map<string, ArazzoFailureActionObject>();
		for (const a of [...wfFailure, ...stepFailure]) {
			mergedFailureMap.set(a.name, a);
		}

		const targetInfo = this.resolveStepTarget(step);

		return {
			step,
			...targetInfo,
			resolvedParameters: Array.from(mergedParamsMap.values()),
			resolvedOnSuccess: Array.from(mergedSuccessMap.values()),
			resolvedOnFailure: Array.from(mergedFailureMap.values()),
		};
	}

	/**
	 * Finds the default sourceDescription name matching a preferred type.
	 *
	 * @param preferredType - Preferred source description type (`"openapi"` or `"asyncapi"`).
	 * @returns Matched source name.
	 */
	private getDefaultSourceName(preferredType: "openapi" | "asyncapi"): string {
		const found = this.spec.sourceDescriptions.find((s) =>
			preferredType === "openapi"
				? !s.type || s.type === "openapi"
				: s.type === "asyncapi",
		);
		return (found ?? this.spec.sourceDescriptions[0])?.name as string;
	}

	/**
	 * Resolves a step's mutually exclusive target (`operationId`, `operationPath`, `channelPath`, or `workflowId`).
	 *
	 * @param step - Step object to inspect.
	 * @returns Target classification and resolved operation/service metadata.
	 */
	private resolveStepTarget(step: ArazzoStepObject): {
		targetKind: ArazzoStepTargetKind;
		sourceName?: string | undefined;
		serviceClassName?: string | undefined;
		serviceMethodName?: string | undefined;
		resolvedOperation?: PathInfo | undefined;
		targetWorkflowId?: string | undefined;
	} {
		if (step.operationId) {
			return this.resolveOperationIdTarget(step.operationId);
		}
		if (step.operationPath) {
			return this.resolveOperationPathTarget(step.operationPath);
		}
		if (step.channelPath) {
			return {
				targetKind: "channelPath",
				sourceName: this.getDefaultSourceName("asyncapi"),
				serviceClassName: "AsyncChannelClient",
				serviceMethodName: step.action === "receive" ? "receive" : "send",
			};
		}
		const wfRef = step.workflowId as string;
		if (wfRef.startsWith("$sourceDescriptions.")) {
			const rest = wfRef.slice("$sourceDescriptions.".length);
			const parts = rest.split(".");
			const srcName = parts[0] as string;
			const targetWfId = (parts[2] ?? parts[1]) as string;
			return {
				targetKind: "workflowId",
				sourceName: srcName,
				targetWorkflowId: targetWfId,
				serviceMethodName: camelCase(targetWfId),
			};
		}
		return {
			targetKind: "workflowId",
			targetWorkflowId: wfRef,
			serviceMethodName: camelCase(wfRef),
		};
	}

	/**
	 * Resolves a step `operationId` (e.g. `"addPet"` or `"$sourceDescriptions.petstore.addPet"`).
	 *
	 * @param opIdExpr - Operation ID string or runtime expression.
	 * @returns Resolved operation target info.
	 */
	private resolveOperationIdTarget(opIdExpr: string): {
		targetKind: "operationId";
		sourceName: string;
		serviceClassName: string;
		serviceMethodName: string;
		resolvedOperation?: PathInfo | undefined;
	} {
		let sourceName = this.getDefaultSourceName("openapi");
		let rawOpId = opIdExpr;

		if (opIdExpr.startsWith("$sourceDescriptions.")) {
			const rest = opIdExpr.slice("$sourceDescriptions.".length);
			const dotIdx = rest.indexOf(".");
			sourceName = rest.slice(0, dotIdx);
			rawOpId = rest.slice(dotIdx + 1);
		}

		const parser = this.openApiSources.get(sourceName);
		const matchedOp = parser?.operations.find(
			(op) =>
				op.operationId === rawOpId || op.methodName === camelCase(rawOpId),
		);

		const tag = matchedOp?.tags?.[0] ?? "Default";
		const serviceClassName = `${pascalCase(tag)}Service`;
		const serviceMethodName = camelCase(
			matchedOp?.operationId ?? matchedOp?.methodName ?? rawOpId,
		);

		return {
			targetKind: "operationId",
			sourceName,
			serviceClassName,
			serviceMethodName,
			resolvedOperation: matchedOp,
		};
	}

	/**
	 * Resolves a step `operationPath` (e.g. `"{$sourceDescriptions.petstore.url}#/paths/~1pet~1{petId}/get"`).
	 *
	 * @param opPathExpr - Operation path expression.
	 * @returns Resolved operationPath target info.
	 */
	private resolveOperationPathTarget(opPathExpr: string): {
		targetKind: "operationPath";
		sourceName: string;
		serviceClassName: string;
		serviceMethodName: string;
		resolvedOperation?: PathInfo | undefined;
	} {
		const srcMatch = /\$sourceDescriptions\.([A-Za-z0-9_-]+)\.url/.exec(
			opPathExpr,
		);
		const sourceName = srcMatch?.[1] ?? this.getDefaultSourceName("openapi");

		const hashIdx = opPathExpr.indexOf("#");
		const fragment = hashIdx >= 0 ? opPathExpr.slice(hashIdx + 1) : opPathExpr;
		const pointerParts = fragment
			.split("/")
			.filter((s) => s.length > 0)
			.map(decodeJsonPointerToken);

		const apiPath =
			pointerParts[0] === "paths" && pointerParts[1]
				? pointerParts[1]
				: `/${pointerParts[0] ?? ""}`;
		const httpMethod = (pointerParts[2] ?? "get").toLowerCase();

		const parser = this.openApiSources.get(sourceName);
		const matchedOp = parser?.operations.find(
			(op) => op.path === apiPath && op.method.toLowerCase() === httpMethod,
		);

		const tag = matchedOp?.tags?.[0] ?? "Default";
		const serviceClassName = `${pascalCase(tag)}Service`;
		const fallbackMethod = camelCase(
			`${httpMethod}_${apiPath.replace(/[^A-Za-z0-9]+/g, "_")}`,
		);
		const serviceMethodName = camelCase(
			matchedOp?.operationId ?? matchedOp?.methodName ?? fallbackMethod,
		);

		return {
			targetKind: "operationPath",
			sourceName,
			serviceClassName,
			serviceMethodName,
			resolvedOperation: matchedOp,
		};
	}
}
