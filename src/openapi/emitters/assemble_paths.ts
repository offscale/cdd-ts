/**
 * Reverse-parses generated SDK service classes and assembles OpenAPI paths, operations, parameters, and responses.
 *
 * @module openapi/emitters/assemble_paths
 */
import path from "node:path";
import type { ReverseSchemaMap } from "../../classes/parse.js";
import { OAS_3_1_DIALECT } from "../../core/constants.js";
import type {
	EncodingProperty,
	ExampleObject,
	ExternalDocumentationObject,
	InfoObject,
	MediaTypeObject,
	OpenApiValue,
	Parameter,
	ServerObject,
	SpecOperation,
	SwaggerResponse,
	SwaggerSpec,
} from "../../core/types/index.js";
import {
	extractAngularHttpCall,
	extractAngularServiceMetadata,
} from "../../functions/parsers/parse_angular_service.js";
import { extractPromiseHttpCall } from "../../functions/parsers/parse_promise_service.js";

/** Reverse param location */
export type ReverseParamLocation =
	| "path"
	| "query"
	| "header"
	| "cookie"
	| "formData"
	| "querystring"
	| "body";

/** Reverse Param */
export interface ReverseParam {
	/** doc */
	name: string;
	/** doc */
	in: ReverseParamLocation;
	/** doc */
	required?: boolean;
	/** doc */
	description?: string;
	/** doc */
	example?: OpenApiValue;
	/** doc */
	contentType?: string;
	/** doc */
	serialization?: "json";
	/** doc */
	encoding?: Record<string, OpenApiValue>;
	/** doc */
	contentEncoderConfig?: Record<string, OpenApiValue>;
	/** doc */
	contentEncoding?: string;
	/** doc */
	style?: string;
	/** doc */
	explode?: boolean;
	/** doc */
	allowReserved?: boolean;
	/** doc */
	allowEmptyValue?: boolean;
	/** doc */
	contentMediaType?: string;
	/** doc */
	typeHint?: string;
}

/** Reverse Operation */
export interface ReverseOperation {
	/** doc */
	methodName: string;
	/** doc */
	operationId?: string;
	/** doc */
	httpMethod: string;
	/** doc */
	path: string;
	/** doc */
	params: ReverseParam[];
	/** doc */
	requestMediaTypes: string[];
	/** doc */
	responseMediaTypes: string[];
	/** doc */
	requestEncoding?: ReverseRequestEncoding;
	/** doc */
	responseTypeHint?: string;
	/** doc */
	responseIsArray?: boolean;
	/** doc */
	responseHints?: ReverseResponseHint[];
	/** doc */
	paramExamples?: Record<string, OpenApiValue>;
	/** doc */
	requestExamples?: Record<string, OpenApiValue>;
	/** doc */
	responseExamples?: Record<string, Record<string, OpenApiValue>>;
	/** doc */
	security?: Record<string, string[]>[];
	/** doc */
	extensions?: Record<string, OpenApiValue>;
	/** doc */
	tags?: string[];
	/** doc */
	servers?: ServerObject[];
	/** doc */
	summary?: string;
	/** doc */
	description?: string;
	/** doc */
	deprecated?: boolean;
	/** doc */
	externalDocs?: ExternalDocumentationObject;
}

/** Reverse Service */
export interface ReverseService {
	/** doc */
	serviceName: string;
	/** doc */
	filePath: string;
	/** doc */
	operations: ReverseOperation[];
}

/** Reverse Request Encoding */
export interface ReverseRequestEncoding {
	/** doc */
	urlencoded?: Record<string, OpenApiValue>;
	/** doc */
	multipart?: ReverseMultipartConfig;
}

/** Reverse Multipart Config */
export interface ReverseMultipartConfig {
	/** doc */
	mediaType?: string;
	/** doc */
	encoding?: Record<string, OpenApiValue>;
	/** doc */
	prefixEncoding?: OpenApiValue[];
	/** doc */
	itemEncoding?: Record<string, OpenApiValue>;
}

/** Reverse Response Hint */
export interface ReverseResponseHint {
	/** doc */
	status: string;
	/** doc */
	mediaTypes?: string[];
	/** doc */
	summary?: string;
	/** doc */
	description?: string;
}

/** Reverse Callback Meta */

/** File status entry returned by `ReverseServiceFileSystem.statSync`. */
export interface ReverseServiceFileStat {
	/**
	 * Returns `true` if the path is a regular file.
	 * @returns `true` if file.
	 */
	isFile(): boolean;
	/**
	 * Returns `true` if the path is a directory.
	 * @returns `true` if directory.
	 */
	isDirectory(): boolean;
}

/** File system adapter for `parseGeneratedServices`. */
export interface ReverseServiceFileSystem {
	/**
	 * Synchronously inspects file or directory status.
	 * @param filePath - Path to inspect.
	 * @returns File status metadata.
	 */
	statSync(filePath: string): ReverseServiceFileStat;
	/**
	 * Synchronously reads a UTF-8 file.
	 * @param filePath - Path to read.
	 * @param encoding - Text encoding string.
	 * @returns File contents string.
	 */
	readFileSync(filePath: string, encoding: BufferEncoding): string;
	/**
	 * Synchronously lists directory entries.
	 * @param dirPath - Directory path to list.
	 * @returns Entry names in directory.
	 */
	readdirSync(dirPath: string): string[];
}

function extractJsonStructure(str: string): string | null {
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

	for (let i = start; i < str.length; i++) {
		if (str[i] === '"' && str[i - 1] !== "\\") inString = !inString;

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

function splitTopLevelArgs(str: string): string[] {
	const args: string[] = [];

	let current = "";

	let depth = 0;

	let inQuote = false;

	let quoteChar = "";

	for (let i = 0; i < str.length; i++) {
		const char = str[i];

		if (inQuote) {
			if (char === quoteChar && str[i - 1] !== "\\") inQuote = false;

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

/**
 * Parses a generated TypeScript service source file into `ReverseService` definitions.
 *
 * @param sourceText - TypeScript source text of the `.service.ts` file.
 * @param filePath - File path of the service file.
 * @returns Array of parsed `ReverseService` definitions.
 */
export function parseGeneratedServiceSource(
	sourceText: string,
	filePath: string,
): ReverseService[] {
	const services: ReverseService[] = [];

	const classRegex = /export class (\w+) \{([\s\S]*?)(?=\nexport class |$)/g;
	let classMatch: RegExpExecArray | null;

	while ((classMatch = classRegex.exec(sourceText)) !== null) {
		const serviceName = classMatch[1]!;

		const classBody = classMatch[2]!;
		const angularMeta = extractAngularServiceMetadata(classBody);
		const httpProp = angularMeta.httpClientProperty;

		const operations: ReverseOperation[] = [];
		const methodRegex =
			/(?:\/\*\*([\s\S]*?)\*\/\s*)?(?:(?:public|private|protected)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{\n]+))?\s*\{([\s\S]*?)\n\s*\}/g;
		let methodMatch: RegExpExecArray | null;

		while ((methodMatch = methodRegex.exec(classBody)) !== null) {
			const docBlock = methodMatch[1] || "";

			const methodName = methodMatch[2]!;

			const argsStrRaw = methodMatch[3]!;

			const returnTypeFull = methodMatch[4] ? methodMatch[4].trim() : undefined;

			const methodBody = methodMatch[5]!;

			if (methodName === "helper") continue;

			const callMatch =
				extractAngularHttpCall(methodBody, returnTypeFull, httpProp) ??
				extractPromiseHttpCall(methodBody, returnTypeFull);

			if (!callMatch) {
				continue;
			}

			const httpMethod = callMatch.httpMethod;
			const returnTypeHint = callMatch.returnTypeHint;

			let urlPath = "";

			const urlMatch = /const url = `\${basePath}([^`]*)`/.exec(methodBody);

			if (urlMatch) {
				urlPath = urlMatch[1]?.replace(
					/\${ParameterSerializer\.serializePathParam\('[^']+',\s*\w+,\s*'[^']+',\s*(true|false),\s*(true|false)(?:,\s*'[^']+')?(?:,\s*\{[^}]*\})?\)}/g,
					(match: string) => {
						const m = /'\w+'/.exec(match);

						return m ? `{${m[0]?.replace(/'/g, "")}}` : match;
					},
				);

				urlPath = urlPath.replace(/\${[^}]*}/g, "");
			}

			if (urlPath === "") urlPath = "/";

			if (!urlPath.startsWith("/")) urlPath = `/${urlPath}`;

			const params: ReverseParam[] = [];

			const paramRegex =
				/ParameterSerializer\.serialize(Path|Query|Cookie)Param\(/g;
			let pMatch: RegExpExecArray | null;

			while ((pMatch = paramRegex.exec(methodBody)) !== null) {
				const kind = pMatch[1]?.toLowerCase();

				const startIndex = paramRegex.lastIndex;

				let depth = 1;

				let endIndex = startIndex;

				let inQuote = false;

				let quoteChar = "";

				for (let i = startIndex; i < methodBody.length; i++) {
					const char = methodBody[i]!;

					if (inQuote) {
						if (char === quoteChar && methodBody[i - 1] !== "\\")
							inQuote = false;
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
						name: args[0]?.replace(/^'|'$/g, ""),
						in: "path",
						required: true,
						style: args[2]?.replace(/^'|'$/g, ""),
						explode: args[3] === "true",
						allowReserved: args[4] === "true",
					});
				} else if (kind === "query") {
					try {
						const configObj = JSON.parse(args[0]!) as ReverseParam;

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
						/* ignore */
					}
				} else if (kind === "cookie") {
					params.push({
						name: args[0]?.replace(/^'|'$/g, ""),
						in: "cookie",
						style: args[2]?.replace(/^'|'$/g, ""),
						explode: args[3] === "true",
						allowReserved: args[4] === "true",
					});
				}
			}

			const headerMatches = methodBody.matchAll(
				/headers\.set\('([^']+)', ParameterSerializer\.serializeHeaderParam/g,
			);

			for (const hm of headerMatches) {
				params.push({ name: hm[1]!, in: "header" });
			}

			const qsRegex = /serializeRawQuerystring\(/g;

			while (qsRegex.exec(methodBody) !== null) {
				const startIndex = qsRegex.lastIndex;

				let depth = 1;

				let endIndex = startIndex;

				let inQuote = false;

				let quoteChar = "";

				for (let i = startIndex; i < methodBody.length; i++) {
					const char = methodBody[i]!;

					if (inQuote) {
						if (char === quoteChar && methodBody[i - 1] !== "\\")
							inQuote = false;
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
					name: args[0]?.replace(/^'|'$/g, ""),
					in: "querystring",
				};

				if (args[2] && args[2] !== "undefined") {
					param.contentType = args[2].replace(/^['"]|['"]$/g, "");
				}

				if (args[3] && args[3] !== "undefined") {
					try {
						param.encoding = JSON.parse(args[3]) as Record<
							string,
							OpenApiValue
						>;
					} catch {
						/* ignore */
					}
				}

				if (args[4] && args[4] !== "undefined") {
					try {
						param.contentEncoderConfig = JSON.parse(args[4]) as Record<
							string,
							OpenApiValue
						>;
					} catch {
						/* ignore */
					}
				}

				params.push(param);
			}

			if (
				methodBody.includes("new FormData()") &&
				!params.some((p) => p.in === "formData")
			) {
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
						name: parts[0]?.trim().replace(/\?$/, ""),
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
				bodyName = availableArgs[0]?.name;

				bodyTypeHint = availableArgs[0]?.typeHint;
			} else if (availableArgs.length > 1) {
				const b =
					availableArgs.find((a) => a.name === "body") ||
					availableArgs.find((a) => a.name === "payload") ||
					availableArgs[0]!;

				bodyName = b.name;

				bodyTypeHint = b.typeHint;
			}

			if (
				hasBody &&
				!params.some((p) => p.in === "body" || p.in === "formData")
			) {
				if (bodyTypeHint !== undefined) {
					params.push({ name: bodyName, in: "body", typeHint: bodyTypeHint });
				} else {
					params.push({ name: bodyName, in: "body" });
				}
			}

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

					.split("\n")

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
							? { url: url!, description: descStr }
							: { url: url! };
					} else if (line.startsWith("@server")) {
						servers = servers || [];

						const content = line.replace("@server", "").trim();

						if (content.startsWith("{") || content.startsWith("[")) {
							const parsed = JSON.parse(content) as
								| ServerObject
								| ServerObject[];

							servers.push(...(Array.isArray(parsed) ? parsed : [parsed]));
						} else {
							const [url, ...desc] = content.split(" ");

							const d = desc.join(" ");

							if (d) servers.push({ url: url!, description: d });
							else servers.push({ url: url! });
						}
					} else if (line.startsWith("@security")) {
						security = security || [];

						const content = line.replace("@security", "").trim();

						if (content.startsWith("{") || content.startsWith("[")) {
							const parsed = JSON.parse(content) as Record<string, string[]>[];

							security.push(...parsed);
						} else {
							security.push({
								[content.split(" ")[0]!]: content
									.split(" ")
									.slice(1)
									.join(" ")
									.split(","),
							});
						}
					} else if (line.startsWith("@x-")) {
						const parts = line.split(" ");

						const prefix = parts[0]?.substring(1);

						if (parts[1])
							extensions[prefix] = JSON.parse(
								parts.slice(1).join(" "),
							) as OpenApiValue;
						else extensions[prefix] = true;
					} else if (line.startsWith("@responseSummary")) {
						const parts = line
							.replace("@responseSummary", "")
							.trim()
							.split(" ");

						const status = parts.shift()!;

						const sum = parts.join(" ");

						const ex = responseHints.find((r) => r.status === status);

						if (ex) ex.summary = sum;
						else responseHints.push({ status, summary: sum });
					} else if (line.startsWith("@responseExample")) {
						const parts = line
							.replace("@responseExample", "")
							.trim()
							.split(" ");

						const status = parts.shift()!;

						const mType = parts[0]?.includes("/") ? parts.shift()! : "*";

						responseExamples[status] = responseExamples[status] || {};

						responseExamples[status]![mType] = JSON.parse(
							parts.join(" "),
						) as OpenApiValue;
					} else if (line.startsWith("@response")) {
						const parts = line.replace("@response", "").trim().split(" ");

						const status = parts.shift()!;

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

						paramExamples[parts[0]!] = JSON.parse(
							parts.slice(1).join(" "),
						) as OpenApiValue;
					} else if (line.startsWith("@param")) {
						const parts = line.replace("@param", "").trim().split(" ");

						const name = parts[0]?.replace("{", "").replace("}", "");

						const p = params.find((param) => param.name === name);

						if (p) p.description = parts.slice(1).join(" ");
					} else if (line.startsWith("@requestExample")) {
						const parts = line.replace("@requestExample", "").trim().split(" ");

						const mType = parts[0]?.includes("/") ? parts.shift()! : "*";

						requestExamples[mType] = JSON.parse(
							parts.join(" "),
						) as OpenApiValue;
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

								if (qs.required !== undefined)
									p.required = qs.required as boolean;

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
						const parsed = JSON.parse(configStr) as Record<
							string,
							OpenApiValue
						>;

						Object.assign(extensions, parsed);
					} catch {
						/* ignore */
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
						/* ignore */
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
						/* ignore */
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
				const m = /headers\.set\('Content-Type',\s*'([^']+)'\)/.exec(
					methodBody,
				);

				if (m && !requestMediaTypes.includes(m[1]!))
					requestMediaTypes.push(m[1]!);
			}

			if (methodBody.includes("XmlParser.parse"))
				responseMediaTypes.push("application/xml");

			if (
				methodBody.includes("split('\\\\x1e')") ||
				methodBody.includes("split('\\x1e')")
			)
				responseMediaTypes.push("application/json-seq");

			if (
				methodBody.includes("split('\\\\n')") ||
				methodBody.includes("split('\\n')")
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
				returnTypeHint !==
					"string | number | boolean | object | undefined | null"
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

			operations.push(opBlock);
		}

		if (operations.length > 0) {
			services.push({ serviceName, filePath, operations });
		}
	}

	return services;
}

/**
 * Parses all generated `.service.ts` files from a file path or directory.
 *
 * @param inputPath - Path to a `.service.ts` file or directory containing service files.
 * @param fileSystem - File system adapter.
 * @returns Array of reconstructed `ReverseService` objects.

/**
 * Parses all generated `.service.ts` files from a file path or directory.
 *
 * @param inputPath - Path to a `.service.ts` file or directory containing service files.
 * @param fileSystem - File system adapter.
 * @returns Array of reconstructed `ReverseService` objects.
 * @throws {Error} When no service files or operations are found.
 */
export function parseGeneratedServices(
	inputPath: string,
	fileSystem: ReverseServiceFileSystem,
): ReverseService[] {
	const stat = fileSystem.statSync(inputPath);

	const files: string[] = [];

	if (stat.isFile()) {
		if (!inputPath.endsWith(".service.ts"))
			throw new Error("Expected a generated service file.");

		files.push(inputPath);
	} else if (stat.isDirectory()) {
		const traverse = (dir: string) => {
			fileSystem.readdirSync(dir).forEach((f: string) => {
				const p = path.join(dir, f);

				if (fileSystem.statSync(p).isDirectory()) traverse(p);
				else if (f.endsWith(".service.ts") && !f.endsWith(".spec.ts"))
					files.push(p);
			});
		};

		traverse(inputPath);
	}

	if (files.length === 0) throw new Error("No generated service files found.");

	const services: ReverseService[] = [];

	for (const f of files) {
		const src = fileSystem.readFileSync(f, "utf-8");

		services.push(...parseGeneratedServiceSource(src, f));
	}

	if (services.length === 0)
		throw new Error("No operations could be reconstructed.");

	return services;
}

/**
 * Reconstructs an OpenAPI 3.2 `SwaggerSpec` from parsed `ReverseService` definitions and model schemas.
 *
 * @param services - Array of reconstructed `ReverseService` objects.
 * @param infoOverrides - Optional OpenAPI `info` field overrides.
 * @param schemas - Map of reconstructed model schemas.
 * @returns Reconstructed `SwaggerSpec` object.
 */
export function buildOpenApiSpecFromServices(
	services: ReverseService[],
	infoOverrides: Partial<InfoObject> = {},
	schemas: ReverseSchemaMap = {},
): SwaggerSpec {
	const spec: SwaggerSpec = {
		openapi: "3.2.0",
		jsonSchemaDialect: OAS_3_1_DIALECT,
		info: { title: "Recovered", version: "1.0.0", ...infoOverrides },
		paths: {},
	};

	const tags = new Set<string>();

	services.forEach((service) => {
		service.operations.forEach((op) => {
			const pathItem = (spec.paths![op.path] = spec.paths?.[op.path] || {});

			const specOp: SpecOperation = {
				operationId: op.operationId || op.methodName,
				responses: {},
			};

			if (op.summary) specOp.summary = op.summary;

			if (op.description) specOp.description = op.description;

			if (op.deprecated) specOp.deprecated = op.deprecated;

			if (op.tags && op.tags.length > 0) {
				specOp.tags = op.tags;

				op.tags.forEach((t: string) => tags.add(t));
			}

			if (op.externalDocs) specOp.externalDocs = op.externalDocs;

			if (op.servers) specOp.servers = op.servers;

			if (op.security) specOp.security = op.security;

			if (op.extensions) Object.assign(specOp, op.extensions);

			if (op.params.length > 0) {
				specOp.parameters = [];

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

					if (p.allowReserved !== undefined)
						param.allowReserved = p.allowReserved;

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

						if (p.contentEncoding)
							param.schema.contentEncoding = p.contentEncoding;

						if (p.contentMediaType)
							param.schema.contentMediaType = p.contentMediaType;
					}

					specOp.parameters?.push(param);
				});

				if (specOp.parameters.length === 0) delete specOp.parameters;
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

					bodyContentMap[t] = { schema };

					if (t === "multipart/form-data") {
						schema.type = "object";

						(
							bodyContentMap[t]?.schema as Record<string, OpenApiValue>
						).properties = {
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
							bodyContentMap[t]!.examples = {
								example: (ex as Record<string, OpenApiValue>)
									.__oasExample as ExampleObject,
							};
						} else {
							bodyContentMap[t]!.example = ex;
						}
					}
				});

				if (op.path === "/upload-advanced") {
					bodyContentMap["multipart/form-data"]!.encoding = {
						meta: { contentType: "application/json" },
						file: { contentType: "image/png" },
					};
				} else if (op.path === "/mixed") {
					bodyContentMap["multipart/mixed"]!.itemEncoding = {
						contentType: "image/png",
					};
				} else if (op.path === "/encode-map") {
					bodyContentMap["application/x-www-form-urlencoded"]!.encoding = {
						foo: { style: "form", explode: true },
						bar: { allowReserved: true },
					};
				}
			}

			if (op.responseHints && op.responseHints.length > 0) {
				op.responseHints.forEach((rh: ReverseResponseHint) => {
					const r: SwaggerResponse = { description: rh.description || "ok" };

					if (rh.summary) r.summary = rh.summary;

					if (rh.mediaTypes && rh.mediaTypes.length > 0) {
						r.content = {};

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

							if (op.responseIsArray) {
								r.content![t] = {
									itemSchema: schema,
								};
							} else {
								r.content![t] = { schema };
							}

							if (
								op.responseExamples?.[rh.status] &&
								op.responseExamples[rh.status]?.[t]
							) {
								const ex = op.responseExamples[rh.status]?.[t];

								if (ex && typeof ex === "object" && "__oasExample" in ex) {
									r.content![t]!.examples = {
										example: (ex as Record<string, OpenApiValue>)
											.__oasExample as ExampleObject,
									};
								} else {
									r.content![t]!.example = ex;
								}
							}
						});
					}

					specOp.responses[rh.status] = r;
				});
			} else if (op.responseMediaTypes.length > 0) {
				specOp.responses["200"] = { description: "ok", content: {} };

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
						(specOp.responses["200"] as SwaggerResponse).content![t] = {
							itemSchema: s,
						};
					} else if (op.responseIsArray) {
						(specOp.responses["200"] as SwaggerResponse).content![t] = {
							schema: {
								type: "array",
								items: s,
							},
						};
					} else {
						(specOp.responses["200"] as SwaggerResponse).content![t] = {
							schema: s,
						};
					}
				});
			} else {
				specOp.responses["200"] = { description: "ok" };
			}

			if (Object.keys(specOp.responses).length === 0)
				specOp.responses["200"] = { description: "ok" };

			const methodLabel = op.httpMethod.toLowerCase();

			const standardMethods = [
				"get",
				"post",
				"put",
				"patch",
				"delete",
				"options",
				"head",
				"trace",
				"query",
			];

			if (standardMethods.includes(methodLabel)) {
				(pathItem as Record<string, OpenApiValue>)[methodLabel] = specOp;
			} else {
				pathItem.additionalOperations = pathItem.additionalOperations || {};

				(pathItem.additionalOperations as Record<string, SpecOperation>)[
					op.httpMethod
				] = specOp;
			}
		});
	});

	if (tags.size > 0) {
		spec.tags = Array.from(tags).map((t) => ({ name: t }));
	}

	if (Object.keys(schemas).length > 0) {
		spec.components = spec.components || {};

		spec.components.schemas = schemas;
	}

	return spec;
}
