/**
 * Emits the `webhooks.ts` file containing TypeScript payload type aliases and runtime metadata for OpenAPI webhooks.
 *
 * @module functions/emit_webhook
 */
import * as path from "node:path";
import { type Project, VariableDeclarationKind } from "ts-morph";
import { UTILITY_GENERATOR_HEADER_COMMENT } from "../core/constants.js";
import type { OpenApiValue, PathInfo, PathItem } from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import {
	extractPaths,
	getRequestBodyType,
	getResponseType,
	pascalCase,
} from "./utils.js";

/**
 * Generates the `webhooks.ts` file containing webhook payload types and `API_WEBHOOKS` metadata.
 */
export class WebhookGenerator {
	/**
	 * Creates a new `WebhookGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project to create `webhooks.ts` in.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Generates the `webhooks.ts` file in the specified output directory.
	 *
	 * @param outputDir - Target directory where `webhooks.ts` will be emitted.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "webhooks.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const requiredModels = new Set<string>();

		const registerModel = (type: string) => {
			if (
				type &&
				type !== "string | number | boolean | object | undefined | null" &&
				/^[A-Z]/.test(type) &&
				!["Date", "Blob", "File"].includes(type) &&
				!type.includes("{") &&
				!type.includes("<")
			) {
				const modelName = type.replace(/\[\]/g, "");

				requiredModels.add(modelName);
			}
		};

		const webhooksFound: {
			name: string;
			interfaceName: string;
			method: string;
			pathItem: PathItem;
			requestType: string;
			responseType: string;
			scope?: "root" | "component";
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

		const processWebhookEntry = (
			webhookName: string,
			pathItemOrRef: PathItem | { $ref: string },
			scope: "root" | "component",
		) => {
			const resolved = this.parser.resolve(pathItemOrRef) as PathItem;

			if (!resolved) return;

			const webhookPathItem = resolved;

			const subPaths = this.processWebhookPathItem(
				webhookName,
				webhookPathItem,
			);

			subPaths.forEach((sub) => {
				const requestType = getRequestBodyType(
					sub.requestBody,
					this.parser.config,

					this.parser.schemas.map((s) => s.name),
				);

				const responseKeys = Object.keys(sub.responses!);

				const responseType = getResponseType(
					sub.responses?.[responseKeys[0]],
					this.parser.config,

					this.parser.schemas.map((s) => s.name),
				);

				registerModel(requestType);

				const interfaceName = `${pascalCase(webhookName)}${pascalCase(sub.method)}Payload`;

				webhooksFound.push({
					name: webhookName,
					method: sub.method,
					interfaceName,
					pathItem: webhookPathItem,
					requestType,
					responseType,
					scope,
				});

				addTypeAliasOnce(interfaceName, requestType, [
					`Payload definition for webhook '${webhookName}' (${sub.method}).`,
				]);
			});
		};

		const rootWebhooks = this.parser.spec.webhooks || {};

		Object.entries(rootWebhooks).forEach(([webhookName, pathItemOrRef]) => {
			processWebhookEntry(webhookName, pathItemOrRef as PathItem, "root");
		});

		const componentWebhooks = this.parser.spec.components?.webhooks || {};

		Object.entries(componentWebhooks).forEach(
			([webhookName, pathItemOrRef]) => {
				processWebhookEntry(
					webhookName,
					pathItemOrRef as PathItem,
					"component",
				);
			},
		);

		if (webhooksFound.length > 0) {
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
						name: "API_WEBHOOKS",
						initializer: JSON.stringify(
							webhooksFound.map((c) => ({
								name: c.name,
								method: c.method,
								interfaceName: c.interfaceName,
								pathItem: c.pathItem,
								scope: c.scope,
							})),
							null,
							2,
						),
					},
				],
				docs: ["Metadata registry for identified webhooks."],
			});
		} else {
			sourceFile.addStatements("export {};");
		}

		sourceFile.formatText();

		sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);
	}

	/**
	 * Extracts `PathInfo` operations from a webhook `PathItem`.
	 *
	 * @param name - Webhook key name.
	 * @param pathItem - Webhook `PathItem` definition.
	 * @returns Array of extracted `PathInfo` operations.
	 */
	private processWebhookPathItem(name: string, pathItem: PathItem): PathInfo[] {
		const tempMap = { [name]: pathItem };
		// Pass the main components to ensure strict resolution if webhooks define security

		const resolveRef = this.parser.resolveReference.bind(this.parser);

		const resolveObj = this.parser.resolve.bind(this.parser) as (
			obj: OpenApiValue,
		) => OpenApiValue;

		return extractPaths(
			tempMap,
			resolveRef,
			this.parser.spec.components,
			undefined,
			resolveObj,
		);
	}
}
