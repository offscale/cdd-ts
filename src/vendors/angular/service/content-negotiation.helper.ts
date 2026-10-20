/**
 * Emits Angular `HttpClient` content negotiation pipelines, `responseType` expressions, and TypeScript method overloads.
 *
 * @module vendors/angular/service/content-negotiation.helper
 */
import type {
	MethodDeclarationOverloadStructure,
	OptionalKind,
	ParameterDeclarationStructure,
} from "ts-morph";
import {
	UNKNOWN_PAYLOAD_TYPE,
	UNKNOWN_RECORD_TYPE,
} from "../../../core/types/index.js";
import type {
	ResponseVariant,
	ServiceMethodModel,
} from "../../../functions/types.js";

/**
 * Computes the `responseType` option value expression for an Angular `HttpClient` call.
 *
 * @param model - Analyzed `ServiceMethodModel`.
 * @param hasContentNegotiation - Whether the operation supports multiple `Accept` negotiation variants.
 * @param variantsForNegotiation - Distinct negotiation variants.
 * @returns TypeScript expression string for `responseType`.
 */
export function computeAngularResponseTypeExpression(
	model: ServiceMethodModel,
	hasContentNegotiation: boolean,
	variantsForNegotiation: ResponseVariant[],
): string {
	let responseTypeVal = `options?.responseType`;

	if (hasContentNegotiation) {
		const xmlOrSeqCondition = variantsForNegotiation
			.filter(
				(v) => v.serialization === "xml" || v.serialization.startsWith("json-"),
			)
			.map((v) => `acceptHeader?.includes('${v.mediaType}')`)
			.join(" || ");

		const binaryCondition = variantsForNegotiation
			.filter((v) => v.serialization === "blob")
			.map((v) => `acceptHeader?.includes('${v.mediaType}')`)
			.join(" || ");

		if (binaryCondition || xmlOrSeqCondition) {
			responseTypeVal = `(${binaryCondition || "false"}) ? 'blob' : (${xmlOrSeqCondition || "false"}) ? 'text' : (options?.responseType ?? 'json')`;
		}
	} else {
		const isSeq =
			model.responseSerialization === "json-seq" ||
			model.responseSerialization === "json-lines";
		const isXmlResp = model.responseSerialization === "xml";
		const isBinaryResp = model.responseSerialization === "blob";

		if (isBinaryResp) {
			responseTypeVal = `'blob'`;
		} else if (isSeq || isXmlResp) {
			responseTypeVal = `'text'`;
		}
	}

	return responseTypeVal;
}

/**
 * Appends the `this.http.<method>(...)` call and RxJS `pipe(map(...))` decoding/negotiation statements to `lines`.
 *
 * @param lines - Target statement lines array.
 * @param model - Analyzed `ServiceMethodModel`.
 * @param bodyArgument - Serialized request body variable or `"null"`.
 * @param hasContentNegotiation - Whether content negotiation is active.
 * @param variantsForNegotiation - Distinct negotiation response variants.
 */
export function emitAngularHttpResponsePipeline(
	lines: string[],
	model: ServiceMethodModel,
	bodyArgument: string,
	hasContentNegotiation: boolean,
	variantsForNegotiation: ResponseVariant[],
): void {
	const httpMethod = model.httpMethod.toLowerCase();
	const isStandardBody = ["post", "put", "patch", "query"].includes(httpMethod);
	const isStandardNonBody = [
		"get",
		"delete",
		"head",
		"options",
		"jsonp",
	].includes(httpMethod);

	const returnGeneric = `string | number | boolean | object | undefined | null`;
	let httpCall: string;

	if (isStandardBody) {
		if (httpMethod === "query") {
			httpCall = `this.http.request('QUERY', url, { ...requestOptions, body: ${bodyArgument} } as Record<string, string | number | boolean | object | undefined | null>)`;
		} else {
			httpCall = `this.http.${httpMethod}<${returnGeneric}>(url, ${bodyArgument}, requestOptions as object)`;
		}
	} else if (bodyArgument !== "null") {
		httpCall = `this.http.request<${returnGeneric}>('${model.httpMethod}', url, { ...requestOptions, body: ${bodyArgument} } as Record<string, string | number | boolean | object | undefined | null>)`;
	} else if (isStandardNonBody) {
		httpCall = `this.http.${httpMethod}<${returnGeneric}>(url, requestOptions as object)`;
	} else {
		httpCall = `this.http.request<${returnGeneric}>('${model.httpMethod}', url, requestOptions as object)`;
	}

	if (hasContentNegotiation) {
		lines.push(`return ${httpCall}.pipe(`);
		lines.push(`  map(response => {`);

		variantsForNegotiation.forEach((v) => {
			const check = `acceptHeader?.includes('${v.mediaType}')`;
			lines.push(`    // Handle ${v.mediaType}`);
			if (v.isDefault) lines.push(`    // Default fallback`);

			const isXml = v.serialization === "xml";
			const isSeq =
				v.serialization === "json-seq" || v.serialization === "json-lines";

			if (isXml) {
				lines.push(`    if (${check}) {`);
				lines.push(`       if (typeof response !== 'string') return response;`);
				lines.push(
					`       return XmlParser.parse(response, ${JSON.stringify(v.xmlConfig)});`,
				);
				lines.push(`    }`);
			} else if (isSeq) {
				const bs = String.fromCharCode(92);
				const delimiter =
					v.serialization === "json-seq" ? `${bs}x1e` : `${bs}n`;
				lines.push(`    if (${check}) {`);
				lines.push(`       if (typeof response !== 'string') return response;`);
				lines.push(
					`       return response.split('${delimiter}').filter((p: string) => p.trim().length > 0).map((i: string) => JSON.parse(i));`,
				);
				lines.push(`    }`);
			} else if (v.decodingConfig) {
				lines.push(`    if (${check}) {`);
				lines.push(
					`       return ContentDecoder.decode(response, ${JSON.stringify(v.decodingConfig)});`,
				);
				lines.push(`    }`);
			}
		});

		const def = model.responseVariants.find((v) => v.isDefault);
		if (def?.decodingConfig) {
			lines.push(`    // Default decoding`);
			lines.push(
				`    return ContentDecoder.decode(response, ${JSON.stringify(def.decodingConfig)});`,
			);
		} else {
			lines.push(`    return response;`);
		}

		lines.push(`  })`);
		lines.push(`);`);
	} else {
		const isSeq =
			model.responseSerialization === "json-seq" ||
			model.responseSerialization === "json-lines";
		const isXmlResp = model.responseSerialization === "xml";

		if (isSeq) {
			const bs = String.fromCharCode(92);
			const delimiter =
				model.responseSerialization === "json-seq" ? `${bs}x1e` : `${bs}n`;
			lines.push(`return ${httpCall}.pipe(`);
			lines.push(
				`  map((response: Blob | string | Record<string, string | number | boolean | object | undefined | null>) => {`,
			);
			lines.push(`    if (typeof response !== 'string') return response;`);
			lines.push(
				`    const items = response.split('${delimiter}').filter((part: string) => part.trim().length > 0);`,
			);
			lines.push(`    return items.map((item: string) => JSON.parse(item));`);
			lines.push(`  })`);
			lines.push(`);`);
		} else if (isXmlResp) {
			lines.push(`return ${httpCall}.pipe(`);
			lines.push(
				`  map((response: Blob | string | Record<string, string | number | boolean | object | undefined | null>) => {`,
			);
			lines.push(`    if (typeof response !== 'string') return response;`);
			lines.push(
				`    return XmlParser.parse(response, ${JSON.stringify(model.responseXmlConfig)});`,
			);
			lines.push(`  })`);
			lines.push(`);`);
		} else if (model.responseDecodingConfig) {
			lines.push(`return ${httpCall}.pipe(`);
			lines.push(
				`  map((response: Blob | string | Record<string, string | number | boolean | object | undefined | null>) => {`,
			);
			lines.push(
				`    return ContentDecoder.decode(response, ${JSON.stringify(model.responseDecodingConfig)});`,
			);
			lines.push(`  })`);
			lines.push(`);`);
		} else {
			lines.push(`return ${httpCall};`);
		}
	}
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
export function emitAngularMethodOverloads(
	methodName: string,
	responseType: string,
	parameters: OptionalKind<ParameterDeclarationStructure>[],
	isDeprecated: boolean,
	isSSE: boolean,
	variants: ResponseVariant[],
	serverOptionType: string,
	negotiationVariants?: ResponseVariant[],
): OptionalKind<MethodDeclarationOverloadStructure>[] {
	const nl = String.fromCharCode(10);
	const paramsDocs = parameters
		.map((p) => `@param ${p.name} ${p.hasQuestionToken ? "(optional) " : ""}`)
		.join(nl);

	const uniqueTypes = [...new Set(variants.map((v) => v.type))];
	const unionType = uniqueTypes.join(" | ");
	const defaultResponseType =
		uniqueTypes.length > 1
			? unionType
			: responseType === UNKNOWN_PAYLOAD_TYPE
				? UNKNOWN_RECORD_TYPE
				: responseType || UNKNOWN_RECORD_TYPE;

	const deprecationDoc = isDeprecated ? `${nl}@deprecated` : "";
	const overloads: OptionalKind<MethodDeclarationOverloadStructure>[] = [];

	if (isSSE) {
		return [
			{
				parameters: [...parameters],
				returnType: `Observable<${defaultResponseType}>`,
				docs: [
					`${methodName} (Server-Sent Events).${nl}${paramsDocs}${nl}${deprecationDoc}`,
				],
			},
		];
	}

	const hasOptionalParam = parameters.some((p) => p.hasQuestionToken);
	const resolvedNegotiation = negotiationVariants ?? [];

	if (resolvedNegotiation.length > 1) {
		for (const variant of resolvedNegotiation) {
			overloads.push({
				parameters: [
					...parameters,
					{
						name: "options",
						hasQuestionToken: hasOptionalParam,
						type: `RequestOptions & { headers: { 'Accept': '${variant.mediaType}' } } & ${serverOptionType}`,
					},
				],
				returnType: `Observable<${variant.type}>`,
				docs: [
					`${methodName} (${variant.mediaType})${nl}${paramsDocs}${nl}@param options Options with Accept header '${variant.mediaType}'${deprecationDoc}`,
				],
			});
		}
	}

	overloads.push({
		parameters: [
			...parameters,
			{
				name: "options",
				hasQuestionToken: true,
				type: `RequestOptions & { observe?: 'body' } & ${serverOptionType}`,
			},
		],
		returnType: `Observable<${defaultResponseType}>`,
		docs: [
			`${methodName}. ${nl}${paramsDocs}${nl}@param options The options for this request.${deprecationDoc}`,
		],
	});

	overloads.push({
		parameters: [
			...parameters,
			{
				name: "options",
				hasQuestionToken: hasOptionalParam,
				type: `RequestOptions & { observe: 'response' } & ${serverOptionType}`,
			},
		],
		returnType: `Observable<HttpResponse<${defaultResponseType}>>`,
		docs: [
			`${methodName}. ${nl}${paramsDocs}${nl}@param options The options for this request, with response observation enabled.${deprecationDoc}`,
		],
	});

	overloads.push({
		parameters: [
			...parameters,
			{
				name: "options",
				hasQuestionToken: hasOptionalParam,
				type: `RequestOptions & { observe: 'events' } & ${serverOptionType}`,
			},
		],
		returnType: `Observable<HttpEvent<${defaultResponseType}>>`,
		docs: [
			`${methodName}. ${nl}${paramsDocs}${nl}@param options The options for this request, with event observation enabled.${deprecationDoc}`,
		],
	});

	return overloads;
}
