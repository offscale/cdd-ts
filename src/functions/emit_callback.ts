/**
 * Emits the `callbacks.ts` file containing TypeScript payload type aliases and runtime metadata for OpenAPI callbacks.
 *
 * @module functions/emit_callback
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import type { OpenApiValue, PathInfo, PathItem } from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import {
	extractPaths,
	getRequestBodyType,
	getResponseType,
	pascalCase,
} from "./utils.js";

/**
 * Generates the `callbacks.ts` file.
 * This file exports TypeScript interfaces for all Callbacks defined in the OAS spec.
 * This allows consumers to strongly type the data they receive from webhooks.
 */
export class CallbackGenerator {
	/**
	 * Creates a new `CallbackGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project to create `callbacks.ts` in.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates the `callbacks.ts` file in the specified output directory.
	 *
	 * @param outputDir - Target directory where `callbacks.ts` will be emitted.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "callbacks.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		// Import models needed for callback payloads

		const requiredModels = new Set<string>();

		const registerModel = (type: string) => {
			// Rudimentary check if it looks like a model (PascalCase)

			if (
				type &&
				type !== "string | number | boolean | object | undefined | null" &&
				/^[A-Z]/.test(type) &&
				!["Date", "Blob", "File"].includes(type) &&
				!type.includes("{")
			) {
				// Strip array [] suffixes

				const modelName = type.replace(/\[\]/g, "");

				requiredModels.add(modelName);
			}
		};

		const callbacksFound: {
			name: string;
			interfaceName: string;
			method: string;
			expression: string;
			pathItem: PathItem;
			requestType: string;
			responseType: string;
			scope?: "component" | "operation";
		}[] = [];

		const declaredTypeAliases = new Set<string>();

		const addTypeAliasOnce = (name: string, type: string, docs: string[]) => {
			if (declaredTypeAliases.has(name)) return;

			declaredTypeAliases.add(name);

			sourceFile.addTypeAlias({
				isExported: true,
				name,
				type,
				docs,
			});
		};

		const processCallbackMap = (
			callbackName: string,
			callbackMapOrRef: PathItem | { $ref: string } | Record<string, PathItem>,
			scope: "component" | "operation",
		) => {
			const resolved = this.parser.resolve(
				callbackMapOrRef as OpenApiValue,
			) as Record<string, PathItem>;

			if (!resolved) return;

			// A callback Map is URL Expression -> Path Item.

			Object.entries(resolved).forEach(([urlExpression, pathItemObj]) => {
				const callbackPathItem = pathItemObj as PathItem;

				const subPaths = this.processCallbackPathItem(
					urlExpression,
					callbackPathItem,
				);

				subPaths.forEach((sub) => {
					const requestType = getRequestBodyType(
						sub.requestBody,
						this.parser.config,

						this.parser.schemas.map((s) => s.name),
					);

					const firstResponse = Object.values(
						sub.responses as NonNullable<typeof sub.responses>,
					)[0];

					const responseType = getResponseType(
						firstResponse,
						this.parser.config,

						this.parser.schemas.map((s) => s.name),
					);

					registerModel(requestType);

					const interfaceName = `${pascalCase(callbackName)}${pascalCase(sub.method)}Payload`;

					callbacksFound.push({
						name: callbackName,
						method: sub.method,
						interfaceName,
						expression: urlExpression,
						pathItem: callbackPathItem,
						requestType,
						responseType,
						scope,
					});

					addTypeAliasOnce(interfaceName, requestType, [
						`Payload definition for callback '${callbackName}' (${sub.method}).`,
					]);
				});
			});
		};

		// Iterate all operations to find callbacks

		this.parser.operations.forEach((op) => {
			if (!op.callbacks) return;

			Object.entries(op.callbacks).forEach(([callbackName, pathItemOrRef]) => {
				processCallbackMap(
					callbackName,
					pathItemOrRef as PathItem,
					"operation",
				);
			});
		});

		// Include component-level callbacks (OAS 3.2)

		const componentCallbacks = this.parser.spec.components?.callbacks ?? {};

		Object.entries(componentCallbacks).forEach(
			([callbackName, callbackOrRef]) => {
				processCallbackMap(
					callbackName,
					callbackOrRef as Record<string, PathItem>,
					"component",
				);
			},
		);

		if (callbacksFound.length > 0) {
			const modelsImport = Array.from(requiredModels);

			if (modelsImport.length > 0) {
				sourceFile.addImportDeclaration({
					moduleSpecifier: "./models",
					namedImports: modelsImport,
				});
			}

			sourceFile.addVariableStatement({
				isExported: true,
				declarationKind: VariableDeclarationKind.Const,
				declarations: [
					{
						name: "API_CALLBACKS",
						initializer: JSON.stringify(
							callbacksFound.map((c) => ({
								name: c.name,
								method: c.method,
								interfaceName: c.interfaceName,
								expression: c.expression,
								pathItem: c.pathItem,
								scope: c.scope,
							})),
							null,
							2,
						),
					},
				],
				docs: ["Metadata registry for identified callbacks."],
			});
		} else {
			sourceFile.addStatements("export {};");
		}

		sourceFile.formatText();
	}

	/**
	 * Extracts `PathInfo` operations from a callback `PathItem`.
	 *
	 * @param urlKey - Callback runtime expression key.
	 * @param pathItem - Callback `PathItem` definition.
	 * @returns Array of extracted `PathInfo` operations.
	 */
	private processCallbackPathItem(
		urlKey: string,
		pathItem: PathItem,
	): PathInfo[] {
		const tempMap = { [urlKey]: pathItem };
		// Pass the main components to ensure security resolution logic within callbacks
		// follows similar rules, although callbacks rarely define security schemes inline implicitly.

		const resolveRef = this.parser.resolveReference.bind(this.parser);

		const resolveObj = this.parser.resolve.bind(this.parser) as (
			obj: OpenApiValue,
		) => OpenApiValue;

		return extractPaths(
			tempMap,
			resolveRef,
			this.parser.spec.components,
			{
				isOpenApi3: !!this.parser.spec.openapi,
			},
			resolveObj,
		);
	}
}
