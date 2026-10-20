/**
 * Emits inline operation types for webhooks, callbacks, links, and response headers.
 *
 * @module classes/emit_inline_operation_types
 */
import type {
	JSDocStructure,
	OptionalKind,
	PropertySignatureStructure,
	SourceFile,
} from "ts-morph";
import type {
	GeneratorConfig,
	HeaderObject,
	OpenApiValue,
	PathItem,
	SwaggerDefinition,
} from "../core/types/index.js";
import {
	extractPaths,
	getTypeScriptType,
	pascalCase,
	sanitizeComment,
} from "../functions/utils.js";
import type { SwaggerParser } from "../openapi/parse.js";

/**
 * Callback for processing a named schema definition into a model file.
 *
 * @param name - Model name.
 * @param def - OpenAPI schema definition or boolean schema.
 */
export type ProcessDefinitionFn = (
	/** Model name. */
	name: string,
	/** OpenAPI schema definition or boolean schema. */
	def: SwaggerDefinition | boolean,
) => void;

/**
 * Callback for retrieving or creating a model `SourceFile` by name.
 *
 * @param name - Model name.
 * @returns Target `SourceFile`.
 */
export type GetModelFileFn = (
	/** Model name. */
	name: string,
) => SourceFile;

/**
 * Emits inline model types for webhooks, callbacks, links, and response headers.
 *
 * @param parser - Parsed OpenAPI specification.
 * @param config - Active generator configuration.
 * @param getFile - Helper to get or create a model `SourceFile`.
 * @param processDefinition - Helper to emit a schema definition into a model file.
 */
export function emitInlineOperationTypes(
	parser: SwaggerParser,
	config: GeneratorConfig,
	getFile: GetModelFileFn,
	processDefinition: ProcessDefinitionFn,
): void {
	const spec = parser.getSpec();

	// 2. Webhooks (treated as models for payload typing)
	if (spec.webhooks) {
		Object.entries(spec.webhooks).forEach(([name, pathItem]) => {
			const postOp = (pathItem as PathItem).post;
			if (postOp?.requestBody) {
				const content = (
					postOp.requestBody as {
						content: Record<string, { schema?: OpenApiValue }>;
					}
				).content;
				const jsonContent = content["application/json"] || content["*/*"];
				if (jsonContent?.schema) {
					const modelName = `${pascalCase(name)}Webhook`;
					processDefinition(modelName, jsonContent.schema as SwaggerDefinition);
				}
			}
		});
	}

	// 3. Callbacks
	const allPaths = extractPaths(spec.paths, undefined, spec.components);
	allPaths.forEach((op) => {
		if (op.callbacks) {
			Object.entries(op.callbacks).forEach(([callbackName, callbackObj]) => {
				const resolvedCallback = parser.resolve(callbackObj) as Record<
					string,
					PathItem
				>;
				if (!resolvedCallback) return;
				Object.values(resolvedCallback).forEach((pathItem: PathItem) => {
					(["post", "put", "patch"] as const).forEach((method) => {
						const operation = pathItem[method];
						if (operation?.requestBody) {
							const content = (
								operation.requestBody as {
									content: Record<string, { schema?: OpenApiValue }>;
								}
							).content;
							const jsonContent = content["application/json"] || content["*/*"];
							if (jsonContent?.schema) {
								const opIdBase = op.operationId
									? pascalCase(op.operationId)
									: pascalCase(op.method + op.path);
								const modelName = `${opIdBase}${pascalCase(callbackName)}Request`;
								processDefinition(
									modelName,
									jsonContent.schema as SwaggerDefinition,
								);
							}
						}
					});
				});
			});
		}
	});

	// 4. Links
	const links = parser.links;
	Object.entries(links).forEach(([linkName, linkObj]) => {
		if (linkObj.parameters) {
			const paramsName = `${pascalCase(linkName)}LinkParameters`;
			const sourceFile = getFile(paramsName);
			const properties: OptionalKind<PropertySignatureStructure>[] =
				Object.keys(linkObj.parameters).map((key) => ({
					name: key,
					type: "string | string | number | boolean | object | undefined | null",
					docs: [`Value or expression for parameter '${key}'`],
				}));

			sourceFile.addInterface({
				name: paramsName,
				isExported: true,
				properties: properties,
				docs: [
					{
						description: `Parameters for the '${linkName}' link.`,
						tags: [{ tagName: "see", text: "linkObject" }],
					},
				],
			});
		}
	});

	// 5. Response Headers
	allPaths.forEach((op) => {
		Object.entries(op.responses as NonNullable<typeof op.responses>).forEach(
			([code, resp]) => {
				if (resp.headers) {
					const opIdBase = op.operationId
						? pascalCase(op.operationId)
						: pascalCase(op.method + op.path);
					const interfaceName = `${opIdBase}${code}Headers`;
					const sourceFile = getFile(interfaceName);
					const properties: OptionalKind<PropertySignatureStructure>[] = [];

					for (const [headerName, headerObj] of Object.entries(resp.headers)) {
						const resolvedHeader = parser.resolve(headerObj) as HeaderObject;
						if (!resolvedHeader) continue;

						const isSetCookie = headerName.toLowerCase() === "set-cookie";
						let schema = resolvedHeader.schema as
							| SwaggerDefinition
							| boolean
							| undefined;

						if (schema === undefined && resolvedHeader.content) {
							const firstContentType = Object.keys(resolvedHeader.content)[0];
							if (
								firstContentType &&
								resolvedHeader.content[firstContentType]?.schema !== undefined
							) {
								schema = resolvedHeader.content[firstContentType]
									.schema as SwaggerDefinition;
							}
						}

						if (schema === undefined) {
							schema = {
								type: resolvedHeader.type,
								format: resolvedHeader.format,
							} as SwaggerDefinition;
						}

						const type = isSetCookie
							? "string[]"
							: getTypeScriptType(
									schema,
									config,
									parser.schemas.map((s) => s.name),
								);

						const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(headerName)
							? headerName
							: `'${headerName}'`;

						const jsDocs: OptionalKind<JSDocStructure>[] = [];
						if (resolvedHeader.description || resolvedHeader.deprecated) {
							const doc: OptionalKind<JSDocStructure> = {};
							if (resolvedHeader.description)
								doc.description = sanitizeComment(resolvedHeader.description);
							if (resolvedHeader.deprecated)
								doc.tags = [{ tagName: "deprecated" }];
							jsDocs.push(doc);
						}

						properties.push({
							name: safeName,
							type: type,
							hasQuestionToken: !resolvedHeader.required,
							docs: jsDocs,
						});
					}

					if (properties.length > 0) {
						sourceFile.addInterface({
							name: interfaceName,
							isExported: true,
							properties: properties,
							docs: [
								`Response headers for operation '${op.operationId || `${op.method} ${op.path}`}' with status ${code}.`,
							],
						});
					}
				}
			},
		);
	});
}
