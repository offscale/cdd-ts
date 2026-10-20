/**
 * Emits Angular `HttpClient` service methods onto a generated service class.
 *
 * @module vendors/angular/service/service-method.generator
 */

import type {
	ClassDeclaration,
	MethodDeclarationOverloadStructure,
	OptionalKind,
	ParameterDeclarationStructure,
} from "ts-morph";
import type { GeneratorConfig, PathInfo } from "../../../core/types/index.js";
import {
	buildOperationMethodDocs,
	getDistinctNegotiationVariants,
} from "../../../functions/emit_operation_jsdoc.js";
import { ServiceMethodAnalyzer } from "../../../functions/parse_analyzer.js";
import type {
	ResponseVariant,
	ServiceMethodModel,
} from "../../../functions/types.js";
import { pascalCase } from "../../../functions/utils.js";
import type { SwaggerParser } from "../../../openapi/parse.js";
import {
	emitAngularHttpResponsePipeline,
	emitAngularMethodOverloads,
} from "./content-negotiation.helper.js";
import { emitAngularParameterAndBodyLines } from "./parameter-serialization.helper.js";
import { emitAngularSseStreamingLines } from "./sse-streaming.helper.js";

/**
 * Emits Angular `HttpClient` service methods onto a generated service class.
 */
export class ServiceMethodGenerator {
	/** Analyzer that converts `PathInfo` into `ServiceMethodModel` IR. */
	public analyzer: ServiceMethodAnalyzer;

	/**
	 * Creates a new `ServiceMethodGenerator`.
	 *
	 * @param config - Active generator configuration.
	 * @param parser - Parsed OpenAPI specification instance.
	 */
	constructor(
		private readonly config: GeneratorConfig,
		readonly parser: SwaggerParser,
	) {
		this.analyzer = new ServiceMethodAnalyzer(config, parser);
	}

	/**
	 * Analyzes an OpenAPI operation and appends the corresponding Angular `HttpClient` method to `classDeclaration`.
	 *
	 * @param classDeclaration - Target service class declaration.
	 * @param operation - Operation path info to emit.
	 */
	public addServiceMethod(
		classDeclaration: ClassDeclaration,
		operation: PathInfo,
	): void {
		const model = this.analyzer.analyze(operation);

		if (!model) {
			(this.config.logger ?? console).warn?.(
				`[ServiceMethodGenerator] Skipping method generation for operation without a methodName detected.`,
			);
			return;
		}

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
				docs: [`Error union for ${model.methodName}`],
			});

			errorTypeAlias = typeName;
		}

		const isSSE = model.responseSerialization === "sse";
		const serverOptionType =
			"{ server?: number | string; serverVariables?: Record<string, string> }";
		const negotiationVariants = getDistinctNegotiationVariants(
			model.responseVariants,
		);
		const hasContentNegotiation = negotiationVariants.length > 1;

		const bodyStatements = this.emitMethodBody(
			model,
			operation,
			isSSE,
			hasContentNegotiation,
			negotiationVariants,
		);

		const overloads = this.emitOverloads(
			model.methodName,
			model.responseType,
			model.parameters,
			model.isDeprecated,
			isSSE,
			model.responseVariants,
			serverOptionType,
			negotiationVariants,
		);

		const returnType =
			"Observable<string | number | boolean | object | undefined | null>";

		const docs = buildOperationMethodDocs(
			operation,
			model,
			this.parser,
			errorTypeAlias,
		);

		classDeclaration.addMethod({
			name: model.methodName,
			parameters: [
				...model.parameters,
				{
					name: "options",
					hasQuestionToken: true,
					type: `RequestOptions & { observe?: 'body' | 'events' | 'response', responseType?: 'arraybuffer' | 'blob' | 'json' | 'text' } & ${serverOptionType}`,
				},
			],
			returnType: returnType,
			statements: bodyStatements,
			overloads: overloads,
			docs: docs,
		});
	}

	/**
	 * Emits the TypeScript statement body for an Angular `HttpClient` service method.
	 *
	 * @param model - Analyzed `ServiceMethodModel`.
	 * @param rawOp - Raw `PathInfo` operation.
	 * @param isSSE - Whether the operation uses Server-Sent Events.
	 * @param hasContentNegotiation - Whether content negotiation is active.
	 * @param negotiationVariants - Optional distinct negotiation variants.
	 * @returns Generated TypeScript method body statements.
	 */
	public emitMethodBody(
		model: ServiceMethodModel,
		rawOp: PathInfo,
		isSSE: boolean,
		hasContentNegotiation: boolean,
		negotiationVariants?: ResponseVariant[],
	): string {
		const variantsForNegotiation = hasContentNegotiation
			? (negotiationVariants ?? model.responseVariants)
			: model.responseVariants;

		const { lines, bodyArgument } = emitAngularParameterAndBodyLines(
			model,
			rawOp,
			this.config,
			this.analyzer,
			hasContentNegotiation,
			variantsForNegotiation,
		);

		const nl = String.fromCharCode(10);
		if (isSSE) {
			emitAngularSseStreamingLines(lines, model, bodyArgument);
			return lines.join(nl);
		}

		emitAngularHttpResponsePipeline(
			lines,
			model,
			bodyArgument,
			hasContentNegotiation,
			variantsForNegotiation,
		);

		return lines.join(nl);
	}

	/**
	 * Generates TypeScript method overloads for Angular `observe: 'body' | 'response' | 'events'` and content negotiation `Accept` headers.
	 *
	 * @param methodName - Name of the service method.
	 * @param responseType - Primary response type string.
	 * @param parameters - Method parameter declarations.
	 * @param isDeprecated - Whether the operation is deprecated.
	 * @param isSSE - Whether the operation uses Server-Sent Events.
	 * @param variants - All analyzed response variants.
	 * @param serverOptionType - TypeScript type string for server options.
	 * @param negotiationVariants - Distinct content negotiation variants.
	 * @returns Array of `ts-morph` method overload structures.
	 */
	public emitOverloads(
		methodName: string,
		responseType: string,
		parameters: OptionalKind<ParameterDeclarationStructure>[],
		isDeprecated: boolean,
		isSSE: boolean,
		variants: ResponseVariant[],
		serverOptionType: string,
		negotiationVariants?: ResponseVariant[],
	): OptionalKind<MethodDeclarationOverloadStructure>[] {
		return emitAngularMethodOverloads(
			methodName,
			responseType,
			parameters,
			isDeprecated,
			isSSE,
			variants,
			serverOptionType,
			negotiationVariants,
		);
	}
}
