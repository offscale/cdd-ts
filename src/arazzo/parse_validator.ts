/**
 * Validates Arazzo 1.1.0 (and 1.0.x) Specification documents according to the OpenAPI Initiative Arazzo specification.
 *
 * @module arazzo/parse_validator
 */
import {
	topologicalSortSteps,
	topologicalSortWorkflows,
} from "../core/arazzo-engine.js";
import {
	type ArazzoComponentsObject,
	type ArazzoCriterionObject,
	type ArazzoFailureActionObject,
	type ArazzoParameterObject,
	type ArazzoReusableObject,
	type ArazzoSpec,
	type ArazzoStepObject,
	type ArazzoSuccessActionObject,
	type ArazzoWorkflowObject,
	isArazzoExpressionTypeObject,
	isArazzoReusableObject,
	isArazzoSelectorObject,
	isArazzoSpec,
} from "../core/types/index.js";

/**
 * Custom error class thrown when an Arazzo document fails structural or semantic validation.
 */
export class ArazzoValidationError extends Error {
	/** JSON Pointer or property path where validation failed. */
	public readonly path: string;

	/**
	 * Creates a new `ArazzoValidationError`.
	 *
	 * @param message - Human-readable validation failure description.
	 * @param path - Location path in the Arazzo document where the violation occurred.
	 */
	public constructor(message: string, path?: string) {
		const resolvedPath = path ?? "#";
		super(`${message} (at ${resolvedPath})`);
		this.name = "ArazzoValidationError";
		this.path = resolvedPath;
	}
}

const VALID_SOURCE_TYPES = new Set(["openapi", "asyncapi", "arazzo"]);
const VALID_PARAM_LOCATIONS = new Set([
	"path",
	"query",
	"querystring",
	"header",
	"cookie",
]);
const VALID_SIMPLE_CRITERION_TYPES = new Set([
	"simple",
	"regex",
	"jsonpath",
	"xpath",
]);

/**
 * Validates a single `ArazzoCriterionObject`.
 *
 * @param criterion - Criterion object to validate.
 * @param path - Diagnostic path in the Arazzo document.
 * @throws {ArazzoValidationError} When the criterion is malformed.
 */
function validateCriterion(
	criterion: ArazzoCriterionObject,
	path: string,
): void {
	if (
		typeof criterion.condition !== "string" ||
		criterion.condition.trim().length === 0
	) {
		throw new ArazzoValidationError(
			"Criterion Object MUST have a non-empty string 'condition'.",
			`${path}/condition`,
		);
	}
	if (criterion.type !== undefined) {
		if (typeof criterion.type === "string") {
			if (!VALID_SIMPLE_CRITERION_TYPES.has(criterion.type)) {
				throw new ArazzoValidationError(
					`Invalid Criterion type '${criterion.type}'.`,
					`${path}/type`,
				);
			}
		} else if (!isArazzoExpressionTypeObject(criterion.type)) {
			throw new ArazzoValidationError(
				"Invalid Criterion ExpressionTypeObject.",
				`${path}/type`,
			);
		}
	}
}

/**
 * Validates a parameter or reusable parameter reference against `components`.
 *
 * @param param - Parameter or reusable reference.
 * @param components - Root `components` object, if defined.
 * @param path - Diagnostic path in the Arazzo document.
 * @throws {ArazzoValidationError} When the parameter or reusable reference is invalid.
 */
function validateParameterOrReusable(
	param: ArazzoParameterObject | ArazzoReusableObject,
	components: ArazzoComponentsObject | undefined,
	path: string,
): void {
	if (isArazzoReusableObject(param)) {
		if (!param.reference.startsWith("$components.parameters.")) {
			throw new ArazzoValidationError(
				`Invalid parameter reusable reference '${param.reference}'. Expected '$components.parameters.<name>'.`,
				`${path}/reference`,
			);
		}
		const key = param.reference.slice("$components.parameters.".length);
		if (!components?.parameters || !(key in components.parameters)) {
			throw new ArazzoValidationError(
				`Unresolved reusable parameter reference '${param.reference}'.`,
				`${path}/reference`,
			);
		}
		return;
	}

	if (typeof param.name !== "string" || param.name.trim().length === 0) {
		throw new ArazzoValidationError(
			"Parameter Object MUST have a non-empty 'name'.",
			`${path}/name`,
		);
	}
	if (param.in !== undefined && !VALID_PARAM_LOCATIONS.has(param.in)) {
		throw new ArazzoValidationError(
			`Invalid parameter 'in' location '${param.in}'.`,
			`${path}/in`,
		);
	}
	if (param.value === undefined) {
		throw new ArazzoValidationError(
			"Parameter Object MUST define a 'value'.",
			`${path}/value`,
		);
	}
}

/**
 * Validates a success action or reusable success action reference.
 *
 * @param action - Success action or reusable reference.
 * @param components - Root `components` object, if defined.
 * @param stepIds - Valid `stepId`s in the current workflow.
 * @param path - Diagnostic path in the Arazzo document.
 * @throws {ArazzoValidationError} When the success action is invalid.
 */
function validateSuccessAction(
	action: ArazzoSuccessActionObject | ArazzoReusableObject,
	components: ArazzoComponentsObject | undefined,
	stepIds: Set<string>,
	path: string,
): string {
	let resolved: ArazzoSuccessActionObject;
	if (isArazzoReusableObject(action)) {
		if (!action.reference.startsWith("$components.successActions.")) {
			throw new ArazzoValidationError(
				`Invalid successAction reference '${action.reference}'.`,
				`${path}/reference`,
			);
		}
		const key = action.reference.slice("$components.successActions.".length);
		const found = components?.successActions?.[key];
		if (!found) {
			throw new ArazzoValidationError(
				`Unresolved reusable successAction '${action.reference}'.`,
				`${path}/reference`,
			);
		}
		resolved = found;
	} else {
		resolved = action;
	}

	if (typeof resolved.name !== "string" || resolved.name.trim().length === 0) {
		throw new ArazzoValidationError(
			"Success Action MUST have a non-empty 'name'.",
			`${path}/name`,
		);
	}
	if (resolved.type !== "end" && resolved.type !== "goto") {
		throw new ArazzoValidationError(
			`Invalid Success Action type '${String(resolved.type)}'.`,
			`${path}/type`,
		);
	}
	if (resolved.type === "goto") {
		const hasStep = Boolean(resolved.stepId);
		const hasWf = Boolean(resolved.workflowId);
		if ((hasStep && hasWf) || (!hasStep && !hasWf)) {
			throw new ArazzoValidationError(
				"Success Action of type 'goto' MUST specify exactly one of 'stepId' or 'workflowId'.",
				path,
			);
		}
		if (resolved.stepId && stepIds.size > 0 && !stepIds.has(resolved.stepId)) {
			throw new ArazzoValidationError(
				`Success Action 'goto' references unknown stepId '${resolved.stepId}'.`,
				`${path}/stepId`,
			);
		}
	}
	if (resolved.criteria) {
		resolved.criteria.forEach((c, idx) =>
			validateCriterion(c, `${path}/criteria/${idx}`),
		);
	}
	return resolved.name;
}

/**
 * Validates a failure action or reusable failure action reference.
 *
 * @param action - Failure action or reusable reference.
 * @param components - Root `components` object, if defined.
 * @param stepIds - Valid `stepId`s in the current workflow.
 * @param path - Diagnostic path in the Arazzo document.
 * @throws {ArazzoValidationError} When the failure action is invalid.
 */
function validateFailureAction(
	action: ArazzoFailureActionObject | ArazzoReusableObject,
	components: ArazzoComponentsObject | undefined,
	stepIds: Set<string>,
	path: string,
): string {
	let resolved: ArazzoFailureActionObject;
	if (isArazzoReusableObject(action)) {
		if (!action.reference.startsWith("$components.failureActions.")) {
			throw new ArazzoValidationError(
				`Invalid failureAction reference '${action.reference}'.`,
				`${path}/reference`,
			);
		}
		const key = action.reference.slice("$components.failureActions.".length);
		const found = components?.failureActions?.[key];
		if (!found) {
			throw new ArazzoValidationError(
				`Unresolved reusable failureAction '${action.reference}'.`,
				`${path}/reference`,
			);
		}
		resolved = found;
	} else {
		resolved = action;
	}

	if (typeof resolved.name !== "string" || resolved.name.trim().length === 0) {
		throw new ArazzoValidationError(
			"Failure Action MUST have a non-empty 'name'.",
			`${path}/name`,
		);
	}
	if (
		resolved.type !== "end" &&
		resolved.type !== "retry" &&
		resolved.type !== "goto"
	) {
		throw new ArazzoValidationError(
			`Invalid Failure Action type '${String(resolved.type)}'.`,
			`${path}/type`,
		);
	}
	if (resolved.type === "goto") {
		const hasStep = Boolean(resolved.stepId);
		const hasWf = Boolean(resolved.workflowId);
		if ((hasStep && hasWf) || (!hasStep && !hasWf)) {
			throw new ArazzoValidationError(
				"Failure Action of type 'goto' MUST specify exactly one of 'stepId' or 'workflowId'.",
				path,
			);
		}
		if (resolved.stepId && stepIds.size > 0 && !stepIds.has(resolved.stepId)) {
			throw new ArazzoValidationError(
				`Failure Action 'goto' references unknown stepId '${resolved.stepId}'.`,
				`${path}/stepId`,
			);
		}
	}
	if (resolved.retryAfter !== undefined && resolved.retryAfter < 0) {
		throw new ArazzoValidationError(
			"Failure Action 'retryAfter' MUST be a non-negative number.",
			`${path}/retryAfter`,
		);
	}
	if (resolved.retryLimit !== undefined && resolved.retryLimit < 0) {
		throw new ArazzoValidationError(
			"Failure Action 'retryLimit' MUST be a non-negative integer.",
			`${path}/retryLimit`,
		);
	}
	if (resolved.criteria) {
		resolved.criteria.forEach((c, idx) =>
			validateCriterion(c, `${path}/criteria/${idx}`),
		);
	}
	return resolved.name;
}

/**
 * Validates a single `ArazzoStepObject`.
 *
 * @param step - Step object to validate.
 * @param components - Root `components` object, if defined.
 * @param stepIds - Set of all `stepId`s in the parent workflow.
 * @param path - Diagnostic path in the Arazzo document.
 * @throws {ArazzoValidationError} When the step fails validation.
 */
function validateStep(
	step: ArazzoStepObject,
	components: ArazzoComponentsObject | undefined,
	stepIds: Set<string>,
	path: string,
): void {
	if (typeof step.stepId !== "string" || step.stepId.trim().length === 0) {
		throw new ArazzoValidationError(
			"Step Object MUST have a non-empty 'stepId'.",
			`${path}/stepId`,
		);
	}

	const targets = [
		step.operationId,
		step.operationPath,
		step.channelPath,
		step.workflowId,
	].filter((t) => typeof t === "string" && t.trim().length > 0);

	if (targets.length !== 1) {
		throw new ArazzoValidationError(
			`Step '${step.stepId}' MUST specify mutually exclusively exactly one of 'operationId', 'operationPath', 'channelPath', or 'workflowId' (found ${targets.length}).`,
			path,
		);
	}

	if (step.timeout !== undefined && step.timeout <= 0) {
		throw new ArazzoValidationError(
			`Step '${step.stepId}' timeout MUST be a positive number.`,
			`${path}/timeout`,
		);
	}

	if (
		step.action !== undefined &&
		step.action !== "send" &&
		step.action !== "receive"
	) {
		throw new ArazzoValidationError(
			`Step '${step.stepId}' action MUST be 'send' or 'receive'.`,
			`${path}/action`,
		);
	}

	if (step.parameters) {
		step.parameters.forEach((p, idx) =>
			validateParameterOrReusable(p, components, `${path}/parameters/${idx}`),
		);
	}

	if (step.successCriteria) {
		step.successCriteria.forEach((c, idx) =>
			validateCriterion(c, `${path}/successCriteria/${idx}`),
		);
	}

	if (step.onSuccess) {
		const names = new Set<string>();
		step.onSuccess.forEach((act, idx) => {
			const name = validateSuccessAction(
				act,
				components,
				stepIds,
				`${path}/onSuccess/${idx}`,
			);
			if (names.has(name)) {
				throw new ArazzoValidationError(
					`Duplicate onSuccess action name '${name}' in step '${step.stepId}'.`,
					`${path}/onSuccess/${idx}`,
				);
			}
			names.add(name);
		});
	}

	if (step.onFailure) {
		const names = new Set<string>();
		step.onFailure.forEach((act, idx) => {
			const name = validateFailureAction(
				act,
				components,
				stepIds,
				`${path}/onFailure/${idx}`,
			);
			if (names.has(name)) {
				throw new ArazzoValidationError(
					`Duplicate onFailure action name '${name}' in step '${step.stepId}'.`,
					`${path}/onFailure/${idx}`,
				);
			}
			names.add(name);
		});
	}

	if (step.outputs) {
		for (const [outKey, outVal] of Object.entries(step.outputs)) {
			if (typeof outVal === "string") {
				if (outVal.trim().length === 0) {
					throw new ArazzoValidationError(
						`Step output '${outKey}' expression MUST NOT be empty.`,
						`${path}/outputs/${outKey}`,
					);
				}
			} else if (!isArazzoSelectorObject(outVal)) {
				throw new ArazzoValidationError(
					`Step output '${outKey}' MUST be a runtime expression string or SelectorObject.`,
					`${path}/outputs/${outKey}`,
				);
			}
		}
	}
}

/**
 * Validates a single `ArazzoWorkflowObject`.
 *
 * @param workflow - Workflow object to validate.
 * @param components - Root `components` object, if defined.
 * @param path - Diagnostic path in the Arazzo document.
 * @throws {ArazzoValidationError} When the workflow fails validation.
 */
function validateWorkflow(
	workflow: ArazzoWorkflowObject,
	components: ArazzoComponentsObject | undefined,
	path: string,
): void {
	if (
		typeof workflow.workflowId !== "string" ||
		workflow.workflowId.trim().length === 0
	) {
		throw new ArazzoValidationError(
			"Workflow Object MUST have a non-empty 'workflowId'.",
			`${path}/workflowId`,
		);
	}
	if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
		throw new ArazzoValidationError(
			`Workflow '${workflow.workflowId}' MUST contain at least one step.`,
			`${path}/steps`,
		);
	}

	const stepIds = new Set<string>();
	for (let i = 0; i < workflow.steps.length; i++) {
		const step = workflow.steps[i] as ArazzoStepObject;
		if (stepIds.has(step.stepId)) {
			throw new ArazzoValidationError(
				`Duplicate stepId '${step.stepId}' in workflow '${workflow.workflowId}'.`,
				`${path}/steps/${i}/stepId`,
			);
		}
		if (typeof step.stepId === "string" && step.stepId.trim().length > 0) {
			stepIds.add(step.stepId);
		}
	}

	workflow.steps.forEach((step, idx) =>
		validateStep(step, components, stepIds, `${path}/steps/${idx}`),
	);

	try {
		topologicalSortSteps(workflow.steps);
	} catch (err) {
		throw new ArazzoValidationError((err as Error).message, `${path}/steps`);
	}

	if (workflow.parameters) {
		workflow.parameters.forEach((p, idx) =>
			validateParameterOrReusable(p, components, `${path}/parameters/${idx}`),
		);
	}

	if (workflow.successActions) {
		workflow.successActions.forEach((act, idx) =>
			validateSuccessAction(
				act,
				components,
				stepIds,
				`${path}/successActions/${idx}`,
			),
		);
	}

	if (workflow.failureActions) {
		workflow.failureActions.forEach((act, idx) =>
			validateFailureAction(
				act,
				components,
				stepIds,
				`${path}/failureActions/${idx}`,
			),
		);
	}
}

/**
 * Validates an unknown input value as a compliant Arazzo 1.1.0 / 1.0.x `ArazzoSpec`.
 *
 * @param spec - Candidate Arazzo specification object.
 * @throws {ArazzoValidationError} When any structural or semantic constraint is violated.
 */
export function validateArazzoSpec(spec: unknown): asserts spec is ArazzoSpec {
	if (!isArazzoSpec(spec)) {
		throw new ArazzoValidationError(
			"Invalid Arazzo document: must be an object with 'arazzo', 'info', 'sourceDescriptions', and 'workflows'.",
			"#",
		);
	}

	if (!/^1\.[01]\.\d+(-.+)?$/.test(spec.arazzo)) {
		throw new ArazzoValidationError(
			`Unsupported Arazzo version '${spec.arazzo}'. Expected 1.0.x or 1.1.x.`,
			"#/arazzo",
		);
	}

	if (
		typeof spec.info.title !== "string" ||
		spec.info.title.trim().length === 0
	) {
		throw new ArazzoValidationError(
			"Arazzo Info Object MUST have a non-empty 'title'.",
			"#/info/title",
		);
	}

	if (
		typeof spec.info.version !== "string" ||
		spec.info.version.trim().length === 0
	) {
		throw new ArazzoValidationError(
			"Arazzo Info Object MUST have a non-empty 'version'.",
			"#/info/version",
		);
	}

	if (spec.sourceDescriptions.length === 0) {
		throw new ArazzoValidationError(
			"Arazzo 'sourceDescriptions' MUST contain at least one Source Description Object.",
			"#/sourceDescriptions",
		);
	}

	const sourceNames = new Set<string>();
	spec.sourceDescriptions.forEach((src, idx) => {
		const srcPath = `#/sourceDescriptions/${idx}`;
		if (typeof src.name !== "string" || !/^[A-Za-z0-9_-]+$/.test(src.name)) {
			throw new ArazzoValidationError(
				`Invalid sourceDescription name '${String(src.name)}'. Must match ^[A-Za-z0-9_-]+$.`,
				`${srcPath}/name`,
			);
		}
		if (sourceNames.has(src.name)) {
			throw new ArazzoValidationError(
				`Duplicate sourceDescription name '${src.name}'.`,
				`${srcPath}/name`,
			);
		}
		sourceNames.add(src.name);

		if (typeof src.url !== "string" || src.url.trim().length === 0) {
			throw new ArazzoValidationError(
				`sourceDescription '${src.name}' MUST have a non-empty 'url'.`,
				`${srcPath}/url`,
			);
		}
		if (src.type !== undefined && !VALID_SOURCE_TYPES.has(src.type)) {
			throw new ArazzoValidationError(
				`Invalid sourceDescription type '${src.type}'.`,
				`${srcPath}/type`,
			);
		}
	});

	if (spec.workflows.length === 0) {
		throw new ArazzoValidationError(
			"Arazzo 'workflows' MUST contain at least one Workflow Object.",
			"#/workflows",
		);
	}

	const workflowIds = new Set<string>();
	spec.workflows.forEach((wf, idx) => {
		const wfPath = `#/workflows/${idx}`;
		if (workflowIds.has(wf.workflowId)) {
			throw new ArazzoValidationError(
				`Duplicate workflowId '${wf.workflowId}'.`,
				`${wfPath}/workflowId`,
			);
		}
		workflowIds.add(wf.workflowId);
		validateWorkflow(wf, spec.components, wfPath);
	});

	try {
		topologicalSortWorkflows(spec.workflows);
	} catch (err) {
		throw new ArazzoValidationError((err as Error).message, "#/workflows");
	}
}
