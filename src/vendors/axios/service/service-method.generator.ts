/**
 * Generates individual Axios operation methods inside an AxiosService class.
 *
 * @module vendors/axios/service/service-method.generator
 */
import { AbstractHttpServiceMethodGenerator } from "../../../functions/emit_service_method.js";
import type {
	ParamSerialization,
	ServiceMethodModel,
} from "../../../functions/types.js";

/**
 * Responsible for generating the specific content of individual operations inside an AxiosService.
 * This class abstracts the logic to wrap endpoints in a standard Axios execution flow.
 */
export class AxiosServiceMethodGenerator extends AbstractHttpServiceMethodGenerator {
	/**
	 * Returns `AxiosRequestConfig` as the transport options type.
	 *
	 * @returns `"AxiosRequestConfig"`.
	 */
	protected override getTransportOptionsType(): string {
		return "AxiosRequestConfig";
	}

	/**
	 * Translates the `ServiceMethodModel` into stringized valid TypeScript axios code.
	 * @param model - An abstraction holding parameters, path values, query objects, headers, etc.
	 * @returns A string containing the entire method implementation body block.
	 */
	protected override emitMethodBody(model: ServiceMethodModel): string {
		const lines: string[] = [];
		const urlTemplate = this.buildInterpolatedUrlTemplate(model);
		const bt = "`";

		lines.push(...this.buildBasePathResolutionLines(model));
		lines.push(
			`const axiosConfig: AxiosRequestConfig = { ...options, method: '${model.httpMethod.toUpperCase()}', baseURL: basePath, url: ${bt}${urlTemplate}${bt} };`,
		);

		lines.push(
			`axiosConfig.headers = { ...(this.auth ? this.auth.getAuthorizationHeader() : {}), ...(options?.headers as Record<string, string>) };`,
		);

		model.headerParams.forEach((p: ParamSerialization) => {
			lines.push(
				`if (${p.paramName} != null) { axiosConfig.headers['${p.originalName}'] = ParameterSerializer.serializeHeaderParam(${p.paramName}, ${p.explode}); }`,
			);
		});

		if (model.queryParams.length > 0) {
			lines.push(
				`const queryParams = new URLSearchParams(options?.params as Record<string, string>);`,
			);
			lines.push(
				...this.buildQueryParamSerializationLines(model, "queryParams"),
			);
			lines.push(`axiosConfig.params = queryParams;`);
		}

		let dataArgument = "undefined";

		if (model.body) {
			if (model.body.type === "urlencoded") {
				lines.push(`const formBody = new URLSearchParams();`);

				lines.push(
					`const urlParamEntries = ParameterSerializer.serializeUrlEncodedBody(${model.body.paramName}, ${JSON.stringify(model.body.config)});`,
				);

				lines.push(
					`urlParamEntries.forEach((entry: { key: string; value: string }) => { formBody.append(entry.key, entry.value); });`,
				);

				dataArgument = "formBody";

				lines.push(
					`if (!axiosConfig.headers['Content-Type']) { axiosConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded'; }`,
				);
			} else {
				dataArgument = model.body.paramName;

				if (model.body.type === "json") {
					lines.push(
						`if (!axiosConfig.headers['Content-Type']) { axiosConfig.headers['Content-Type'] = 'application/json'; }`,
					);
				} else if (model.body.type === "multipart") {
					// Axios automatically sets multipart/form-data boundary when data is FormData
				} else {
					lines.push(
						`if (!axiosConfig.headers['Content-Type']) { axiosConfig.headers['Content-Type'] = 'application/json'; }`,
					);
				}
			}
		}

		if (dataArgument !== "undefined") {
			lines.push(`axiosConfig.data = ${dataArgument};`);
		}

		if (model.responseSerialization === "blob") {
			lines.push(`axiosConfig.responseType = 'blob';`);
		} else if (model.responseSerialization === "arraybuffer") {
			lines.push(`axiosConfig.responseType = 'arraybuffer';`);
		} else if (model.responseSerialization === "text") {
			lines.push(`axiosConfig.responseType = 'text';`);
		}

		lines.push(
			`const response = await this.axiosInstance.request(axiosConfig);`,
		);

		lines.push(`return response.data;`);

		return lines.join(String.fromCharCode(10));
	}
}
