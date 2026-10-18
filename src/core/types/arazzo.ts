/**
 * Arazzo 1.1.0 Specification domain types, intermediate representations (IR), and runtime type guards.
 *
 * @module core/types/arazzo
 */

import type { PathInfo } from "./analysis.js";
import type { OpenApiValue, SwaggerDefinition } from "./openapi.js";

/**
 * Metadata about the Arazzo description (`Info Object`).
 */
export interface ArazzoInfoObject {
	/** A human-readable title of the Arazzo description. */
	title: string;
	/** A short summary of the Arazzo description. */
	summary?: string;
	/** A description of the purpose of the workflows defined in the Arazzo document. */
	description?: string;
	/** The version of the Arazzo document (distinct from the `arazzo` specification version). */
	version: string;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Supported source description document types in Arazzo 1.1.0.
 */
export type ArazzoSourceDescriptionType = "openapi" | "asyncapi" | "arazzo";

/**
 * Describes a source description (such as an OpenAPI, AsyncAPI, or Arazzo document) referenced by one or more workflows (`Source Description Object`).
 */
export interface ArazzoSourceDescriptionObject {
	/** A unique name for identifying the source description (`^[A-Za-z0-9_\-]+$`). */
	name: string;
	/** A URL or relative URI reference to a source description to be used by a workflow. */
	url: string;
	/** The type of the source description (`"openapi"`, `"asyncapi"`, or `"arazzo"`). */
	type?: ArazzoSourceDescriptionType;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Supported parameter locations in Arazzo 1.1.0 (`Parameter Object.in`).
 */
export type ArazzoParameterLocation =
	| "path"
	| "query"
	| "querystring"
	| "header"
	| "cookie";

/**
 * Supported query expression dialects in Arazzo 1.1.0.
 */
export type ArazzoExpressionDialect = "jsonpath" | "xpath" | "jsonpointer";

/**
 * Supported simple criterion types in Arazzo 1.1.0.
 */
export type ArazzoCriterionSimpleType =
	| "simple"
	| "regex"
	| "jsonpath"
	| "xpath"
	| "jsonpointer";

/**
 * Describes the type and version of an expression used within a `Criterion Object` or `Selector Object` (`Criterion Expression Type Object`).
 */
export interface ArazzoExpressionTypeObject {
	/** The type of condition or selector expression to be applied (`"jsonpath"`, `"xpath"`, or `"jsonpointer"`). */
	type: ArazzoExpressionDialect;
	/** A short string representing the version of the expression type being used (e.g., `"rfc9535"`, `"draft-goessner-dispatch-jsonpath-00"`, `"xpath-31"`, `"xpath-20"`, `"xpath-10"`, `"rfc6901"`). */
	version: string;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Structured selector object introduced in Arazzo 1.1.0 for extracting values from structured contexts (`Selector Object`).
 */
export interface ArazzoSelectorObject {
	/** A runtime expression defining the context to which the selector will be applied (e.g. `"$response.body"`, `"$message.payload"`). */
	context: string;
	/** The selector expression string to evaluate against the resolved context (e.g. `"$.items[0].id"`, `"/user/id"`). */
	selector: string;
	/** The dialect or versioned expression type of the selector. */
	type?: ArazzoExpressionDialect | ArazzoExpressionTypeObject;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Describes a single parameter to be passed to an operation or sub-workflow (`Parameter Object`).
 */
export interface ArazzoParameterObject {
	/** The name of the parameter. */
	name: string;
	/** The named location of the parameter (`"path"`, `"query"`, `"querystring"`, `"header"`, or `"cookie"`). Optional for workflow parameters. */
	in?: ArazzoParameterLocation;
	/** The value to pass in the parameter (literal value, runtime expression, or `ArazzoSelectorObject`). */
	value: OpenApiValue | ArazzoSelectorObject;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * A simple object to allow referencing reusable objects contained in the `components` object (`Reusable Object`).
 */
export interface ArazzoReusableObject {
	/** A runtime expression used to reference the desired reusable object (e.g. `"$components.parameters.page"`). */
	reference: string;
	/** An optional override value for a referenced parameter object. */
	value?: OpenApiValue;
}

/**
 * An object used to specify the context, conditions, and condition types that can be used to prove or satisfy assertions (`Criterion Object`).
 */
export interface ArazzoCriterionObject {
	/** A runtime expression used to set the context for the condition to be applied on (e.g. `"$statusCode"`, `"$response.body"`). */
	context?: string;
	/** The condition to apply (e.g. `"$statusCode == 200"`, `"^20[01]$"`, `"$[?(@.count > 0)]"`). */
	condition: string;
	/** The type of condition to be applied (`"simple"`, `"regex"`, `"jsonpath"`, `"xpath"`, or an `ArazzoExpressionTypeObject`). Defaults to `"simple"`. */
	type?: ArazzoCriterionSimpleType | ArazzoExpressionTypeObject;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Supported success action types in Arazzo 1.1.0.
 */
export type ArazzoSuccessActionType = "end" | "goto";

/**
 * A single success action which describes an action to take upon success of a workflow step (`Success Action Object`).
 */
export interface ArazzoSuccessActionObject {
	/** The case-sensitive name of the success action. */
	name: string;
	/** The type of action to take (`"end"` or `"goto"`). */
	type: ArazzoSuccessActionType;
	/** The `workflowId` or `$sourceDescriptions.<name>.workflows.<id>` to transfer to upon success of the step (mutually exclusive with `stepId`). */
	workflowId?: string;
	/** The `stepId` within the current workflow to transfer to upon success of the step (mutually exclusive with `workflowId`). */
	stepId?: string;
	/** A list of parameters to pass to the target workflow or step when `type` is `"goto"`. */
	parameters?: (ArazzoParameterObject | ArazzoReusableObject)[];
	/** A list of assertions to determine if this action SHALL be executed. */
	criteria?: ArazzoCriterionObject[];
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Supported failure action types in Arazzo 1.1.0.
 */
export type ArazzoFailureActionType = "end" | "retry" | "goto";

/**
 * A single failure action which describes an action to take upon failure of a workflow step (`Failure Action Object`).
 */
export interface ArazzoFailureActionObject {
	/** The case-sensitive name of the failure action. */
	name: string;
	/** The type of action to take (`"end"`, `"retry"`, or `"goto"`). */
	type: ArazzoFailureActionType;
	/** The `workflowId` or `$sourceDescriptions.<name>.workflows.<id>` to transfer to upon failure of the step. */
	workflowId?: string;
	/** The `stepId` within the current workflow to transfer to upon failure of the step. */
	stepId?: string;
	/** A list of parameters to pass to the target workflow or step when `type` is `"goto"` or `"retry"`. */
	parameters?: (ArazzoParameterObject | ArazzoReusableObject)[];
	/** A non-negative decimal indicating the seconds to delay after the step failure before another attempt SHALL be made. */
	retryAfter?: number;
	/** A non-negative integer indicating how many attempts to retry the step MAY be attempted before failing the overall step. */
	retryLimit?: number;
	/** A list of assertions to determine if this action SHALL be executed. */
	criteria?: ArazzoCriterionObject[];
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Describes a location within a payload (e.g., a request body) and a value to set within the location (`Payload Replacement Object`).
 */
export interface ArazzoPayloadReplacementObject {
	/** A JSON Pointer, JSONPath, or XPath expression to the target location within the payload. */
	target: string;
	/** The selector dialect used by `target` (Arazzo 1.1.0; defaults to `"jsonpointer"`). */
	targetSelectorType?: ArazzoExpressionDialect | ArazzoExpressionTypeObject;
	/** The value set within the target location (literal, runtime expression, or `ArazzoSelectorObject`). */
	value: OpenApiValue | ArazzoSelectorObject;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * The Request Body object passed to an operation as referenced by a workflow step (`Request Body Object`).
 */
export interface ArazzoRequestBodyObject {
	/** The Content-Type for the request content. */
	contentType?: string;
	/** A value representing the request body payload (literal object/array/primitive or runtime expression string). */
	payload?: OpenApiValue;
	/** A list of locations and values to set within a payload. */
	replacements?: ArazzoPayloadReplacementObject[];
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Supported AsyncAPI step action directions in Arazzo 1.1.0.
 */
export type ArazzoStepActionType = "send" | "receive";

/**
 * Describes a single workflow step which MAY be a call to an API operation, an AsyncAPI channel message, or another workflow (`Step Object`).
 */
export interface ArazzoStepObject {
	/** Unique string to represent the step within the workflow. */
	stepId: string;
	/** A description of the step. */
	description?: string;
	/** The name of an existing, resolvable operation, as defined with a unique `operationId` (mutually exclusive with `operationPath`, `channelPath`, and `workflowId`). */
	operationId?: string;
	/** A relative or absolute URI reference + JSON Pointer to an OAS operation (mutually exclusive with `operationId`, `channelPath`, and `workflowId`). */
	operationPath?: string;
	/** A reference to an AsyncAPI channel path (Arazzo 1.1.0; mutually exclusive with `operationId`, `operationPath`, and `workflowId`). */
	channelPath?: string;
	/** The `workflowId` of another workflow to execute (mutually exclusive with `operationId`, `operationPath`, and `channelPath`). */
	workflowId?: string;
	/** A list of parameters that MUST be passed to an operation or workflow as referenced by `operationId`, `operationPath`, or `workflowId`. */
	parameters?: (ArazzoParameterObject | ArazzoReusableObject)[];
	/** The request body to pass to an operation as referenced by `operationId` or `operationPath`. */
	requestBody?: ArazzoRequestBodyObject;
	/** A list of assertions to determine the success of the step. */
	successCriteria?: ArazzoCriterionObject[];
	/** An array of success action objects that specify what to do upon step success. */
	onSuccess?: (ArazzoSuccessActionObject | ArazzoReusableObject)[];
	/** An array of failure action objects that specify what to do upon step failure. */
	onFailure?: (ArazzoFailureActionObject | ArazzoReusableObject)[];
	/** A map between a friendly name and a dynamic output value defined using a runtime expression or `ArazzoSelectorObject`. */
	outputs?: Record<string, string | ArazzoSelectorObject>;
	/** Per-step execution timeout in milliseconds (Arazzo 1.1.0). */
	timeout?: number;
	/** Correlation ID runtime expression for matching asynchronous messages (Arazzo 1.1.0). */
	correlationId?: string;
	/** Event-driven step action intent (`"send"` or `"receive"`) for AsyncAPI steps (Arazzo 1.1.0). */
	action?: ArazzoStepActionType;
	/** List of `stepId`s within the same workflow that MUST complete before this step executes (Arazzo 1.1.0). */
	dependsOn?: string[];
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Describes the steps to be taken across one or more APIs to achieve an objective (`Workflow Object`).
 */
export interface ArazzoWorkflowObject {
	/** Unique string to represent the workflow. */
	workflowId: string;
	/** A summary of the purpose or objective of the workflow. */
	summary?: string;
	/** A description of the workflow. */
	description?: string;
	/** A JSON Schema 2020-12 object representing the input parameters used by this workflow. */
	inputs?: SwaggerDefinition | boolean;
	/** A list of workflows that MUST be completed before this workflow can be processed. */
	dependsOn?: string[];
	/** An ordered list of steps where each step represents a call to an API operation or to another workflow. */
	steps: ArazzoStepObject[];
	/** A list of success actions that are applicable for all steps described under this workflow. */
	successActions?: (ArazzoSuccessActionObject | ArazzoReusableObject)[];
	/** A list of failure actions that are applicable for all steps described under this workflow. */
	failureActions?: (ArazzoFailureActionObject | ArazzoReusableObject)[];
	/** A map between a friendly name and a dynamic output value defined using a runtime expression or `ArazzoSelectorObject`. */
	outputs?: Record<string, string | ArazzoSelectorObject>;
	/** A list of parameters that are applicable for all steps described under this workflow. */
	parameters?: (ArazzoParameterObject | ArazzoReusableObject)[];
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Holds a set of reusable objects for different aspects of the Arazzo Specification (`Components Object`).
 */
export interface ArazzoComponentsObject {
	/** An object to hold reusable JSON Schema 2020-12 schemas to be referenced from workflow `inputs`. */
	inputs?: Record<string, SwaggerDefinition | boolean>;
	/** An object to hold reusable `ArazzoParameterObject` definitions. */
	parameters?: Record<string, ArazzoParameterObject>;
	/** An object to hold reusable `ArazzoSuccessActionObject` definitions. */
	successActions?: Record<string, ArazzoSuccessActionObject>;
	/** An object to hold reusable `ArazzoFailureActionObject` definitions. */
	failureActions?: Record<string, ArazzoFailureActionObject>;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * This is the root object of the Arazzo 1.1.0 Description (`Arazzo Description`).
 */
export interface ArazzoSpec {
	/** This string MUST be the version number of the Arazzo Specification that the Arazzo Description uses (e.g. `"1.1.0"`). */
	arazzo: string;
	/** Canonical base URI of the Arazzo document for resolving relative references (Arazzo 1.1.0). */
	$self?: string;
	/** Provides metadata about the workflows managed by the Arazzo Description. */
	info: ArazzoInfoObject;
	/** A list of source descriptions (such as an OpenAPI description) that the workflows SHALL apply to. */
	sourceDescriptions: ArazzoSourceDescriptionObject[];
	/** A list of workflows that are provided by the Arazzo Description. */
	workflows: ArazzoWorkflowObject[];
	/** An element to hold various reusable objects for the Arazzo Description. */
	components?: ArazzoComponentsObject;
	/** Specification extension properties (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Discriminated target kind for a normalized Arazzo step in the Intermediate Representation (IR).
 */
export type ArazzoStepTargetKind =
	| "operationId"
	| "operationPath"
	| "channelPath"
	| "workflowId";

/**
 * Normalized Intermediate Representation (IR) for a single Arazzo workflow step.
 */
export interface ArazzoStepIr {
	/** Raw `ArazzoStepObject` from the specification. */
	step: ArazzoStepObject;
	/** Discriminated target kind (`"operationId"`, `"operationPath"`, `"channelPath"`, or `"workflowId"`). */
	targetKind: ArazzoStepTargetKind;
	/** Name of the resolved `sourceDescription` that owns the target operation/channel/workflow. */
	sourceName?: string | undefined;
	/** Mapped TypeScript SDK service class name (e.g. `"PetService"`). */
	serviceClassName?: string | undefined;
	/** Mapped TypeScript SDK service method name (e.g. `"addPet"`). */
	serviceMethodName?: string | undefined;
	/** Resolved OpenAPI operation `PathInfo` when targeting an OpenAPI operation. */
	resolvedOperation?: PathInfo | undefined;
	/** Target sub-workflow ID when `targetKind === "workflowId"`. */
	targetWorkflowId?: string | undefined;
	/** Merged and dereferenced parameters applicable to this step (workflow-level + step-level). */
	resolvedParameters: ArazzoParameterObject[];
	/** Merged and dereferenced success actions applicable to this step (step-level + workflow-level). */
	resolvedOnSuccess: ArazzoSuccessActionObject[];
	/** Merged and dereferenced failure actions applicable to this step (step-level + workflow-level). */
	resolvedOnFailure: ArazzoFailureActionObject[];
}

/**
 * Normalized Intermediate Representation (IR) for a single Arazzo workflow.
 */
export interface ArazzoWorkflowIr {
	/** Raw `ArazzoWorkflowObject` from the specification. */
	workflow: ArazzoWorkflowObject;
	/** Generated PascalCase TypeScript interface name for the workflow's `inputs` schema. */
	inputTypeName?: string | undefined;
	/** Generated PascalCase TypeScript interface name for the workflow's `outputs` map. */
	outputTypeName?: string | undefined;
	/** Topologically sorted `stepId` execution order honoring step-level `dependsOn`. */
	stepExecutionOrder: string[];
	/** Normalized and dereferenced step IR entries. */
	resolvedSteps: ArazzoStepIr[];
}

/**
 * Root Intermediate Representation (IR) for a parsed Arazzo 1.1.0 specification and its linked sources.
 */
export interface ArazzoIr {
	/** Validated root `ArazzoSpec`. */
	spec: ArazzoSpec;
	/** Canonical base document URI of the Arazzo specification. */
	documentUri: string;
	/** Map of `workflowId` to normalized `ArazzoWorkflowIr`. */
	workflowsById: Map<string, ArazzoWorkflowIr>;
	/** Topologically sorted `workflowId` execution order honoring workflow-level `dependsOn`. */
	workflowExecutionOrder: string[];
}

/**
 * Type guard checking whether an unknown value is a valid root `ArazzoSpec` object.
 *
 * @param value - Candidate value to inspect.
 * @returns `true` if `value` is a non-null object containing a string `arazzo` property, an `info` object, `sourceDescriptions` array, and `workflows` array.
 */
export function isArazzoSpec(value: unknown): value is ArazzoSpec {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.arazzo === "string" &&
		candidate.arazzo.trim().length > 0 &&
		typeof candidate.info === "object" &&
		candidate.info !== null &&
		!Array.isArray(candidate.info) &&
		Array.isArray(candidate.sourceDescriptions) &&
		Array.isArray(candidate.workflows)
	);
}

/**
 * Type guard checking whether an unknown value is an `ArazzoReusableObject` (`{ reference: string, value?: ... }`).
 *
 * @param value - Candidate parameter or action entry to inspect.
 * @returns `true` if `value` is an object with a non-empty string `reference` property and no `name` property.
 */
export function isArazzoReusableObject(
	value: unknown,
): value is ArazzoReusableObject {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.reference === "string" &&
		candidate.reference.trim().length > 0 &&
		!("name" in candidate)
	);
}

/**
 * Type guard checking whether an unknown value is an `ArazzoExpressionTypeObject` (`{ type, version }`).
 *
 * @param value - Candidate criterion or selector `type` property value.
 * @returns `true` if `value` is an object with valid string `type` and `version` properties.
 */
export function isArazzoExpressionTypeObject(
	value: unknown,
): value is ArazzoExpressionTypeObject {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		(candidate.type === "jsonpath" ||
			candidate.type === "xpath" ||
			candidate.type === "jsonpointer") &&
		typeof candidate.version === "string" &&
		candidate.version.trim().length > 0
	);
}

/**
 * Type guard checking whether an unknown value is an Arazzo 1.1.0 `ArazzoSelectorObject` (`{ context, selector, type? }`).
 *
 * @param value - Candidate output, parameter, or replacement value.
 * @returns `true` if `value` is an object containing string `context` and `selector` properties.
 */
export function isArazzoSelectorObject(
	value: unknown,
): value is ArazzoSelectorObject {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.context === "string" &&
		candidate.context.trim().length > 0 &&
		typeof candidate.selector === "string" &&
		candidate.selector.trim().length > 0
	);
}
