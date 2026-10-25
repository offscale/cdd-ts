/**
 * Shared base class for Promise-based HTTP service method generators (Fetch, Axios, Node).
 *
 * @module functions/emit_service_method
 */

import type { ClassDeclaration } from "ts-morph";
import type { GeneratorConfig, PathInfo } from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { buildOperationMethodDocs } from "./emit_operation_jsdoc.js";
import { ServiceMethodAnalyzer } from "./parse_analyzer.js";
import type { ParamSerialization, ServiceMethodModel } from "./types.js";
import { pascalCase } from "./utils.js";

/**
 * Abstract base class for generating Promise-based HTTP service methods across Fetch, Axios, and Node implementations.
 */
export abstract class AbstractHttpServiceMethodGenerator {
	/** Analyzer that transforms OpenAPI `PathInfo` operations into `ServiceMethodModel` IR. */
	protected readonly analyzer: ServiceMethodAnalyzer;

	/**
	 * Creates a new `AbstractHttpServiceMethodGenerator`.
	 *
	 * @param config - The global code generator settings.
	 * @param parser - The active OpenAPI parser.
	 */
	constructor(
		config: GeneratorConfig,
		readonly parser: SwaggerParser,
	) {
		this.analyzer = new ServiceMethodAnalyzer(config, parser);
	}

	/**
	 * Returns the transport-specific base options type (e.g. `RequestInit`, `AxiosRequestConfig`, `import('node:http').RequestOptions`).
	 *
	 * @returns The TypeScript type expression for transport options.
	 */
	protected abstract getTransportOptionsType(): string;

	/**
	 * Emits the transport-specific method body statements for the analyzed operation.
	 *
	 * @param model - The analyzed service method model.
	 * @param returnType - The computed return type union string.
	 * @returns The TypeScript method body statements.
	 */
	protected abstract emitMethodBody(
		model: ServiceMethodModel,
		returnType: string,
	): string;

	/**
	 * Computes the distinct return type union for a `ServiceMethodModel`.
	 *
	 * @param model - The analyzed service method model.
	 * @returns The TypeScript return type string.
	 */
	protected computeReturnType(model: ServiceMethodModel): string {
		const distinctTypes = [
			...new Set(model.responseVariants.map((v) => v.type)),
		];
		return distinctTypes.length > 1
			? distinctTypes.join(" | ")
			: model.responseType;
	}

	/**
	 * Interpolates serialized path parameters into the operation's URL template.
	 *
	 * @param model - The analyzed service method model.
	 * @returns The interpolated URL template string.
	 */
	protected buildInterpolatedUrlTemplate(model: ServiceMethodModel): string {
		let urlTemplate = model.urlTemplate;
		const dollar = String.fromCharCode(36);
		model.pathParams.forEach((p: ParamSerialization) => {
			const serializeCall = `ParameterSerializer.serializePathParam('${p.originalName}', ${p.paramName}, '${p.style}', ${p.explode}, ${p.allowReserved})`;
			urlTemplate = urlTemplate.replace(
				`{${p.originalName}}`,
				`${dollar}{${serializeCall}}`,
			);
		});
		return urlTemplate;
	}

	/**
	 * Generates the `basePath` server URL resolution statements for an operation.
	 *
	 * @param model - The analyzed service method model.
	 * @returns Array of TypeScript statement lines resolving `basePath`.
	 */
	protected buildBasePathResolutionLines(model: ServiceMethodModel): string[] {
		const lines: string[] = [];
		if (model.operationServers && model.operationServers.length > 0) {
			lines.push(
				`const operationServers = ${JSON.stringify(model.operationServers, null, 2)};`,
			);
			lines.push(
				`const basePath = resolveServerUrl(operationServers, options?.server ?? 0, options?.serverVariables ?? {});`,
			);
		} else {
			lines.push(
				`const basePath = (options?.server !== undefined || options?.serverVariables !== undefined) ? getServerUrl(options?.server ?? 0, options?.serverVariables ?? {}) : this.basePath;`,
			);
		}
		return lines;
	}

	/**
	 * Generates query parameter serialization statements appending to the given `URLSearchParams` target expression.
	 *
	 * @param model - The analyzed service method model.
	 * @param searchParamsTarget - The target `URLSearchParams` expression (e.g. `url.searchParams` or `queryParams`).
	 * @returns Array of TypeScript statement lines.
	 */
	protected buildQueryParamSerializationLines(
		model: ServiceMethodModel,
		searchParamsTarget: string,
	): string[] {
		const lines: string[] = [];
		model.queryParams.forEach((p: ParamSerialization) => {
			const configObj = JSON.stringify({
				name: p.originalName,
				in: "query",
				style: p.style,
				explode: p.explode,
				allowReserved: p.allowReserved,
			});

			lines.push(
				`const serialized_${p.paramName} = ParameterSerializer.serializeQueryParam(${configObj}, ${p.paramName});`,
			);
			lines.push(
				`serialized_${p.paramName}.forEach((entry: { key: string; value: string }) => { ${searchParamsTarget}.append(decodeURIComponent(entry.key), decodeURIComponent(entry.value)); });`,
			);
		});
		return lines;
	}

	/**
	 * Evaluates a single OpenAPI path operation and adds the corresponding async method (and optional error type alias) to `classDeclaration`.
	 *
	 * @param classDeclaration - The `ts-morph` AST element of the service class.
	 * @param operation - The `PathInfo` representation of the endpoint.
	 */
	public addServiceMethod(
		classDeclaration: ClassDeclaration,
		operation: PathInfo,
	): void {
		const model = this.analyzer.analyze(operation);
		if (!model) return;

		let errorTypeAlias: string | undefined;
		if (model.errorResponses && model.errorResponses.length > 0) {
			const typeName = `${pascalCase(model.methodName)}Error`;
			const union = [...new Set(model.errorResponses.map((e) => e.type))].join(
				" | ",
			);

			classDeclaration.getSourceFile().addTypeAlias({
				name: typeName,
				isExported: true,
				type: union,
			});
			errorTypeAlias = typeName;
		}

		const returnType = this.computeReturnType(model);
		const serverOptionType =
			"{ server?: number | string; serverVariables?: Record<string, string> }";
		const docs = buildOperationMethodDocs(
			operation,
			model,
			this.parser,
			errorTypeAlias,
		);

		classDeclaration.addMethod({
			name: model.methodName,
			isAsync: true,
			parameters: [
				...model.parameters,
				{
					name: "options",
					hasQuestionToken: true,
					type: `${this.getTransportOptionsType()} & ${serverOptionType}`,
				},
			],
			returnType: `Promise<${returnType}>`,
			statements: this.emitMethodBody(model, returnType),
			docs,
		});
	}
}
