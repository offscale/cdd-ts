/**
 * Analyzes OpenAPI `PathInfo` operations into `ServiceMethodModel` intermediate representations.
 *
 * @module functions/parse_analyzer
 */

import type { OptionalKind, ParameterDeclarationStructure } from "ts-morph";
import {
	type EncodingProperty,
	type GeneratorConfig,
	type OpenApiValue,
	type PathInfo,
	type SwaggerDefinition,
	UNKNOWN_PAYLOAD_TYPE,
} from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import {
	analyzeMethodParameters,
	analyzeParameterSerializations,
} from "./analyze_parameters.js";
import {
	analyzeBodyVariant,
	analyzeRequestBody,
} from "./analyze_request_body.js";
import {
	analyzeOperationErrorResponses,
	analyzeOperationResponses,
} from "./analyze_responses.js";
import {
	analyzeSecurityAndMetadata,
	enrichEncodingConfig,
	getDecodingConfig,
	getEncodingConfig,
	getXmlConfig,
} from "./analyze_security_metadata.js";
import type { BodyVariant, ServiceMethodModel } from "./types.js";
import { getTypeScriptType } from "./utils.js";

/**
 * Analyzes an OpenAPI operation (`PathInfo`) and constructs a `ServiceMethodModel` IR for code generation.
 */
export class ServiceMethodAnalyzer {
	/**
	 * Creates a new `ServiceMethodAnalyzer`.
	 *
	 * @param config - Generator configuration options.
	 * @param parser - The parsed OpenAPI specification.
	 */
	constructor(
		private config: GeneratorConfig,
		private parser: SwaggerParser,
	) {}

	/**
	 * Analyzes a single `PathInfo` operation into a `ServiceMethodModel`, or returns `null` if `methodName` is missing.
	 *
	 * @param operation - The parsed OpenAPI operation.
	 * @returns The analyzed `ServiceMethodModel` or `null`.
	 */
	public analyze(operation: PathInfo): ServiceMethodModel | null {
		if (!operation.methodName) return null;

		const knownTypes = this.parser.schemas.map((s) => s.name);

		const { variants: responseVariants, successCode } =
			analyzeOperationResponses(
				operation,
				this.config,
				this.parser,
				knownTypes,
				(schema, types) => this.resolveType(schema, types),
			);

		const defaultVariant = responseVariants.find((v) => v.isDefault) ||
			responseVariants[0] || {
				mediaType: "application/json",
				type: UNKNOWN_PAYLOAD_TYPE,
				serialization: "json",
				isDefault: true,
			};

		const errorResponses = analyzeOperationErrorResponses(
			operation,
			this.config,
			knownTypes,
			successCode,
		);

		const parameters = analyzeMethodParameters(
			operation,
			this.config,
			this.parser,
			knownTypes,
		);

		const { pathParams, queryParams, headerParams, cookieParams } =
			analyzeParameterSerializations(operation, this.parser);

		const { body, requestContentType, requestEncodingConfig } =
			analyzeRequestBody(operation, parameters, this.parser, (op, params) =>
				this.analyzeBody(op, params),
			);

		const {
			effectiveSecurity,
			extensions,
			basePath,
			operationServers,
			docText,
		} = analyzeSecurityAndMetadata(operation, this.parser);

		return {
			methodName: operation.methodName,
			httpMethod: operation.method.toUpperCase(),
			urlTemplate: operation.path,
			docs: docText,
			isDeprecated: !!operation.deprecated,
			parameters,

			responseType: defaultVariant.type,
			responseSerialization: defaultVariant.serialization,
			...(defaultVariant.xmlConfig
				? { responseXmlConfig: defaultVariant.xmlConfig }
				: {}),
			...(defaultVariant.decodingConfig
				? { responseDecodingConfig: defaultVariant.decodingConfig }
				: {}),
			...(defaultVariant.sseMode
				? { sseMode: defaultVariant.sseMode as "event" | "data" }
				: {}),

			responseVariants,

			...(requestEncodingConfig ? { requestEncodingConfig } : {}),
			errorResponses,
			pathParams,
			queryParams,
			headerParams,
			cookieParams,
			...(requestContentType ? { requestContentType } : {}),
			security: effectiveSecurity,
			extensions,
			hasServers: !!basePath,
			...(body != null && { body }),
			...(basePath != null && { basePath }),
			...(operationServers ? { operationServers } : {}),
		};
	}

	/**
	 * Analyzes an operation's `requestBody` and `formData` parameters into a `BodyVariant`.
	 *
	 * @param operation - Parsed OpenAPI `PathInfo` operation.
	 * @param parameters - Analyzed method parameter declarations.
	 * @returns Analyzed `BodyVariant` or `undefined`.
	 */
	public analyzeBody(
		operation: PathInfo,
		parameters: OptionalKind<ParameterDeclarationStructure>[],
	): BodyVariant | undefined {
		return analyzeBodyVariant(operation, parameters, this.parser);
	}

	/**
	 * Resolves a TypeScript type expression string from an OpenAPI schema definition.
	 *
	 * @param schema - OpenAPI schema definition.
	 * @param knownTypes - Known generated PascalCase model names.
	 * @returns TypeScript type string.
	 */
	public resolveType(schema: OpenApiValue, knownTypes: string[]): string {
		return schema !== undefined
			? getTypeScriptType(schema as SwaggerDefinition, this.config, knownTypes)
			: UNKNOWN_PAYLOAD_TYPE;
	}

	/**
	 * Enriches an encoding map entry with default `contentType` and `Content-Transfer-Encoding` headers.
	 *
	 * @param propSchema - Property schema definition.
	 * @param configMap - Target encoding property map.
	 * @param key - Property key in `configMap`.
	 */
	public enrichEncodingConfig(
		propSchema: SwaggerDefinition | boolean,
		configMap: Record<string, EncodingProperty>,
		key: string,
	): void {
		enrichEncodingConfig(this.parser, propSchema, configMap, key);
	}

	/**
	 * Recursively builds an XML serialization/deserialization configuration tree from a schema definition.
	 *
	 * @param schema - OpenAPI schema definition.
	 * @param depth - Maximum recursion depth.
	 * @returns XML configuration object.
	 */
	public getXmlConfig(
		schema: SwaggerDefinition | boolean | undefined,
		depth: number,
	): Record<string, OpenApiValue> {
		return getXmlConfig(this.parser, schema, depth);
	}

	/**
	 * Recursively builds a `ContentDecoder` configuration tree for `contentEncoding` / `contentSchema` properties.
	 *
	 * @param schema - OpenAPI schema definition.
	 * @param depth - Maximum recursion depth.
	 * @returns Decoding configuration object.
	 */
	public getDecodingConfig(
		schema: SwaggerDefinition | boolean | undefined,
		depth: number = 5,
	): Record<string, OpenApiValue> {
		return getDecodingConfig(this.parser, schema, depth);
	}

	/**
	 * Recursively builds a `ContentEncoder` configuration tree for `contentMediaType` / `contentEncoding` properties.
	 *
	 * @param schema - OpenAPI schema definition.
	 * @param depth - Maximum recursion depth.
	 * @returns Encoding configuration object.
	 */
	public getEncodingConfig(
		schema: SwaggerDefinition | boolean | undefined,
		depth: number = 5,
	): Record<string, OpenApiValue> {
		return getEncodingConfig(this.parser, schema, depth);
	}
}
