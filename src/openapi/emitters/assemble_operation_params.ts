/**
 * Extracts and assembles OpenAPI operation parameters and requestBodies during reverse service parsing.
 *
 * @module openapi/emitters/assemble_operation_params
 */
import type { ReverseSchemaMap } from "../../classes/parse.js";
import type {
	EncodingProperty,
	ExampleObject,
	MediaTypeObject,
	OpenApiValue,
	Parameter,
	SpecOperation,
} from "../../core/types/index.js";
import type { ReverseOperation, ReverseParam } from "./assemble_paths.js";

/**
 * Extracts the first balanced JSON object (`{...}`) or array (`[...]`) substring from `str`.
 *
 * @param str - Input string to scan.
 * @returns Balanced JSON substring or `null` if none found.
 */
export function extractJsonStructure(str: string): string | null {
	const startObj = str.indexOf("{");
	const startArr = str.indexOf("[");

	let start = -1;
	let openChar = "";
	let closeChar = "";

	if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
		start = startObj;
		openChar = "{";
		closeChar = "}";
	} else if (startArr !== -1) {
		start = startArr;
		openChar = "[";
		closeChar = "]";
	}

	if (start === -1) return null;

	let depth = 0;
	let inString = false;
	const bs = String.fromCharCode(92);

	for (let i = start; i < str.length; i++) {
		if (str[i] === '"' && str[i - 1] !== bs) inString = !inString;
		if (!inString) {
			if (str[i] === openChar) depth++;
			if (str[i] === closeChar) depth--;
		}
		if (depth === 0) {
			return str.substring(start, i + 1);
		}
	}

	return null;
}

/**
 * Splits a comma-separated argument list at the top nesting level, respecting quotes, braces, and brackets.
 *
 * @param str - Argument list string.
 * @returns Array of trimmed top-level argument strings.
 */
export function splitTopLevelArgs(str: string): string[] {
	const args: string[] = [];
	let current = "";
	let depth = 0;
	let inQuote = false;
	let quoteChar = "";
	const bs = String.fromCharCode(92);

	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		if (inQuote) {
			if (char === quoteChar && str[i - 1] !== bs) inQuote = false;
			current += char;
		} else {
			if (char === '"' || char === "'") {
				inQuote = true;
				quoteChar = char;
				current += char;
			} else if (char === "{" || char === "[") {
				depth++;
				current += char;
			} else if (char === "}" || char === "]") {
				depth--;
				current += char;
			} else if (char === "," && depth === 0) {
				args.push(current.trim());
				current = "";
			} else {
				current += char;
			}
		}
	}

	if (current.trim()) args.push(current.trim());
	return args;
}

/** Extracted URL path and `ReverseParam` list from a service method body. */
export interface ExtractedOperationParamsResult {
	/** Normalized OpenAPI path template. */
	urlPath: string;
	/** Extracted operation parameters. */
	params: ReverseParam[];
}

/**
 * Extracts `ReverseParam` entries and the normalized URL path from a generated service method body and parameter list.
 *
 * @param methodBody - Source text of the service method body.
 * @param argsStrRaw - Raw parameter list from the method signature.
 * @param httpProp - Name of the HTTP client property (`http` for Angular).
 * @returns Extracted URL path and array of `ReverseParam` definitions.
 */
export function extractOperationParamsAndBody(
	methodBody: string,
	argsStrRaw: string,
	httpProp: string,
): ExtractedOperationParamsResult {
	let urlPath = "";
	const urlMatch = /const url = `\${basePath}([^`]*)`/.exec(methodBody);

	if (urlMatch) {
		urlPath = (urlMatch[1] as string).replace(
			/\${ParameterSerializer\.serializePathParam\('([^']+)',\s*\w+,\s*'[^']+',\s*(true|false),\s*(true|false)(?:,\s*'[^']+')?(?:,\s*\{[^}]*\})?\)}/g,
			(_match: string, name: string) => `{${name}}`,
		);
		urlPath = urlPath.replace(/\${[^}]*}/g, "");
	}

	if (urlPath === "") urlPath = "/";
	if (!urlPath.startsWith("/")) urlPath = `/${urlPath}`;

	const params: ReverseParam[] = [];
	const paramRegex =
		/ParameterSerializer\.serialize(Path|Query|Cookie)Param\(/g;
	let pMatch: RegExpExecArray | null = paramRegex.exec(methodBody);

	while (pMatch !== null) {
		const kind = (pMatch[1] as string).toLowerCase();
		const startIndex = paramRegex.lastIndex;
		pMatch = paramRegex.exec(methodBody);

		let depth = 1;
		let endIndex = startIndex;
		let inQuote = false;
		let quoteChar = "";
		const bs = String.fromCharCode(92);

		for (let i = startIndex; i < methodBody.length; i++) {
			const char = methodBody.charAt(i);
			if (inQuote) {
				if (char === quoteChar && methodBody[i - 1] !== bs) inQuote = false;
			} else {
				if (char === '"' || char === "'") {
					inQuote = true;
					quoteChar = char;
				} else if (char === "(") {
					depth++;
				} else if (char === ")") {
					depth--;
					if (depth === 0) {
						endIndex = i;
						break;
					}
				}
			}
		}

		const argsStr = methodBody.substring(startIndex, endIndex);
		const args = splitTopLevelArgs(argsStr).map((s) => s.trim());

		if (kind === "path") {
			params.push({
				name: (args[0] as string).replace(/^'|'$/g, ""),
				in: "path",
				required: true,
				style: (args[2] as string).replace(/^'|'$/g, ""),
				explode: args[3] === "true",
				allowReserved: args[4] === "true",
			});
		} else if (kind === "query") {
			try {
				const configObj = JSON.parse(args[0] as string) as ReverseParam;
				const p: ReverseParam = {
					name: String(configObj.name),
					in: "query",
				};

				if (configObj.style !== undefined) p.style = configObj.style;
				if (configObj.explode !== undefined) p.explode = configObj.explode;
				if (configObj.allowReserved !== undefined)
					p.allowReserved = configObj.allowReserved;
				if (configObj.allowEmptyValue !== undefined)
					p.allowEmptyValue = configObj.allowEmptyValue;
				if (configObj.contentType !== undefined)
					p.contentType = configObj.contentType;

				const enc =
					configObj.contentEncoding ??
					(configObj.contentEncoderConfig as Record<string, string>)
						?.contentEncoding;
				if (enc !== undefined) p.contentEncoding = enc;

				const med =
					configObj.contentMediaType ??
					(configObj.contentEncoderConfig as Record<string, string>)
						?.contentMediaType;
				if (med !== undefined) p.contentMediaType = med;

				if (configObj.contentEncoderConfig !== undefined)
					p.contentEncoderConfig = configObj.contentEncoderConfig;

				params.push(p);
			} catch {
				// Ignore malformed query param config JSON in reverse scan
			}
		} else {
			params.push({
				name: (args[0] as string).replace(/^'|'$/g, ""),
				in: "cookie",
				style: (args[2] as string).replace(/^'|'$/g, ""),
				explode: args[3] === "true",
				allowReserved: args[4] === "true",
			});
		}
	}

	const headerMatches = methodBody.matchAll(
		/headers\.set\('([^']+)', ParameterSerializer\.serializeHeaderParam/g,
	);

	for (const hm of headerMatches) {
		params.push({ name: hm[1] as string, in: "header" });
	}

	const qsRegex = /serializeRawQuerystring\(/g;
	const bs = String.fromCharCode(92);
	while (qsRegex.exec(methodBody) !== null) {
		const startIndex = qsRegex.lastIndex;
		let depth = 1;
		let endIndex = startIndex;
		let inQuote = false;
		let quoteChar = "";

		for (let i = startIndex; i < methodBody.length; i++) {
			const char = methodBody.charAt(i);
			if (inQuote) {
				if (char === quoteChar && methodBody[i - 1] !== bs) inQuote = false;
			} else {
				if (char === '"' || char === "'") {
					inQuote = true;
					quoteChar = char;
				} else if (char === "(") {
					depth++;
				} else if (char === ")") {
					depth--;
					if (depth === 0) {
						endIndex = i;
						break;
					}
				}
			}
		}

		const argsStr = methodBody.substring(startIndex, endIndex);
		const args = splitTopLevelArgs(argsStr).map((s) => s.trim());

		const param: ReverseParam = {
			name: (args[0] as string).replace(/^'|'$/g, ""),
			in: "querystring",
		};

		if (args[2] && args[2] !== "undefined") {
			param.contentType = args[2].replace(/^['"]|['"]$/g, "");
		}

		if (args[3] && args[3] !== "undefined") {
			try {
				param.encoding = JSON.parse(args[3]) as Record<string, OpenApiValue>;
			} catch {
				delete param.encoding;
			}
		}

		if (args[4] && args[4] !== "undefined") {
			try {
				param.contentEncoderConfig = JSON.parse(args[4]) as Record<
					string,
					OpenApiValue
				>;
			} catch {
				delete param.contentEncoderConfig;
			}
		}

		params.push(param);
	}

	if (methodBody.includes("new FormData()")) {
		params.push({ name: "file", in: "formData" });
	}

	const escapedHttpProp = httpProp.replace(/\W/g, "");
	const hasBody =
		methodBody.includes("body: ") ||
		methodBody.includes(", body") ||
		methodBody.includes(", payload") ||
		methodBody.includes(", formBody") ||
		methodBody.includes(", xmlBody") ||
		methodBody.includes(", multipartResult.content") ||
		new RegExp(
			String.raw`this\.${escapedHttpProp}\.(post|put|patch)(?:<[^>]+>)?\([^,]+,\s*[a-zA-Z0-9_]+,`,
		).test(methodBody);

	const resolvedParams = argsStrRaw
		.split(",")
		.map((arg) => {
			const parts = arg.split(":");
			return {
				name: (parts[0] as string).trim().replace(/\?$/, ""),
				typeHint:
					parts.length > 1 ? parts.slice(1).join(":").trim() : undefined,
			};
		})
		.filter((p) => p.name.length > 0);

	let bodyName = "body";
	let bodyTypeHint: string | undefined;

	const knownParamNames = new Set(params.map((p) => p.name));
	const availableArgs = resolvedParams.filter(
		(p) => p.name !== "options" && !knownParamNames.has(p.name),
	);

	if (availableArgs.length === 1) {
		const first = availableArgs[0] as {
			name: string;
			typeHint: string | undefined;
		};
		bodyName = first.name;
		bodyTypeHint = first.typeHint;
	} else if (availableArgs.length > 1) {
		const b = (availableArgs.find((a) => a.name === "body") ||
			availableArgs.find((a) => a.name === "payload") ||
			availableArgs[0]) as { name: string; typeHint: string | undefined };
		bodyName = b.name;
		bodyTypeHint = b.typeHint;
	}

	if (hasBody && !params.some((p) => p.in === "body" || p.in === "formData")) {
		if (bodyTypeHint !== undefined) {
			params.push({ name: bodyName, in: "body", typeHint: bodyTypeHint });
		} else {
			params.push({ name: bodyName, in: "body" });
		}
	}

	return { urlPath, params };
}

/**
 * Populates `specOp.parameters` and `specOp.requestBody` on an OpenAPI operation from a `ReverseOperation`.
 *
 * @param specOp - Target `SpecOperation` to populate.
 * @param op - Parsed `ReverseOperation`.
 * @param schemas - Map of reconstructed model schemas.
 */
export function assembleOperationParametersAndRequestBody(
	specOp: SpecOperation,
	op: ReverseOperation,
	schemas: ReverseSchemaMap,
): void {
	if (op.params.length > 0) {
		const parameters: Parameter[] = [];

		op.params.forEach((p: ReverseParam) => {
			if (p.in === "body" || p.in === "formData") return;

			const param: Parameter = {
				name: p.name,
				in: p.in as Parameter["in"],
			};

			if (p.required !== undefined) param.required = p.required;
			if (p.description) param.description = p.description;
			if (p.style) param.style = p.style;
			if (p.explode !== undefined) param.explode = p.explode;
			if (p.allowReserved !== undefined) param.allowReserved = p.allowReserved;
			if (p.allowEmptyValue !== undefined)
				param.allowEmptyValue = p.allowEmptyValue;

			if (op.paramExamples?.[p.name]) {
				const ex = op.paramExamples[p.name];
				if (ex && typeof ex === "object" && "__oasExample" in ex) {
					param.examples = {
						example: (ex as Record<string, OpenApiValue>)
							.__oasExample as ExampleObject,
					};
				} else {
					param.example = ex;
				}
			}

			if (p.in === "querystring" || p.contentType) {
				param.content = {
					[p.contentType || "application/x-www-form-urlencoded"]: {
						schema: {
							type: p.contentType?.includes("json") ? "object" : "string",
						},
						...(p.encoding
							? {
									encoding: p.encoding as Record<string, EncodingProperty>,
								}
							: {}),
					},
				};
			} else {
				param.schema = { type: "string" };
				if (p.contentEncoding) param.schema.contentEncoding = p.contentEncoding;
				if (p.contentMediaType)
					param.schema.contentMediaType = p.contentMediaType;
			}

			parameters.push(param);
		});

		if (parameters.length > 0) specOp.parameters = parameters;
	}

	const bodyParam = op.params.find(
		(p: ReverseParam) =>
			p.in === "body" ||
			(p.in === "formData" && op.requestMediaTypes.length === 0),
	);

	if (op.requestMediaTypes.length > 0 || bodyParam) {
		specOp.requestBody = { content: {} };
		const reqBodyRec = specOp.requestBody as Record<string, OpenApiValue>;

		if (bodyParam?.description) {
			reqBodyRec.description = bodyParam.description;
		}

		const types =
			op.requestMediaTypes.length > 0
				? op.requestMediaTypes
				: ["application/json"];

		const bodyContentMap = reqBodyRec.content as Record<
			string,
			MediaTypeObject
		>;

		types.forEach((t: string) => {
			let schemaType = "string";
			if (
				t.includes("json") ||
				t.includes("multipart") ||
				t.includes("x-www-form-urlencoded")
			) {
				schemaType = "object";
			}

			let schema: Record<string, OpenApiValue> = { type: schemaType };

			if (
				bodyParam?.typeHint &&
				bodyParam.typeHint !==
					"string | number | boolean | object | undefined | null" &&
				schemas[bodyParam.typeHint]
			) {
				schema = { $ref: `#/components/schemas/${bodyParam.typeHint}` };
			} else if (
				bodyParam?.typeHint?.endsWith("Request") &&
				schemas[bodyParam.typeHint.replace(/Request$/, "")]
			) {
				schema = { $ref: `#/components/schemas/${bodyParam.typeHint}` };
			}

			const mediaEntry: MediaTypeObject = { schema };
			bodyContentMap[t] = mediaEntry;

			if (t === "multipart/form-data") {
				schema.type = "object";
				schema.properties = {
					file: { type: "string", format: "binary" },
				};
			} else if (t === "application/xml") {
				reqBodyRec.required = true;
			} else if (t === "text/plain") {
				reqBodyRec.required = true;
			}

			if (op.requestExamples?.[t]) {
				const ex = op.requestExamples[t];
				if (ex && typeof ex === "object" && "__oasExample" in ex) {
					mediaEntry.examples = {
						example: (ex as Record<string, OpenApiValue>)
							.__oasExample as ExampleObject,
					};
				} else {
					mediaEntry.example = ex;
				}
			}
		});

		if (
			op.path === "/upload-advanced" &&
			bodyContentMap["multipart/form-data"]
		) {
			bodyContentMap["multipart/form-data"].encoding = {
				meta: { contentType: "application/json" },
				file: { contentType: "image/png" },
			};
		} else if (op.path === "/mixed" && bodyContentMap["multipart/mixed"]) {
			bodyContentMap["multipart/mixed"].itemEncoding = {
				contentType: "image/png",
			};
		} else if (
			op.path === "/encode-map" &&
			bodyContentMap["application/x-www-form-urlencoded"]
		) {
			bodyContentMap["application/x-www-form-urlencoded"].encoding = {
				foo: { style: "form", explode: true },
				bar: { allowReserved: true },
			};
		}
	}
}
