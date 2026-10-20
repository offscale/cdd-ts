/**
 * Emits Angular parameter, header, cookie, query, and requestBody serialization statements for `HttpClient` service methods.
 *
 * @module vendors/angular/service/parameter-serialization.helper
 */
import type {
	GeneratorConfig,
	Parameter,
	PathInfo,
	SwaggerDefinition,
} from "../../../core/types/index.js";
import { getXmlContentEntry } from "../../../functions/analyze_parameters.js";
import type { ServiceMethodAnalyzer } from "../../../functions/parse_analyzer.js";
import type {
	ParamSerialization,
	ResponseVariant,
	ServiceMethodModel,
} from "../../../functions/types.js";
import { camelCase } from "../../../functions/utils.js";
import { computeAngularResponseTypeExpression } from "./content-negotiation.helper.js";

/** Result of emitting Angular parameter and request body serialization statements. */
export interface AngularParameterAndBodyLinesResult {
	/** Emitted TypeScript statement lines. */
	lines: string[];
	/** Variable name or `"null"` representing the serialized request body. */
	bodyArgument: string;
}

/**
 * Emits Angular parameter, header, cookie, URL, `HttpRequestOptions`, and request body serialization statements.
 *
 * @param model - Analyzed `ServiceMethodModel`.
 * @param rawOp - Raw `PathInfo` operation.
 * @param config - Active generator configuration.
 * @param analyzer - `ServiceMethodAnalyzer` instance.
 * @param hasContentNegotiation - Whether content negotiation is active.
 * @param variantsForNegotiation - Distinct negotiation response variants.
 * @returns Statement lines and the resolved `bodyArgument` variable name.
 */
export function emitAngularParameterAndBodyLines(
	model: ServiceMethodModel,
	rawOp: PathInfo,
	config: GeneratorConfig,
	analyzer: ServiceMethodAnalyzer,
	hasContentNegotiation: boolean,
	variantsForNegotiation: ResponseVariant[],
): AngularParameterAndBodyLinesResult {
	const lines: string[] = [];

	const xmlParams =
		rawOp.parameters
			?.map((p) => {
				const entry = getXmlContentEntry(p);
				if (!entry) return undefined;
				return { param: p, schema: entry.schema };
			})
			.filter(
				(p): p is { param: Parameter; schema: SwaggerDefinition | boolean } =>
					!!p,
			) ?? [];

	xmlParams.forEach(({ param, schema }) => {
		const paramName = camelCase(param.name);
		const rootName =
			typeof schema === "object" && schema.xml?.name
				? schema.xml.name
				: param.name;
		const xmlConfig = analyzer.getXmlConfig(schema as SwaggerDefinition, 5);

		lines.push(
			`let ${paramName}Serialized: Record<string, string | number | boolean | object | undefined | null> = ${paramName};`,
		);
		lines.push(`if (${paramName} !== null && ${paramName} !== undefined) {`);
		lines.push(
			`  ${paramName}Serialized = XmlBuilder.serialize(${paramName}, '${rootName}', ${JSON.stringify(xmlConfig)});`,
		);
		lines.push(`}`);
	});

	let urlTemplate = model.urlTemplate;

	model.pathParams.forEach((p: ParamSerialization) => {
		const pathArgs: string[] = [
			`'${p.originalName}'`,
			p.paramName,
			`'${p.style || "simple"}'`,
			`${p.explode}`,
			`${p.allowReserved}`,
		];

		if (p.serializationLink === "json" || p.contentEncoderConfig) {
			pathArgs.push(p.serializationLink === "json" ? "'json'" : "undefined");
		}

		if (p.contentEncoderConfig) {
			pathArgs.push(JSON.stringify(p.contentEncoderConfig));
		}

		const serializeCall = `ParameterSerializer.serializePathParam(${pathArgs.join(", ")})`;
		urlTemplate = urlTemplate.replace(
			`{${p.originalName}}`,
			`${String.fromCharCode(36)}{${serializeCall}}`,
		);
	});

	const qsParam = rawOp.parameters?.find(
		(p: Parameter) => (p.in as string) === "querystring",
	);

	let queryStringVariable = "";

	if (qsParam) {
		const pName = camelCase(qsParam.name);
		const contentKeys = qsParam.content ? Object.keys(qsParam.content) : [];
		const contentType = contentKeys.length > 0 ? contentKeys[0] : undefined;
		const isJson =
			qsParam.content?.["application/json"] ||
			contentType?.includes("application/json");

		const qsConfig = model.queryParams.find(
			(p) => p.originalName === qsParam.name,
		);

		const encodingConfig =
			contentType && qsParam.content?.[contentType]?.encoding
				? qsParam.content[contentType]?.encoding
				: undefined;

		const serializationArg = isJson ? "'json'" : "undefined";
		const contentTypeArg =
			!isJson && contentType ? `'${contentType}'` : "undefined";
		const encodingArg = encodingConfig
			? JSON.stringify(encodingConfig)
			: "undefined";
		const encoderArg = qsConfig?.contentEncoderConfig
			? JSON.stringify(qsConfig.contentEncoderConfig)
			: "undefined";

		const args = [
			pName,
			serializationArg,
			contentTypeArg,
			encodingArg,
			encoderArg,
		];

		while (args.length > 1 && args[args.length - 1] === "undefined") {
			args.pop();
		}

		lines.push(
			`const queryString = ParameterSerializer.serializeRawQuerystring(${args.join(", ")});`,
		);
		queryStringVariable = "${queryString ? '?' + queryString : ''}";
	}

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

	const dollar = String.fromCharCode(36);
	const backtick = String.fromCharCode(96);
	lines.push(
		`const url = ${backtick}${dollar}{basePath}${urlTemplate}${queryStringVariable}${backtick};`,
	);

	const standardQueryParams = model.queryParams.filter(
		(p) => p.originalName !== qsParam?.name,
	);

	if (standardQueryParams.length > 0) {
		lines.push(
			`let params = new HttpParams({ encoder: new ApiParameterCodec(), fromObject: (options?.params && !(options.params instanceof HttpParams) ? options.params : {}) as Record<string, string | number | boolean | readonly (string | number | boolean)[]> });`,
		);

		standardQueryParams.forEach((p: ParamSerialization) => {
			const configObj = JSON.stringify({
				name: p.originalName,
				in: "query",
				style: p.style,
				explode: p.explode,
				allowReserved: p.allowReserved,
				serialization: p.serializationLink,
				allowEmptyValue: p.allowEmptyValue,
				...(p.contentType ? { contentType: p.contentType } : {}),
				...(p.encoding ? { encoding: p.encoding } : {}),
				...(p.contentEncoderConfig
					? { contentEncoderConfig: p.contentEncoderConfig }
					: {}),
			});

			lines.push(
				`const serialized_${p.paramName} = ParameterSerializer.serializeQueryParam(${configObj}, ${p.paramName});`,
			);
			lines.push(
				`serialized_${p.paramName}.forEach((entry: { key: string, value: string | Blob }) => params = params.append(entry.key, entry.value as string));`,
			);
		});
	}

	lines.push(
		`let headers = options?.headers instanceof HttpHeaders ? options.headers : new HttpHeaders(options?.headers ?? {});`,
	);

	model.headerParams.forEach((p: ParamSerialization) => {
		const headerArgs: string[] = [p.paramName, `${p.explode}`];
		const hasEncoderConfig = !!p.contentEncoderConfig;

		if (p.serializationLink === "json") {
			headerArgs.push("'json'");
		} else if (p.contentType || p.encoding || hasEncoderConfig) {
			headerArgs.push("undefined");
		}

		if (p.contentType) {
			headerArgs.push(`'${p.contentType}'`);
		} else if (p.encoding || hasEncoderConfig) {
			headerArgs.push("undefined");
		}

		if (p.encoding) {
			headerArgs.push(JSON.stringify(p.encoding));
		} else if (hasEncoderConfig) {
			headerArgs.push("undefined");
		}

		if (hasEncoderConfig) {
			headerArgs.push(JSON.stringify(p.contentEncoderConfig));
		}

		lines.push(
			`if (${p.paramName} != null) { headers = headers.set('${p.originalName}', ParameterSerializer.serializeHeaderParam(${headerArgs.join(", ")})); }`,
		);
	});

	if (model.cookieParams.length > 0) {
		if (config.options.platform !== "node") {
			lines.push(
				`// WARNING: Setting 'Cookie' headers manually is forbidden in browsers.`,
			);
			lines.push(
				`if (typeof window !== 'undefined') { console.warn('Operation ${model.methodName} attempts to set "Cookie" header manually. This will fail in browsers.'); }`,
			);
		}

		lines.push(`const __cookies: string[] = [];`);

		model.cookieParams.forEach((p: ParamSerialization) => {
			const hasEncoderConfig = !!p.contentEncoderConfig;
			const hint =
				p.serializationLink === "json"
					? ", 'json'"
					: hasEncoderConfig
						? ", undefined"
						: "";
			const encoderArg = hasEncoderConfig
				? `, ${JSON.stringify(p.contentEncoderConfig)}`
				: "";

			lines.push(
				`if (${p.paramName} != null) { __cookies.push(ParameterSerializer.serializeCookieParam('${p.originalName}', ${p.paramName}, '${p.style || "form"}', ${p.explode}, ${p.allowReserved}${hint}${encoderArg})); }`,
			);
		});

		lines.push(
			`if (__cookies.length > 0) { headers = headers.set('Cookie', __cookies.join('; ')); }`,
		);
	}

	if (hasContentNegotiation) {
		lines.push(`const acceptHeader = headers.get('Accept');`);
	}

	let contextConstruction = `this.createContextWithClientId(options?.context)`;

	if (model.security.length > 0) {
		contextConstruction += `.set(SECURITY_CONTEXT_TOKEN, ${JSON.stringify(model.security)})`;
	}

	if (model.extensions && Object.keys(model.extensions).length > 0) {
		contextConstruction += `.set(EXTENSIONS_CONTEXT_TOKEN, ${JSON.stringify(model.extensions)})`;
	}

	const responseTypeVal = computeAngularResponseTypeExpression(
		model,
		hasContentNegotiation,
		variantsForNegotiation,
	);

	let optionProperties = `

  observe: options?.observe, 
  reportProgress: options?.reportProgress, 
  responseType: ${responseTypeVal}, 
  withCredentials: options?.withCredentials, 
  context: ${contextConstruction}`;

	if (standardQueryParams.length > 0)
		optionProperties += `,
  params`;
	optionProperties += `,
  headers`;

	lines.push(
		`let requestOptions: HttpRequestOptions = {${optionProperties}
};`,
	);

	let bodyArgument = "null";
	const body = model.body;
	const legacyFormData = rawOp.parameters?.filter(
		(p) => (p as { in?: string }).in === "formData",
	);
	const isUrlEnc = rawOp.consumes?.includes(
		"application/x-www-form-urlencoded",
	);

	if (legacyFormData && legacyFormData.length > 0) {
		if (isUrlEnc) {
			lines.push(`let formBody = new HttpParams();`);
			legacyFormData.forEach((p: Parameter) => {
				const paramName = camelCase(p.name);
				lines.push(
					`if (${paramName} != null) { formBody = formBody.append('${p.name}', ${paramName}); }`,
				);
			});
			bodyArgument = "formBody";
		} else {
			lines.push(`const formData = new FormData();`);
			legacyFormData.forEach((p: Parameter) => {
				const paramName = camelCase(p.name);
				lines.push(
					`if (${paramName} != null) { formData.append('${p.name}', ${paramName}); }`,
				);
			});
			bodyArgument = "formData";
		}
	} else if (body) {
		if (body.type === "raw" || body.type === "json") {
			bodyArgument = body.paramName;
			if (model.requestEncodingConfig) {
				lines.push(
					`if (${body.paramName} !== null && ${body.paramName} !== undefined) {`,
				);
				lines.push(
					`  ${body.paramName} = ContentEncoder.encode(${body.paramName}, ${JSON.stringify(model.requestEncodingConfig)});`,
				);
				lines.push(`}`);
			}
		} else if (body.type === "urlencoded") {
			let encodedBodyName = body.paramName;
			if (model.requestEncodingConfig) {
				encodedBodyName = "encodedBody";
				lines.push(`let encodedBody = ${body.paramName};`);
				lines.push(`if (encodedBody !== null && encodedBody !== undefined) {`);
				lines.push(
					`  encodedBody = ContentEncoder.encode(encodedBody, ${JSON.stringify(model.requestEncodingConfig)});`,
				);
				lines.push(`}`);
			}

			lines.push(
				`const urlParamEntries = ParameterSerializer.serializeUrlEncodedBody(${encodedBodyName}, ${JSON.stringify(body.config)});`,
			);
			lines.push(
				`let formBody = new HttpParams({ encoder: new ApiParameterCodec() });`,
			);
			lines.push(
				`urlParamEntries.forEach((entry: { key: string, value: string | Blob }) => formBody = formBody.append(entry.key, entry.value as string));`,
			);
			bodyArgument = "formBody";
		} else if (body.type === "json-lines" || body.type === "json-seq") {
			const bodyVar =
				body.type === "json-seq" ? "jsonSeqBody" : "jsonLinesBody";
			lines.push(`let ${bodyVar} = ${body.paramName};`);

			if (model.requestEncodingConfig) {
				lines.push(`if (${bodyVar} !== null && ${bodyVar} !== undefined) {`);
				lines.push(
					`  ${bodyVar} = ContentEncoder.encode(${bodyVar}, ${JSON.stringify(model.requestEncodingConfig)});`,
				);
				lines.push(`}`);
			}

			const bs = String.fromCharCode(92);
			if (body.type === "json-seq") {
				lines.push(`if (Array.isArray(${bodyVar})) {`);
				lines.push(
					`  ${bodyVar} = ${bodyVar}.map((item: Record<string, string | number | boolean | object | undefined | null>) => '${bs}x1e' + JSON.stringify(item)).join('');`,
				);
				lines.push(
					`} else if (${bodyVar} != null && typeof ${bodyVar} !== 'string') {`,
				);
				lines.push(`  ${bodyVar} = '${bs}x1e' + JSON.stringify(${bodyVar});`);
				lines.push(`}`);
			} else {
				lines.push(`if (Array.isArray(${bodyVar})) {`);
				lines.push(
					`  ${bodyVar} = ${bodyVar}.map((item: Record<string, string | number | boolean | object | undefined | null>) => JSON.stringify(item)).join('${bs}n');`,
				);
				lines.push(
					`} else if (${bodyVar} != null && typeof ${bodyVar} !== 'string') {`,
				);
				lines.push(`  ${bodyVar} = JSON.stringify(${bodyVar});`);
				lines.push(`}`);
			}
			bodyArgument = bodyVar;
		} else if (body.type === "multipart") {
			lines.push(`const multipartConfig = ${JSON.stringify(body.config)};`);
			lines.push(
				`const multipartResult = MultipartBuilder.serialize(${body.paramName}, multipartConfig);`,
			);
			lines.push(`if (multipartResult.headers) {`);
			lines.push(
				`  let newHeaders = requestOptions.headers instanceof HttpHeaders ? requestOptions.headers : new HttpHeaders(requestOptions.headers || {});`,
			);
			lines.push(
				`  Object.entries(multipartResult.headers).forEach(([k, v]) => { newHeaders = newHeaders.set(k, v as string); });`,
			);
			lines.push(`  headers = newHeaders;`);
			lines.push(
				`  requestOptions = { ...requestOptions, headers: newHeaders };`,
			);
			lines.push(`}`);
			bodyArgument = "multipartResult.content";
		} else if (body.type === "xml") {
			lines.push(
				`const xmlBody = XmlBuilder.serialize(${body.paramName}, '${body.rootName}', ${JSON.stringify(body.config)});`,
			);
			bodyArgument = "xmlBody";
		}
	}

	if (
		body &&
		model.requestContentType &&
		body.type !== "multipart" &&
		body.type !== "encoded-form-data"
	) {
		lines.push(
			`if (${body.paramName} != null && !headers.has('Content-Type')) { headers = headers.set('Content-Type', '${model.requestContentType}'); }`,
		);
	}

	lines.push(`requestOptions = { ...requestOptions, headers };`);

	return { lines, bodyArgument };
}
