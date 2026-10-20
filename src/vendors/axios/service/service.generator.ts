/**
 * Module for service generator in vendors/axios/service/service.generator.
 *
 * @module vendors/axios/service/service.generator
 */
import {
	type ClassDeclaration,
	type Project,
	Scope,
	type SourceFile,
} from "ts-morph";
import type { GeneratorConfig, PathInfo } from "../../../core/types/index.js";
import { AbstractServiceGenerator } from "../../../functions/emit_service.js";
import { pascalCase } from "../../../functions/utils.js";
import type { SwaggerParser } from "../../../openapi/parse.js";
import { AxiosServiceMethodGenerator } from "./service-method.generator.js";

/**
 * Specialized Service Generator for the axios implementation.
 * It produces an ES class containing axios methods for all mapped OpenAPI endpoints.
 */
export class AxiosServiceGenerator extends AbstractServiceGenerator {
	private methodGenerator: AxiosServiceMethodGenerator;

	/**
	 * Instantiates an AxiosServiceGenerator.
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
		this.methodGenerator = new AxiosServiceMethodGenerator(
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
			moduleSpecifier: "axios",
			defaultImport: "axios",
			namedImports: ["AxiosInstance", "AxiosRequestConfig"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "../utils/parameter-serializer",
			namedImports: ["ParameterSerializer"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "../utils/server-url",
			namedImports: ["getServerUrl", "resolveServerUrl"],
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

		this.addPropertiesAndHelpers(serviceClass);

		for (const op of operations) {
			this.methodGenerator.addServiceMethod(serviceClass, op);
		}
	}

	/**
	 * Injects the standard variables (`basePath`, `axiosInstance`) and constructor logic.
	 * @param serviceClass - The `ts-morph` class representation of the service.
	 */
	private addPropertiesAndHelpers(serviceClass: ClassDeclaration): void {
		serviceClass.addProperty({
			name: "basePath",
			scope: Scope.Private,
			initializer: '""',
		});

		serviceClass.addProperty({
			name: "axiosInstance",
			scope: Scope.Private,
			type: "AxiosInstance",
		});

		serviceClass.addConstructor({
			parameters: [
				{ name: "basePath", type: "string", hasQuestionToken: true },
				{
					name: "axiosInstance",
					type: "AxiosInstance",
					hasQuestionToken: true,
				},
			],
			statements: [
				"this.basePath = basePath || getServerUrl(0, {});",
				"this.axiosInstance = axiosInstance || axios.create();",
			],
		});
	}
}
