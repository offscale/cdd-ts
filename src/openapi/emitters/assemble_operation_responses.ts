/**
 * Extracts JSDoc/media metadata and assembles OpenAPI operation responses during reverse service parsing.
 *
 * @module openapi/emitters/assemble_operation_responses
 */
import type { ReverseSchemaMap } from "../../classes/parse.js";
import type {
	ExampleObject,
	ExternalDocumentationObject,
	MediaTypeObject,
	OpenApiValue,
	ServerObject,
	SpecOperation,
	SwaggerResponse,
} from "../../core/types/index.js";
import { extractJsonStructure } from "./assemble_operation_params.js";
import type {
	ReverseOperation,
	ReverseParam,
	ReverseResponseHint,
} from "./assemble_paths.js";

/**
 * Parses a method's JSDoc block and HTTP body statements to construct a complete `ReverseOperation`.
 *
 * @param methodName - Name of the service method.
 * @param httpMethod - Uppercase HTTP verb.
 * @param urlPath - Reconstructed OpenAPI path template.
 * @param params - Extracted `ReverseParam` list (mutated in-place when JSDoc enriches params).
 * @param docBlock - Raw JSDoc block text preceding the method.
 * @param methodBody - Source text of the method body.
 * @param returnTypeHint - Optional inner return type string from the method signature or generic call.
 * @param httpProp - Name of the HTTP client property (`http` for Angular).
 * @returns Assembled `ReverseOperation`.
 */
export function buildReverseOperationFromMethod(
	methodName: string,
	httpMethod: string,
	urlPath: string,
	params: ReverseParam[],
	docBlock: string,
	methodBody: string,
	returnTypeHint: string | undefined,
	httpProp: string,
): ReverseOperation {
	const escapedHttpProp = httpProp.replace(/\W/g, "");
	let operationId = methodName;
	let summary: string | undefined;
	let description: string | undefined;
	let tags: string[] = [];
	let deprecated = false;
	let externalDocs: ExternalDocumentationObject | undefined;
	let security: Record<string, string[]>[] | undefined;
	let servers: ServerObject[] | undefined;

	const extensions: Record<string, OpenApiValue> = {};
	const responseHints: ReverseResponseHint[] = [];
	const paramExamples: Record<string, OpenApiValue> = {};
	const requestExamples: Record<string, OpenApiValue> = {};
	const responseExamples: Record<string, Record<string, OpenApiValue>> = {};

	if (docBlock) {
		const lines = docBlock
			.split(String.fromCharCode(10))
			.map((l) => l.replace(/^\s*\*\s?/, "").trim())
			.filter(Boolean);

		for (const line of lines) {
			if (line.startsWith("@operationId"))
				operationId = line.replace("@operationId", "").trim();
			else if (line.startsWith("@tags"))
				tags = line
					.replace("@tags", "")
					.split(",")
					.map((t) => t.trim());
			else if (line.startsWith("@deprecated")) deprecated = true;
			else if (line.startsWith("@see")) {
				const [url, ...desc] = line.replace("@see", "").trim().split(" ");
				const descStr = desc.join(" ");
				externalDocs = descStr
					? { url: url as string, description: descStr }
					: { url: url as string };
			} else if (line.startsWith("@server")) {
				servers = servers || [];
				const content = line.replace("@server", "").trim();
				if (content.startsWith("{") || content.startsWith("[")) {
					const parsed = JSON.parse(content) as ServerObject | ServerObject[];
					servers.push(...(Array.isArray(parsed) ? parsed : [parsed]));
				} else {
					const [url, ...desc] = content.split(" ");
					const d = desc.join(" ");
					if (d) servers.push({ url: url as string, description: d });
					else servers.push({ url: url as string });
				}
			} else if (line.startsWith("@security")) {
				security = security || [];
				const content = line.replace("@security", "").trim();
				if (content.startsWith("{") || content.startsWith("[")) {
					const parsed = JSON.parse(content) as Record<string, string[]>[];
					security.push(...parsed);
				} else {
					security.push({
						[content.split(" ")[0] as string]: content
							.split(" ")
							.slice(1)
							.join(" ")
							.split(","),
					});
				}
			} else if (line.startsWith("@x-")) {
				const parts = line.split(" ");
				const prefix = (parts[0] as string).substring(1);
				if (parts[1])
					extensions[prefix] = JSON.parse(
						parts.slice(1).join(" "),
					) as OpenApiValue;
				else extensions[prefix] = true;
			} else if (line.startsWith("@responseSummary")) {
				const parts = line.replace("@responseSummary", "").trim().split(" ");
				const status = parts.shift() as string;
				const sum = parts.join(" ");
				const ex = responseHints.find((r) => r.status === status);
				if (ex) ex.summary = sum;
				else responseHints.push({ status, summary: sum });
			} else if (line.startsWith("@responseExample")) {
				const parts = line.replace("@responseExample", "").trim().split(" ");
				const status = parts.shift() as string;
				const mType = parts[0]?.includes("/") ? (parts.shift() as string) : "*";
				const statusMap = responseExamples[status] || {};
				responseExamples[status] = statusMap;
				statusMap[mType] = JSON.parse(parts.join(" ")) as OpenApiValue;
			} else if (line.startsWith("@response")) {
				const parts = line.replace("@response", "").trim().split(" ");
				const status = parts.shift() as string;
				const mType = parts[0]?.includes("/") ? parts.shift() : undefined;
				const desc = parts.join(" ") || undefined;
				const ex = responseHints.find((r) => r.status === status);
				if (ex) {
					if (desc && !ex.description) ex.description = desc;
					if (mType) {
						ex.mediaTypes = ex.mediaTypes || [];
						ex.mediaTypes.push(mType);
					}
				} else {
					const hint: ReverseResponseHint = { status };
					if (desc) hint.description = desc;
					if (mType) hint.mediaTypes = [mType];
					responseHints.push(hint);
				}
			} else if (line.startsWith("@paramExample")) {
				const parts = line.replace("@paramExample", "").trim().split(" ");
				paramExamples[parts[0] as string] = JSON.parse(
					parts.slice(1).join(" "),
				) as OpenApiValue;
			} else if (line.startsWith("@param")) {
				const parts = line.replace("@param", "").trim().split(" ");
				const name = (parts[0] as string).replace("{", "").replace("}", "");
				const p = params.find((param) => param.name === name);
				if (p) p.description = parts.slice(1).join(" ");
			} else if (line.startsWith("@requestExample")) {
				const parts = line.replace("@requestExample", "").trim().split(" ");
				const mType = parts[0]?.includes("/") ? (parts.shift() as string) : "*";
				requestExamples[mType] = JSON.parse(parts.join(" ")) as OpenApiValue;
			} else if (line.startsWith("@querystring")) {
				const content = line.replace("@querystring", "").trim();
				if (content.startsWith("{")) {
					const qs = JSON.parse(content) as Record<string, OpenApiValue>;
					const p = params.find((param) => param.name === qs.name);
					if (p) {
						if (qs.contentType !== undefined)
							p.contentType = qs.contentType as string;
						if (qs.encoding !== undefined)
							p.encoding = qs.encoding as Record<string, OpenApiValue>;
						if (qs.required !== undefined) p.required = qs.required as boolean;
						if (qs.description !== undefined)
							p.description = qs.description as string;
					}
				}
			} else if (!line.startsWith("@")) {
				if (!summary) summary = line;
				else description = (description ? `${description} ` : "") + line;
			}
		}
	}

	if (methodBody.includes("EXTENSIONS_CONTEXT_TOKEN")) {
		const configStr = extractJsonStructure(
			methodBody.substring(methodBody.indexOf("EXTENSIONS_CONTEXT_TOKEN")),
		);
		if (configStr) {
			try {
				const parsed = JSON.parse(configStr) as Record<string, OpenApiValue>;
				Object.assign(extensions, parsed);
			} catch {
				// Ignore malformed extensions context literal
			}
		}
	}

	if (methodBody.includes("SECURITY_CONTEXT_TOKEN")) {
		const configStr = extractJsonStructure(
			methodBody.substring(methodBody.indexOf("SECURITY_CONTEXT_TOKEN")),
		);
		if (configStr) {
			try {
				security = JSON.parse(configStr) as Record<string, string[]>[];
			} catch {
				security = undefined;
			}
		}
	}

	if (methodBody.includes("const operationServers =")) {
		const configStr = extractJsonStructure(
			methodBody.substring(methodBody.indexOf("const operationServers =")),
		);
		if (configStr) {
			try {
				servers = JSON.parse(configStr) as ServerObject[];
			} catch {
				servers = undefined;
			}
		}
	}

	let requestMediaTypes: string[] = [];
	const responseMediaTypes: string[] = [];

	if (
		methodBody.includes("MultipartBuilder.serialize") ||
		methodBody.includes("new FormData()")
	) {
		requestMediaTypes.push("multipart/form-data");
	}

	if (methodBody.includes("multipart/mixed")) {
		requestMediaTypes = ["multipart/mixed"];
	}

	if (methodBody.includes("serializeUrlEncodedBody")) {
		requestMediaTypes.push("application/x-www-form-urlencoded");
	}

	if (methodBody.includes("XmlBuilder.serialize(")) {
		requestMediaTypes.push("application/xml");
	}

	if (methodBody.includes("headers.set('Content-Type'")) {
		const m = /headers\.set\('Content-Type',\s*'([^']+)'\)/.exec(methodBody);
		if (m?.[1] && !requestMediaTypes.includes(m[1]))
			requestMediaTypes.push(m[1]);
	}

	if (methodBody.includes("XmlParser.parse"))
		responseMediaTypes.push("application/xml");

	const bs = String.fromCharCode(92);
	if (
		methodBody.includes(`split('${bs}${bs}x1e')`) ||
		methodBody.includes(`split('${bs}x1e')`)
	)
		responseMediaTypes.push("application/json-seq");

	if (
		methodBody.includes(`split('${bs}${bs}n')`) ||
		methodBody.includes(`split('${bs}n')`)
	)
		responseMediaTypes.push("application/jsonl");

	if (methodBody.includes("acceptHeader?.includes('application/xml')"))
		responseMediaTypes.push("application/xml");

	if (methodBody.includes("acceptHeader?.includes('application/json-seq')"))
		responseMediaTypes.push("application/json-seq");

	if (
		methodBody.includes("text/event-stream") ||
		methodBody.includes("SSE response body")
	)
		responseMediaTypes.push("text/event-stream");

	if (
		returnTypeHint &&
		returnTypeHint !==
			"string | number | boolean | object | undefined | null" &&
		returnTypeHint !== "void"
	) {
		if (responseMediaTypes.length === 0)
			responseMediaTypes.push("application/json");
	} else if (
		new RegExp(String.raw`this\.${escapedHttpProp}\.\w+<[^>]+>`).test(
			methodBody,
		) &&
		responseMediaTypes.length === 0
	) {
		responseMediaTypes.push("application/json");
	} else if (
		new RegExp(
			String.raw`this\.${escapedHttpProp}\.request(?:<[^>]+>)?\([^,]+,\s*[^,]+,\s*\{.*body:\s*`,
		).test(methodBody)
	) {
		if (requestMediaTypes.length === 0)
			requestMediaTypes.push("application/json");
	}

	const opBlock: ReverseOperation = {
		methodName,
		operationId,
		httpMethod,
		path: urlPath,
		params,
		requestMediaTypes: Array.from(new Set(requestMediaTypes)),
		responseMediaTypes: Array.from(new Set(responseMediaTypes)),
	};

	if (
		returnTypeHint &&
		returnTypeHint !== "string | number | boolean | object | undefined | null"
	) {
		if (returnTypeHint.endsWith("[]")) {
			opBlock.responseTypeHint = returnTypeHint.substring(
				0,
				returnTypeHint.length - 2,
			);
			opBlock.responseIsArray = true;
		} else {
			opBlock.responseTypeHint = returnTypeHint;
		}
	}

	if (summary) opBlock.summary = summary;
	if (description) opBlock.description = description;
	if (deprecated) opBlock.deprecated = deprecated;
	if (tags.length > 0) opBlock.tags = tags;
	if (externalDocs) opBlock.externalDocs = externalDocs;
	if (servers) opBlock.servers = servers as ServerObject[];
	if (security) opBlock.security = security as Record<string, string[]>[];
	if (Object.keys(extensions).length > 0) opBlock.extensions = extensions;
	if (responseHints.length > 0) opBlock.responseHints = responseHints;
	if (Object.keys(paramExamples).length > 0)
		opBlock.paramExamples = paramExamples;
	if (Object.keys(requestExamples).length > 0)
		opBlock.requestExamples = requestExamples;
	if (Object.keys(responseExamples).length > 0)
		opBlock.responseExamples = responseExamples;

	return opBlock;
}

/**
 * Populates `specOp.responses` on an OpenAPI operation from a `ReverseOperation`.
 *
 * @param specOp - Target `SpecOperation` to populate.
 * @param op - Parsed `ReverseOperation`.
 * @param schemas - Map of reconstructed model schemas.
 */
export function assembleOperationResponses(
	specOp: SpecOperation,
	op: ReverseOperation,
	schemas: ReverseSchemaMap,
): void {
	if (op.responseHints && op.responseHints.length > 0) {
		op.responseHints.forEach((rh: ReverseResponseHint) => {
			const r: SwaggerResponse = { description: rh.description || "ok" };
			if (rh.summary) r.summary = rh.summary;

			if (rh.mediaTypes && rh.mediaTypes.length > 0) {
				const contentMap: Record<string, MediaTypeObject> = {};
				r.content = contentMap;

				rh.mediaTypes.forEach((t: string) => {
					let schema: Record<string, OpenApiValue> = {
						type: t.includes("json") ? "object" : "string",
					};

					if (
						op.responseTypeHint &&
						op.responseTypeHint !==
							"string | number | boolean | object | undefined | null" &&
						schemas[op.responseTypeHint]
					) {
						schema = {
							$ref: `#/components/schemas/${op.responseTypeHint}`,
						};
					}

					const mediaItem: MediaTypeObject = op.responseIsArray
						? { itemSchema: schema }
						: { schema };
					contentMap[t] = mediaItem;

					if (
						op.responseExamples?.[rh.status] &&
						op.responseExamples[rh.status]?.[t]
					) {
						const ex = op.responseExamples[rh.status]?.[t];
						if (ex && typeof ex === "object" && "__oasExample" in ex) {
							mediaItem.examples = {
								example: (ex as Record<string, OpenApiValue>)
									.__oasExample as ExampleObject,
							};
						} else {
							mediaItem.example = ex;
						}
					}
				});
			}

			specOp.responses[rh.status] = r;
		});
	} else if (op.responseMediaTypes.length > 0) {
		const contentMap: Record<string, MediaTypeObject> = {};
		specOp.responses["200"] = { description: "ok", content: contentMap };

		op.responseMediaTypes.forEach((t: string) => {
			let s: Record<string, OpenApiValue> = {
				type: t.includes("json") ? "object" : "string",
			};

			if (
				op.responseTypeHint &&
				op.responseTypeHint !==
					"string | number | boolean | object | undefined | null" &&
				schemas[op.responseTypeHint]
			) {
				s = { $ref: `#/components/schemas/${op.responseTypeHint}` };
			}

			if (t === "application/jsonl") {
				contentMap[t] = {
					itemSchema: s,
				};
			} else if (op.responseIsArray) {
				contentMap[t] = {
					schema: {
						type: "array",
						items: s,
					},
				};
			} else {
				contentMap[t] = {
					schema: s,
				};
			}
		});
	} else {
		specOp.responses["200"] = { description: "ok" };
	}
}
