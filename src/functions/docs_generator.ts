/**
 * Generates API documentation usage snippets in JSON format for Vanilla TypeScript, Angular, React, and Vue clients.
 *
 * @module functions/docs_generator
 */
import type { PathInfo } from "../core/types/analysis.js";
import type {
	GeneratorConfig,
	MediaTypeObject,
	OpenApiValue,
	SwaggerDefinition,
} from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { camelCase, extractPaths, pascalCase } from "./utils.js";

/** Options for generating docs. */
export interface DocsOptions {
	/** Whether to include import statements. */
	imports?: boolean;
	/** Whether to wrap in a function or component. */
	wrapping?: boolean;
}

/** Code snippet parts for a documented operation. */
export interface DocOperationCode {
	/** Import statements */
	imports?: string;
	/** Wrapper start code */
	wrapper_start?: string;
	/** Main code snippet */
	snippet: string;
	/** Wrapper end code */
	wrapper_end?: string;

	/** Additional metadata properties. */
	[key: string]: OpenApiValue;
}

/** Represents a single documented operation. */
export interface DocOperation {
	/** HTTP Method */
	method: string;
	/** URL Path */
	path: string;
	/** Operation ID */
	operationId?: string;
	/** Code snippets */
	code: DocOperationCode;

	/** Additional metadata properties. */
	[key: string]: OpenApiValue;
}

/** Minimal Arazzo workflow descriptor supported by `generateDocsJson`. */
export interface DocWorkflowDescriptor {
	/** Unique workflow identifier. */
	workflowId: string;
	/** Optional JSON Schema describing workflow inputs. */
	inputs?: SwaggerDefinition | boolean;
}

/** Result structure containing endpoint, webhook, and workflow documentation snippets and structured code components. */
export interface DocsJsonResult {
	/** Map of endpoint paths to HTTP methods and generated code snippets. */
	endpoints: Record<string, Record<string, string>>;
	/** Optional map of webhook names to HTTP methods and generated code snippets. */
	webhooks?: Record<string, Record<string, string>>;
	/** Optional map of Arazzo workflow IDs to generated workflow snippets. */
	workflows?: Record<string, string>;
	/** Structured operation code components for dynamic Imports and Wrapping toggling. */
	operations: DocOperation[];

	/** Additional metadata properties. */
	[key: string]: OpenApiValue;
}

/** Represents a language and its operations. */
export interface DocLanguage {
	/** Target language name */
	language: string;
	/** Operations for this language */
	operations: DocOperation[];
}

/**
 * Converts a string to a valid TS identifier.
 *
 * @param name - The original name.
 * @returns The camelCase valid identifier.
 */
function toTsIdentifier(name: string): string {
	return camelCase(name.replace(/[^\w]/g, " "));
}

/**
 * Gets the canonical controller name for an operation.
 *
 * @param op - The path info operation.
 * @returns The controller name.
 */
function getControllerCanonicalName(op: PathInfo): string {
	if (Array.isArray(op.tags) && op.tags[0]) {
		return pascalCase(op.tags[0].toString());
	}

	const firstSegment = op.path.split("/").filter(Boolean)[0];

	return firstSegment ? pascalCase(firstSegment) : "Default";
}

/**
 * Determines the method name for a given operation.
 *
 * @param op - The parsed path info operation.
 * @param config - The generator configuration.
 * @returns The suggested TS method name.
 */
function getMethodName(op: PathInfo, config: GeneratorConfig): string {
	let suggestedName = op.methodName;

	if (config.options?.customizeMethodName && op.operationId) {
		suggestedName = config.options.customizeMethodName(op.operationId);
	}

	if (!suggestedName) {
		if (op.operationId) {
			suggestedName = toTsIdentifier(op.operationId);
		} else {
			suggestedName = toTsIdentifier(`${op.method.toLowerCase()}_${op.path}`);
		}
	} else if (
		suggestedName.includes("-") ||
		!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(suggestedName)
	) {
		suggestedName = toTsIdentifier(suggestedName);
	}

	return suggestedName;
}

/**
 * Formats a sample TypeScript literal from an OpenAPI schema or explicit example value.
 *
 * @param schema - Optional OpenAPI schema definition.
 * @param explicitExample - Optional explicit parameter example value.
 * @returns TypeScript literal expression string.
 */
export function formatSampleSchemaValue(
	schema?: SwaggerDefinition,
	explicitExample?: OpenApiValue,
): string {
	if (explicitExample !== undefined) {
		return JSON.stringify(explicitExample);
	}
	if (schema?.example !== undefined) {
		return JSON.stringify(schema.example);
	}
	if (schema?.default !== undefined) {
		return JSON.stringify(schema.default);
	}
	if (schema?.type === "integer" || schema?.type === "number") {
		return "1";
	}
	if (schema?.type === "boolean") {
		return "true";
	}
	if (schema?.type === "array") {
		return "[]";
	}
	if (schema?.type === "object") {
		return "{}";
	}
	return "'example'";
}

/**
 * Builds a realistic TypeScript argument object literal from an operation's `parameters` and `requestBody`.
 *
 * @param op - Analyzed OpenAPI `PathInfo` operation.
 * @returns Formatted argument object literal (e.g. `"{ id: 'example', body: { name: 'example' } }"`) or `""` when no arguments exist.
 */
export function buildSampleArgs(op: PathInfo): string {
	const entries: string[] = [];

	for (const param of op.parameters ?? []) {
		if ("name" in param && param.name) {
			const key = camelCase(param.name);
			const schema =
				param.schema && typeof param.schema === "object"
					? (param.schema as SwaggerDefinition)
					: undefined;
			entries.push(`${key}: ${formatSampleSchemaValue(schema, param.example)}`);
		}
	}

	if (op.requestBody) {
		let bodyLiteral = "{}";
		if ("content" in op.requestBody && op.requestBody.content) {
			const firstMediaType = Object.values(op.requestBody.content)[0] as
				| MediaTypeObject
				| undefined;
			const bodySchema =
				firstMediaType?.schema && typeof firstMediaType.schema === "object"
					? (firstMediaType.schema as SwaggerDefinition)
					: undefined;
			if (
				bodySchema?.properties &&
				Object.keys(bodySchema.properties).length > 0
			) {
				const propEntries = Object.entries(bodySchema.properties).map(
					([propName, propDef]) =>
						`${camelCase(propName)}: ${formatSampleSchemaValue(typeof propDef === "object" ? propDef : undefined)}`,
				);
				bodyLiteral = `{ ${propEntries.join(", ")} }`;
			}
		}
		entries.push(`body: ${bodyLiteral}`);
	}

	return entries.length > 0 ? `{ ${entries.join(", ")} }` : "";
}

/**
 * Builds a realistic TypeScript argument object literal from an Arazzo workflow `inputs` schema.
 *
 * @param inputs - Optional Arazzo workflow `inputs` JSON Schema.
 * @returns Formatted argument object literal or `""` when no input properties are defined.
 */
export function buildWorkflowSampleArgs(
	inputs?: SwaggerDefinition | boolean,
): string {
	if (
		inputs &&
		typeof inputs === "object" &&
		inputs.properties &&
		Object.keys(inputs.properties).length > 0
	) {
		const propEntries = Object.entries(inputs.properties).map(
			([propName, propDef]) =>
				`${camelCase(propName)}: ${formatSampleSchemaValue(typeof propDef === "object" ? propDef : undefined)}`,
		);
		return `{ ${propEntries.join(", ")} }`;
	}
	return "";
}

/**
 * Builds both the assembled code string and structured 4-part `DocOperationCode` for an OpenAPI operation or webhook.
 *
 * @param op - Analyzed OpenAPI `PathInfo` operation.
 * @param config - Active generator configuration.
 * @param usedNames - Set tracking used `<Controller>_<methodName>` identifiers for deduplication.
 * @param useImports - Whether `finalCode` includes import statements.
 * @param useWrapping - Whether `finalCode` includes component/function wrapping.
 * @returns Assembled `finalCode` and structured `DocOperationCode`.
 */
function buildOperationSnippet(
	op: PathInfo,
	config: GeneratorConfig,
	usedNames: Set<string>,
	useImports: boolean,
	useWrapping: boolean,
): { finalCode: string; structuredCode: DocOperationCode } {
	const controller = getControllerCanonicalName(op);
	const serviceName = `${controller}Service`;
	const clientClassName = `${controller}Client`;
	const controllerFile = controller.toLowerCase();

	const suggestedName = getMethodName(op, config);
	let finalName = suggestedName;
	let counter = 2;
	while (usedNames.has(`${controller}_${finalName}`)) {
		finalName = `${suggestedName}${counter++}`;
	}
	usedNames.add(`${controller}_${finalName}`);
	const methodName = finalName;

	const args = buildSampleArgs(op);
	const fwLower = (config.options?.framework || "").toLowerCase();
	const isReact = fwLower === "react";
	const isVue = fwLower === "vue";
	const isVanilla =
		fwLower === "vanilla" ||
		fwLower === "vanilla js" ||
		fwLower === "vanillajs";

	let imports: string;
	let wrapper_start: string;
	let snippet: string;
	let wrapper_end: string;
	let unwrappedBody: string;

	if (isVanilla) {
		imports = `import { ${clientClassName} } from './api/services/${controllerFile}.client';`;
		wrapper_start = `export async function execute() {`;
		snippet = `    const client = new ${clientClassName}();
    const response = await client.${methodName}(${args});
    console.log(response);`;
		wrapper_end = `}`;
		unwrappedBody = `const client = new ${clientClassName}();
const response = await client.${methodName}(${args});
console.log(response);`;
	} else if (isReact) {
		imports = `import { use${serviceName} } from './api/services/${controllerFile}.service';`;
		wrapper_start = `export function ExampleComponent() {
    const service = use${serviceName}();
    async function execute() {`;
		snippet = `        const response = await service.${methodName}(${args});
        console.log(response);`;
		wrapper_end = `    }
}`;
		unwrappedBody = `const response = await service.${methodName}(${args});
console.log(response);`;
	} else if (isVue) {
		imports = `import { use${serviceName} } from './api/services/${controllerFile}.service';`;
		wrapper_start = `<script setup>
const service = use${serviceName}();
async function execute() {`;
		snippet = `    const response = await service.${methodName}(${args});
    console.log(response);`;
		wrapper_end = `}
</script>`;
		unwrappedBody = `const response = await service.${methodName}(${args});
console.log(response);`;
	} else {
		imports = `import { Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ${serviceName} } from './api/services/${controllerFile}.service';`;
		wrapper_start = `@Component({ selector: 'app-example', template: '' })
export class ExampleComponent {
    private readonly service = inject(${serviceName});
    async execute() {`;
		snippet = `        const response = await firstValueFrom(this.service.${methodName}(${args}));
        console.log(response);`;
		wrapper_end = `    }
}`;
		unwrappedBody = `const response = await firstValueFrom(this.service.${methodName}(${args}));
console.log(response);`;
	}

	const body = useWrapping
		? `${wrapper_start}
${snippet}
${wrapper_end}`
		: unwrappedBody;
	const finalCode = useImports
		? `${imports}

${body}`
		: body;

	return {
		finalCode,
		structuredCode: {
			imports,
			wrapper_start,
			snippet,
			wrapper_end,
		},
	};
}

/**
 * Generates API documentation usage snippets in JSON format.
 *
 * @param parser - The parsed OpenAPI/Arazzo specification container.
 * @param config - The current generator configuration.
 * @param options - Options for code snippet format.
 * @returns Documentation JSON containing `endpoints`, optional `webhooks` and `workflows`, and structured `operations`.
 */
export function generateDocsJson(
	parser: Pick<SwaggerParser, "operations"> &
		Partial<Pick<SwaggerParser, "webhooks" | "spec">> & {
			/** Optional Arazzo workflow definitions. */
			workflows?: DocWorkflowDescriptor[];
		},
	config: GeneratorConfig,
	options: DocsOptions = {},
): DocsJsonResult {
	const useImports = options.imports ?? false;
	const useWrapping = options.wrapping ?? false;

	const endpoints: Record<string, Record<string, string>> = {};
	const webhooks: Record<string, Record<string, string>> = {};
	const workflows: Record<string, string> = {};
	const operations: DocOperation[] = [];
	const usedNames = new Set<string>();

	for (const op of parser.operations) {
		const { finalCode, structuredCode } = buildOperationSnippet(
			op,
			config,
			usedNames,
			useImports,
			useWrapping,
		);
		const method = op.method.toLowerCase();
		const path = op.path;

		if (!endpoints[path]) {
			endpoints[path] = {};
		}
		endpoints[path][method] = finalCode;
		operations.push({
			method: op.method.toUpperCase(),
			path,
			...(op.operationId ? { operationId: op.operationId } : {}),
			code: structuredCode,
		});
	}

	const webhookOps: PathInfo[] =
		parser.webhooks && parser.webhooks.length > 0
			? parser.webhooks
			: parser.spec?.webhooks
				? extractPaths(parser.spec.webhooks)
				: [];

	for (const whOp of webhookOps) {
		const { finalCode, structuredCode } = buildOperationSnippet(
			whOp,
			config,
			usedNames,
			useImports,
			useWrapping,
		);
		const method = whOp.method.toLowerCase();
		const whName = whOp.path;

		if (!webhooks[whName]) {
			webhooks[whName] = {};
		}
		webhooks[whName][method] = finalCode;
		operations.push({
			method: whOp.method.toUpperCase(),
			path: whName,
			...(whOp.operationId ? { operationId: whOp.operationId } : {}),
			code: structuredCode,
		});
	}

	const rawWorkflows: DocWorkflowDescriptor[] =
		parser.workflows ??
		(parser.spec as { workflows?: DocWorkflowDescriptor[] } | undefined)
			?.workflows ??
		[];

	for (const wf of rawWorkflows) {
		const wfId = wf.workflowId;
		const methodName = camelCase(wfId);
		const args = buildWorkflowSampleArgs(wf.inputs);
		const imports = `import { WorkflowOrchestrator } from './workflows/index';`;
		const wrapper_start = `export async function execute() {`;
		const snippet = `    const orchestrator = new WorkflowOrchestrator();
    const outputs = await orchestrator.${methodName}(${args});
    console.log(outputs);`;
		const wrapper_end = `}`;
		const unwrappedBody = `const orchestrator = new WorkflowOrchestrator();
const outputs = await orchestrator.${methodName}(${args});
console.log(outputs);`;
		const body = useWrapping
			? `${wrapper_start}
${snippet}
${wrapper_end}`
			: unwrappedBody;
		const finalCode = useImports
			? `${imports}

${body}`
			: body;

		workflows[wfId] = finalCode;
		operations.push({
			method: "WORKFLOW",
			path: `/workflows/${wfId}`,
			operationId: wfId,
			code: {
				imports,
				wrapper_start,
				snippet,
				wrapper_end,
			},
		});
	}

	return {
		endpoints,
		...(Object.keys(webhooks).length > 0 ? { webhooks } : {}),
		...(Object.keys(workflows).length > 0 ? { workflows } : {}),
		operations,
	};
}
