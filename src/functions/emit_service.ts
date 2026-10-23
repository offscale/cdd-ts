/**
 * Abstract base generator for service client classes and hooks.
 *
 * @module functions/emit_service
 */
import * as path from "node:path";
import {
	type ClassDeclaration,
	type Project,
	Scope,
	type SourceFile,
} from "ts-morph";
import type {
	GeneratorConfig,
	PathInfo,
	SwaggerDefinition,
} from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { camelCase, getTypeScriptType, isDataTypeInterface } from "./utils.js";

/**
 * Converts a string into a valid camelCase TypeScript identifier.
 *
 * @param name - Raw input name.
 * @returns Valid camelCase identifier.
 */
function toTsIdentifier(name: string): string {
	return camelCase(name.replace(/[^\w]/g, " "));
}

/**
 * Abstract Base Generator for Service Clients.
 * Handles the orchestration of looping through controllers and operations.
 * Subclasses implement the actual code generation logic (Angular, React, etc).
 */
export abstract class AbstractServiceGenerator {
	/**
	 * Creates a new `AbstractServiceGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project.
	 * @param config - Generator configuration options.
	 */
	constructor(
		protected parser: SwaggerParser,
		protected project: Project,
		protected config: GeneratorConfig,
	) {}

	/**
	 * Main entry point. Loops through grouped paths and creates service files.
	 *
	 * @param outputDir - Target directory for generated service files.
	 * @param groups - Operations grouped by controller name.
	 */
	public generate(outputDir: string, groups: Record<string, PathInfo[]>): void {
		for (const [controllerName, operations] of Object.entries(groups)) {
			this.generateServiceFile(controllerName, operations, outputDir);
		}
	}

	/**
	 * Generates a single service file/hook/class.
	 *
	 * @param controllerName - Name of the controller group.
	 * @param operations - Operations belonging to the controller.
	 * @param outputDir - Target directory for the generated file.
	 */
	protected generateServiceFile(
		controllerName: string,
		operations: PathInfo[],
		outputDir: string,
	): void {
		const cleanControllerName = toTsIdentifier(controllerName);
		const fileName = this.getFileName(cleanControllerName);
		const filePath = path.join(outputDir, fileName);

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		this.generateImports(sourceFile, operations);

		const usedNames = new Set<string>();
		for (const op of operations) {
			let suggestedName = op.methodName;

			if (this.config.options.customizeMethodName && op.operationId) {
				suggestedName = this.config.options.customizeMethodName(op.operationId);
			}

			if (!suggestedName) {
				if (op.operationId) {
					suggestedName = toTsIdentifier(op.operationId);
				} else {
					suggestedName = toTsIdentifier(
						`${op.method.toLowerCase()}_${op.path}`,
					);
				}
			} else if (
				suggestedName.includes("-") ||
				!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(suggestedName)
			) {
				suggestedName = toTsIdentifier(suggestedName);
			}

			let finalName = suggestedName;
			let counter = 2;

			while (usedNames.has(finalName)) {
				finalName = `${suggestedName}${counter++}`;
			}

			usedNames.add(finalName);
			op.methodName = finalName;
		}

		this.generateServiceContent(sourceFile, cleanControllerName, operations);
		sourceFile.formatText();
	}

	/**
	 * Collects and adds model import declarations (`../models`) referenced by the given operations' responses, parameters, and JSON request bodies.
	 *
	 * @param sourceFile - Target `SourceFile`.
	 * @param operations - Operations belonging to the controller.
	 */
	protected addOperationModelImports(
		sourceFile: SourceFile,
		operations: PathInfo[],
	): void {
		const knownTypes = this.parser.schemas.map((s) => s.name);
		const modelImports = new Set<string>();

		for (const op of operations) {
			for (const resp of Object.values(
				op.responses as Record<
					string,
					{ content?: Record<string, { schema?: SwaggerDefinition | boolean }> }
				>,
			)) {
				if (resp.content) {
					Object.values(resp.content).forEach((media) => {
						const typeName = getTypeScriptType(
							media.schema as SwaggerDefinition,
							this.config,
							knownTypes,
						).replace(/\[\]| \| null/g, "");
						if (isDataTypeInterface(typeName)) {
							modelImports.add(typeName);
						}
					});
				}
			}

			op.parameters?.forEach((param) => {
				const paramType = getTypeScriptType(
					param.schema as SwaggerDefinition,
					this.config,
					knownTypes,
				).replace(/\[\]| \| null/g, "");
				if (isDataTypeInterface(paramType)) {
					modelImports.add(paramType);
				}
			});

			if (op.requestBody?.content?.["application/json"]?.schema) {
				const bodyType = getTypeScriptType(
					op.requestBody.content["application/json"]
						.schema as SwaggerDefinition,
					this.config,
					knownTypes,
				).replace(/\[\]| \| null/g, "");
				if (isDataTypeInterface(bodyType)) {
					modelImports.add(bodyType);
				}
			}
		}

		const validModels = Array.from(modelImports).filter(
			(m: string) => /^[A-Z]/.test(m) && !["Date", "Blob", "File"].includes(m),
		);

		if (validModels.length > 0) {
			sourceFile.addImportDeclaration({
				moduleSpecifier: "../models",
				namedImports: validModels,
			});
		}
	}

	/**
	 * Adds the standard `private basePath = ""` property and `constructor(basePath?: string)` to a generated HTTP service class.
	 *
	 * @param serviceClass - Target `ClassDeclaration`.
	 */
	protected addBasePathPropertyAndConstructor(
		serviceClass: ClassDeclaration,
	): void {
		serviceClass.addProperty({
			name: "basePath",
			scope: Scope.Private,
			initializer: '""',
		});

		serviceClass.addProperty({
			name: "auth",
			scope: Scope.Public,
			isReadonly: true,
			type: "SdkAuthClient",
		});

		serviceClass.addConstructor({
			parameters: [
				{ name: "basePath", type: "string", hasQuestionToken: true },
			],
			statements: [
				"this.basePath = basePath || getServerUrl(0, {});",
				"this.auth = new SdkAuthClient(this.basePath);",
			],
		});
	}

	/**
	 * Returns the filename (e.g. `users.service.ts` or `useUsers.ts`).
	 *
	 * @param controllerName - Clean camelCase controller name.
	 * @returns Relative file path for the generated service file.
	 */
	protected abstract getFileName(controllerName: string): string;

	/**
	 * Emits implementation-specific import declarations into the service source file.
	 *
	 * @param sourceFile - Target `SourceFile`.
	 * @param operations - Operations belonging to the controller.
	 */
	protected abstract generateImports(
		sourceFile: SourceFile,
		operations: PathInfo[],
	): void;

	/**
	 * Emits implementation-specific class, function, or hook declarations into the service source file.
	 *
	 * @param sourceFile - Target `SourceFile`.
	 * @param controllerName - Clean camelCase controller name.
	 * @param operations - Operations belonging to the controller.
	 */
	protected abstract generateServiceContent(
		sourceFile: SourceFile,
		controllerName: string,
		operations: PathInfo[],
	): void;
}
