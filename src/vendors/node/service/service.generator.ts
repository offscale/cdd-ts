/**
 * Module for service generator in vendors/node/service/service.generator.
 *
 * @module vendors/node/service/service.generator
 */
import type { Project, SourceFile } from "ts-morph";
import type { GeneratorConfig, PathInfo } from "../../../core/types/index.js";
import { AbstractServiceGenerator } from "../../../functions/emit_service.js";
import { pascalCase } from "../../../functions/utils.js";
import type { SwaggerParser } from "../../../openapi/parse.js";
import { NodeServiceMethodGenerator } from "./service-method.generator.js";

/**
 * Specialized Service Generator for the Node.js implementation.
 * It produces an ES class containing node methods for all mapped OpenAPI endpoints.
 */
export class NodeServiceGenerator extends AbstractServiceGenerator {
	private methodGenerator: NodeServiceMethodGenerator;

	/**
	 * Instantiates a NodeServiceGenerator.
	 * @param parser - The OpenAPI specification parser.
	 * @param project - The ts-morph project holding the AST.
	 * @param config - The global generator config object.
	 */
	constructor(
		parser: SwaggerParser,
		project: Project,
		config: GeneratorConfig,
	) {
		super(parser, project, config);
		this.methodGenerator = new NodeServiceMethodGenerator(
			this.config,
			this.parser,
		);
	}

	/**
	 * Determines the output file name for the generated service class.
	 * @param controllerName - The canonical group name.
	 * @returns The generated TypeScript file name.
	 */
	protected getFileName(controllerName: string): string {
		return `${controllerName}.service.ts`;
	}

	/**
	 * Discovers all required dependencies and writes import declarations at the top of the output source file.
	 * @param sourceFile - The generated source file.
	 * @param operations - The group of paths/operations the service will implement.
	 */
	protected generateImports(
		sourceFile: SourceFile,
		operations: PathInfo[],
	): void {
		sourceFile.addImportDeclaration({
			moduleSpecifier: "node:http",
			namespaceImport: "http",
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "node:https",
			namespaceImport: "https",
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "node:url",
			namedImports: ["URL"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "../utils/parameter-serializer",
			namedImports: ["ParameterSerializer"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "../utils/server-url",
			namedImports: ["getServerUrl", "resolveServerUrl"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "../utils/auth-session",
			namedImports: ["SdkAuthClient"],
		});
		this.addOperationModelImports(sourceFile, operations);
	}

	/**
	 * Builds the service class skeleton and populates its member variables and methods.
	 * @param sourceFile - The generated source file.
	 * @param controllerName - The canonical group name.
	 * @param operations - The group of paths/operations the service will implement.
	 */
	protected generateServiceContent(
		sourceFile: SourceFile,
		controllerName: string,
		operations: PathInfo[],
	): void {
		const className = `${pascalCase(controllerName)}Service`;
		const serviceClass = sourceFile.addClass({
			name: className,
			isExported: true,
		});

		this.addBasePathPropertyAndConstructor(serviceClass);

		for (const op of operations) {
			this.methodGenerator.addServiceMethod(serviceClass, op);
		}
	}
}
