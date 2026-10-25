/**
 * Generates individual Node.js `http`/`https` operation methods inside a NodeService class.
 *
 * @module vendors/node/service/service-method.generator
 */
import { AbstractHttpServiceMethodGenerator } from "../../../functions/emit_service_method.js";
import type {
	ParamSerialization,
	ServiceMethodModel,
} from "../../../functions/types.js";

/**
 * Responsible for generating the specific content of individual operations inside a NodeService.
 * This class abstracts the logic to wrap endpoints in a standard Node.js `http`/`https` execution flow.
 */
export class NodeServiceMethodGenerator extends AbstractHttpServiceMethodGenerator {
	/**
	 * Returns `import('node:http').RequestOptions` as the transport options type.
	 *
	 * @returns `"import('node:http').RequestOptions"`.
	 */
	protected override getTransportOptionsType(): string {
		return "import('node:http').RequestOptions";
	}

	/**
	 * Translates the `ServiceMethodModel` into stringized valid TypeScript Node.js code.
	 * @param model - An abstraction holding parameters, path values, query objects, headers, etc.
	 * @param returnType - The computed return type union string.
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

		lines.push(
			`const headers: Record<string, string> = { ...(this.auth ? this.auth.getAuthorizationHeader() : {}), ...(options?.headers as Record<string, string>) };`,
		);

		model.headerParams.forEach((p: ParamSerialization) => {
			lines.push(
				`if (${p.paramName} != null) { headers['${p.originalName}'] = ParameterSerializer.serializeHeaderParam(${p.paramName}, ${p.explode}); }`,
			);
		});

		let dataArgument = "undefined";

		if (model.body) {
			if (model.body.type === "raw" || model.body.type === "json") {
				dataArgument = `JSON.stringify(${model.body.paramName})`;
				lines.push(
					`if (!headers['Content-Type']) { headers['Content-Type'] = 'application/json'; }`,
				);
			} else if (model.body.type === "urlencoded") {
				lines.push(`const formBody = new URLSearchParams();`);
				lines.push(
					`const urlParamEntries = ParameterSerializer.serializeUrlEncodedBody(${model.body.paramName}, ${JSON.stringify(model.body.config)});`,
				);
				lines.push(
					`urlParamEntries.forEach((entry: { key: string; value: string }) => { formBody.append(decodeURIComponent(entry.key.replace(/\\+/g, '%20')), decodeURIComponent(entry.value.replace(/\\+/g, '%20'))); });`,
				);
				dataArgument = "formBody.toString()";
				lines.push(
					`if (!headers['Content-Type']) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; }`,
				);
			} else {
				const bodyConfig = (model.body as { config: unknown }).config;
				lines.push(`const multipartConfig = ${JSON.stringify(bodyConfig)};`);
				lines.push(
					`const multipartResult = MultipartBuilder.serialize(${model.body.paramName}, multipartConfig);`,
				);
				lines.push(`if (multipartResult.headers) {`);
				lines.push(
					`  Object.entries(multipartResult.headers).forEach(([k, v]) => { headers[k] = v as string; });`,
				);
				lines.push(`}`);
				dataArgument = "multipartResult.content";
			}
		}

		lines.push(
			`const requestOptions: import('node:http').RequestOptions | import('node:https').RequestOptions = { ...options, method: '${model.httpMethod.toUpperCase()}', headers };`,
		);

		lines.push(`return new Promise((resolve, reject) => {`);
		lines.push(`    const client = url.protocol === 'https:' ? https : http;`);
		lines.push(
			`    const req = client.request(url, requestOptions, (res) => {`,
		);
		lines.push(`        const chunks: Buffer[] = [];`);
		lines.push(`        res.on('data', (chunk) => chunks.push(chunk));`);
		lines.push(`        res.on('end', () => {`);
		lines.push(`            const buffer = Buffer.concat(chunks);`);
		lines.push(`            if (res.statusCode && res.statusCode >= 400) {`);
		lines.push(
			`                return reject(new Error('Request failed: ' + res.statusCode + ' ' + res.statusMessage));`,
		);
		lines.push(`            }`);

		if (
			model.responseSerialization === "blob" ||
			model.responseSerialization === "arraybuffer"
		) {
			lines.push(`            resolve(new Blob([buffer]) as ${returnType});`);
		} else if (model.responseSerialization === "text") {
			lines.push(
				`            resolve(buffer.toString('utf-8') as ${returnType});`,
			);
		} else {
			lines.push(`            try {`);
			lines.push(
				`                resolve(JSON.parse(buffer.toString('utf-8')));`,
			);
			lines.push(`            } catch (e) {`);
			lines.push(
				`                resolve(buffer.toString('utf-8') as ${returnType});`,
			);
			lines.push(`            }`);
		}

		lines.push(`        });`);
		lines.push(`    });`);
		lines.push(`    req.on('error', reject);`);

		if (dataArgument !== "undefined") {
			lines.push(`    req.write(${dataArgument});`);
		}

		lines.push(`    req.end();`);
		lines.push(`});`);

		return lines.join(String.fromCharCode(10));
	}
}
