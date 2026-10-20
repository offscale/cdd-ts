/**
 * Module for service generator in vendors/fetch/service/service.generator.
 *
 * @module vendors/fetch/service/service.generator
 */
import type { Project, SourceFile } from "ts-morph";
import type { GeneratorConfig, PathInfo } from "../../../core/types/index.js";
import { AbstractServiceGenerator } from "../../../functions/emit_service.js";
import { pascalCase } from "../../../functions/utils.js";
import type { SwaggerParser } from "../../../openapi/parse.js";
import { FetchServiceMethodGenerator } from "./service-method.generator.js";

/**
 * Specialized Service Generator for the native fetch implementation.
 * It produces an ES class containing fetch methods for all mapped OpenAPI endpoints.
 */
export class FetchServiceGenerator extends AbstractServiceGenerator {
	private methodGenerator: FetchServiceMethodGenerator;

	/**
	 * Instantiates a FetchServiceGenerator.
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
		this.methodGenerator = new FetchServiceMethodGenerator(
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
		const fw = (this.config.options.framework || "").toLowerCase();
		if (fw === "vanilla js" || fw === "vanilla" || fw === "vanillajs") {
			return `${controllerName}.client.ts`;
		}
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
			moduleSpecifier: "../utils/parameter-serializer",
			namedImports: ["ParameterSerializer"],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: "../utils/server-url",
			namedImports: ["getServerUrl"],
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
		const fwLower = (this.config.options.framework || "").toLowerCase();
		const className =
			fwLower === "vanilla js" ||
			fwLower === "vanilla" ||
			fwLower === "vanillajs"
				? `${pascalCase(controllerName)}Client`
				: `${pascalCase(controllerName)}Service`;

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
