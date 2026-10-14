/**
 * Abstract base generator for service client classes and hooks.
 *
 * @module functions/emit_service
 */
import * as path from "node:path";
import type { Project, SourceFile } from "ts-morph";
import { SERVICE_GENERATOR_HEADER_COMMENT } from "../core/constants.js";
import type { GeneratorConfig, PathInfo } from "../core/types/index.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { camelCase } from "./utils.js";

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

		sourceFile.addStatements(SERVICE_GENERATOR_HEADER_COMMENT);

		// 1. Abstraction: Generate Imports

		this.generateImports(sourceFile, operations);

		const usedNames = new Set<string>();

		// 2. Normalize Operation Names

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

		// 3. Abstraction: Generate Class/Function Body

		this.generateServiceContent(sourceFile, cleanControllerName, operations);

		sourceFile.formatText();
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
