/**
 * Orchestrates the generation of a Vue 3 Composable & Plugin API client SDK.
 *
 * @module vendors/vue/vue-client.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import {
	AbstractClientGenerator,
	type IClientGenerator,
} from "../../core/generator.js";
import type { GeneratorConfig } from "../../core/types/index.js";
import { camelCase, pascalCase } from "../../functions/utils.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { FetchClientGenerator } from "../fetch/fetch-client.generator.js";
import { VueAdminGenerator } from "./admin/admin.generator.js";
import { VueComposableTestGenerator } from "./test/composable-test.generator.js";

/**
 * Generates a Vue-based API client.
 * It delegates to the Fetch client generation (or an injected `IClientGenerator`) as the foundation,
 * and then generates Vue-specific composables for each service.
 */
export class VueClientGenerator extends AbstractClientGenerator {
	private readonly baseGenerator: IClientGenerator;

	/**
	 * Creates a new `VueClientGenerator`.
	 *
	 * @param baseGenerator - Optional underlying HTTP client generator delegate (defaults to `FetchClientGenerator`).
	 */
	constructor(baseGenerator?: IClientGenerator) {
		super();
		this.baseGenerator = baseGenerator ?? new FetchClientGenerator();
	}

	/**
	 * Executes the generation pipeline for the Vue client.
	 * @param project - The ts-morph Project to use for generation.
	 * @param parser - The parsed Swagger/OpenAPI model.
	 * @param config - The generator configuration options.
	 * @param outputRoot - The target output directory.
	 */
	public generate(
		project: Project,
		parser: SwaggerParser,
		config: GeneratorConfig,
		outputRoot: string,
	): void {
		this.baseGenerator.generate(project, parser, config, outputRoot);

		if (config.options.admin) {
			new VueAdminGenerator(parser, project, config).generate(outputRoot);
		}

		const composablesDir = path.join(outputRoot, "composables");
		const composablesIndex = project.createSourceFile(
			path.join(composablesDir, "index.ts"),
			"",
			{
				overwrite: true,
			},
		);

		const pluginFile = project.createSourceFile(
			path.join(outputRoot, "plugin.ts"),
			"",
			{ overwrite: true },
		);
		pluginFile.addImportDeclarations([
			{ moduleSpecifier: "vue", namedImports: ["App", "InjectionKey"] },
		]);

		const operationsByController = this.groupOperationsByController(parser);

		const serviceImports: string[] = [];
		const injectionKeys: string[] = [];
		const provideStatements: string[] = [];

		for (const controllerName of Object.keys(operationsByController)) {
			const serviceName = `${pascalCase(controllerName)}Service`;
			const hookName = `use${serviceName}`;
			const injectionKeyName = `${serviceName}Key`;
			const fileName = `${camelCase(controllerName)}.composable.ts`;
			const filePath = path.join(composablesDir, fileName);

			serviceImports.push(
				`import { ${serviceName} } from './services/${camelCase(controllerName)}.service.js';`,
			);
			injectionKeys.push(
				`export const ${injectionKeyName}: InjectionKey<${serviceName}> = Symbol('${serviceName}');`,
			);
			provideStatements.push(
				`app.provide(${injectionKeyName}, new ${serviceName}(options?.config));`,
			);

			const hookFile = project.createSourceFile(filePath, "", {
				overwrite: true,
			});

			hookFile.addImportDeclarations([
				{
					moduleSpecifier: "vue",
					namedImports: ["inject"],
				},
				{
					moduleSpecifier: `../plugin.js`,
					namedImports: [injectionKeyName],
				},
				{
					moduleSpecifier: `../services/${camelCase(controllerName)}.service.js`,
					namedImports: [serviceName],
				},
			]);

			hookFile.addStatements(
				[
					`/**`,
					` * Injects the ${serviceName} instance.`,
					` * Ensure the API plugin is installed in your Vue app.`,
					` * @returns The ${serviceName} instance.`,
					` * @throws If the service is not provided.`,
					` */`,
					`export function ${hookName}(): ${serviceName} {`,
					`    const service = inject(${injectionKeyName});`,
					`    if (!service) {`,
					`        throw new globalThis.Error('API Client not installed. Please use the ApiClientPlugin in your Vue app.');`,
					`    }`,
					`    return service;`,
					`}`,
				].join(String.fromCharCode(10)),
			);
			hookFile.formatText();

			composablesIndex.addExportDeclaration({
				moduleSpecifier: `./${fileName.replace(".ts", ".js")}`,
				namedExports: [hookName],
			});
		}
		composablesIndex.formatText();

		const shouldGenerateTests =
			config.options.tests ?? config.options.generateServiceTests ?? false;
		if (shouldGenerateTests) {
			const testGenerator = new VueComposableTestGenerator(
				parser,
				project,
				config,
			);
			for (const controllerName of Object.keys(operationsByController)) {
				testGenerator.generateComposableTestFile(
					controllerName,
					composablesDir,
				);
			}
		}

		pluginFile.addStatements(`
${serviceImports.join(String.fromCharCode(10))}

${injectionKeys.join(String.fromCharCode(10))}

/**
 * Configuration options for the API Client Plugin.
 */
export interface ApiClientPluginOptions {
    /**
     * Optional base path configuration to pass to the services.
     */
    config?: string;
}

/**
 * Vue Plugin to provide API services.
 */
export const ApiClientPlugin = {
    install(app: App, options?: ApiClientPluginOptions) {
${provideStatements.map((stmt) => `        ${stmt}`).join(String.fromCharCode(10))}
    }
};
        `);
		pluginFile.formatText();

		// Export plugin from main index
		const mainIndexFilePath = path.join(outputRoot, "index.ts");
		const mainIndexFile = project.getSourceFile(mainIndexFilePath);
		if (mainIndexFile) {
			mainIndexFile.addExportDeclaration({
				moduleSpecifier: "./plugin.js",
			});
			mainIndexFile.formatText();
		}
	}
}
