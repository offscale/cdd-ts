/**
 * Generates individual Fetch API operation methods inside a FetchService class.
 *
 * @module vendors/fetch/service/service-method.generator
 */
import { AbstractHttpServiceMethodGenerator } from "../../../functions/emit_service_method.js";
import type {
	ParamSerialization,
	ServiceMethodModel,
} from "../../../functions/types.js";

/**
 * Responsible for generating the specific content of individual operations inside a FetchService.
 * This class abstracts the logic to wrap endpoints in a standard native fetch execution flow.
 */
export class FetchServiceMethodGenerator extends AbstractHttpServiceMethodGenerator {
	/**
	 * Returns `RequestInit` as the transport options type.
	 *
	 * @returns `"RequestInit"`.
	 */
	protected override getTransportOptionsType(): string {
		return "RequestInit";
	}

	/**
	 * Translates the `ServiceMethodModel` into stringized valid TypeScript fetch code.
	 * @param model - An abstraction holding parameters, path values, query objects, headers, etc.
	 * @param returnType - The computed return type string.
	 * @returns A string containing the entire method implementation body block.
	 */
	protected override emitMethodBody(
		model: ServiceMethodModel,
		returnType: string,
	): string {
		const lines: string[] = [];
		const urlTemplate = this.buildInterpolatedUrlTemplate(model);
		const bt = "`";
		const dollar = "$";

		lines.push(...this.buildBasePathResolutionLines(model));
		lines.push(
			`const url = new URL(${bt}${dollar}{basePath}${urlTemplate}${bt});`,
		);

		if (model.queryParams.length > 0) {
			lines.push(
				...this.buildQueryParamSerializationLines(model, "url.searchParams"),
			);
		}

		lines.push(`const headers = new Headers(options?.headers);`);
		lines.push(
			`const authHeaders = this.auth ? this.auth.getAuthorizationHeader() : {};`,
		);
		lines.push(
			`if (authHeaders.Authorization && !headers.has('Authorization')) { headers.set('Authorization', authHeaders.Authorization); }`,
		);

		model.headerParams.forEach((p: ParamSerialization) => {
			lines.push(
				`if (${p.paramName} != null) { headers.set('${p.originalName}', ParameterSerializer.serializeHeaderParam(${p.paramName}, ${p.explode})); }`,
			);
		});

		let bodyArgument = "undefined";

		if (model.body) {
			if (model.body.type === "raw" || model.body.type === "json") {
				bodyArgument = `JSON.stringify(${model.body.paramName})`;

				lines.push(
					`if (!headers.has('Content-Type')) { headers.set('Content-Type', 'application/json'); }`,
				);
			} else if (model.body.type === "urlencoded") {
				lines.push(`const formBody = new URLSearchParams();`);

				lines.push(
					`const urlParamEntries = ParameterSerializer.serializeUrlEncodedBody(${model.body.paramName}, ${JSON.stringify(model.body.config)});`,
				);

				lines.push(
					`urlParamEntries.forEach((entry: { key: string; value: string }) => { formBody.append(entry.key, entry.value); });`,
				);

				bodyArgument = "formBody";

				lines.push(
					`if (!headers.has('Content-Type')) { headers.set('Content-Type', 'application/x-www-form-urlencoded'); }`,
				);
			}
		}

		lines.push(
			`const fetchOptions: RequestInit = { ...options, method: '${model.httpMethod}', headers };`,
		);

		if (bodyArgument !== "undefined") {
			lines.push(
				`fetchOptions.body = ${bodyArgument} as BodyInit | null | undefined;`,
			);
		}

		lines.push(`const response = await fetch(url.toString(), fetchOptions);`);

		lines.push(
			`if (!response.ok) { throw new globalThis.Error('Request failed: ' + response.statusText); }`,
		);

		if (
			model.responseSerialization === "json" ||
			!model.responseSerialization
		) {
			lines.push(`return response.json();`);
		} else if (model.responseSerialization === "blob") {
			lines.push(`return response.blob() as Promise<${returnType}>;`);
		} else {
			lines.push(`return response.text() as Promise<${returnType}>;`);
		}

		return lines.join(String.fromCharCode(10));
	}
}
