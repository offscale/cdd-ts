/**
 * Orchestrates the generation of a React SWR-based API client SDK.
 *
 * @module vendors/react/react-client.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import {
	AbstractClientGenerator,
	type IClientGenerator,
} from "../../core/generator.js";
import type { GeneratorConfig } from "../../core/types/index.js";
import { ServiceMethodAnalyzer } from "../../functions/parse_analyzer.js";
import { camelCase, pascalCase } from "../../functions/utils.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { FetchClientGenerator } from "../fetch/fetch-client.generator.js";
import { ReactAdminGenerator } from "./admin/admin.generator.js";
import { ReactHookTestGenerator } from "./test/hook-test.generator.js";

/**
 * Generates a React-based API client.
 * It delegates to the Fetch client generation (or an injected `IClientGenerator`) as the foundation,
 * and then generates React-specific SWR hooks for each service.
 */
export class ReactClientGenerator extends AbstractClientGenerator {
	private readonly baseGenerator: IClientGenerator;

	/**
	 * Creates a new `ReactClientGenerator`.
	 *
	 * @param baseGenerator - Optional underlying HTTP client generator delegate (defaults to `FetchClientGenerator`).
	 */
	constructor(baseGenerator?: IClientGenerator) {
		super();
		this.baseGenerator = baseGenerator ?? new FetchClientGenerator();
	}

	/**
	 * Executes the generation pipeline for the React client.
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

		if (config.options?.admin) {
			const adminGenerator = new ReactAdminGenerator(parser, project, config);
			adminGenerator.generate(outputRoot);
		}

		project.createSourceFile(
			path.join(outputRoot, "provider.tsx"),
			`
import React, { createContext, useContext, ReactNode } from 'react';

export interface ApiConfig {
    basePath?: string;
    headers?: Record<string, string>;
    server?: number | string;
    serverVariables?: Record<string, string>;
}

const ApiContext = createContext<ApiConfig>({});

export const ApiProvider = ({ config, children }: { config: ApiConfig; children: ReactNode }) => (
    <ApiContext.Provider value={config}>
        {children}
    </ApiContext.Provider>
);

export const useApiContext = () => useContext(ApiContext);
        `.trim(),
			{ overwrite: true },
		);

		const hooksDir = path.join(outputRoot, "hooks");
		const hooksIndex = project.createSourceFile(
			path.join(hooksDir, "index.ts"),
			`export * from '../provider.js';
`,
			{ overwrite: true },
		);

		const operationsByController = this.groupOperationsByController(parser);
		const analyzer = new ServiceMethodAnalyzer(config, parser);

		for (const [controllerName, operations] of Object.entries(
			operationsByController,
		)) {
			const serviceName = `${pascalCase(controllerName)}Service`;
			const hookName = `use${serviceName}`;
			const fileName = `${camelCase(controllerName)}.hook.ts`;
			const filePath = path.join(hooksDir, fileName);

			const hookFile = project.createSourceFile(filePath, "", {
				overwrite: true,
			});

			hookFile.addImportDeclarations([
				{
					moduleSpecifier: "react",
					namedImports: ["useState"],
				},
				{
					moduleSpecifier: "swr",
					defaultImport: "useSWR",
					namedImports: ["SWRConfiguration"],
				},
				{
					moduleSpecifier: "swr/mutation",
					defaultImport: "useSWRMutation",
					namedImports: ["SWRMutationConfiguration"],
				},
				{
					moduleSpecifier: `../services/${camelCase(controllerName)}.service.js`,
					namedImports: [serviceName],
				},
				{
					moduleSpecifier: "../provider.js",
					namedImports: ["useApiContext"],
				},
			]);

			hookFile.addFunction({
				name: hookName,
				isExported: true,
				statements: `const [service] = useState(() => new ${serviceName}());
return service;`,
			});

			const usedNames = new Set<string>();

			for (const op of operations) {
				let suggestedName =
					op.methodName ||
					op.operationId ||
					camelCase(
						`${op.method.toLowerCase()}_${op.path.replace(/[^\w]/g, " ")}`,
					);
				if (
					suggestedName.includes("-") ||
					!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(suggestedName)
				) {
					suggestedName = camelCase(suggestedName.replace(/[^\w]/g, " "));
				}

				let finalName = suggestedName;
				let counter = 2;
				while (usedNames.has(finalName)) {
					finalName = `${suggestedName}${counter++}`;
				}
				usedNames.add(finalName);
				op.methodName = finalName;

				const model = analyzer.analyze(op)!;

				const isGet = model.httpMethod.toLowerCase() === "get";
				const methodHookName = `use${pascalCase(model.methodName)}`;
				const returnType = model.responseType;

				const paramList = model.parameters
					.map((p) => `${p.name}: ${p.type}`)
					.join(", ");
				const paramArgs = model.parameters.map((p) => p.name).join(", ");
				const cacheKey = `['${model.methodName}', ${paramArgs ? paramArgs : "''"}]`;
				const executionArgs = paramArgs
					? `${paramArgs}, apiConfig`
					: "apiConfig";

				if (isGet) {
					hookFile.addFunction({
						name: methodHookName,
						isExported: true,
						parameters: [
							...model.parameters,
							{
								name: "config",
								type: `SWRConfiguration<${returnType}, Error>`,
								hasQuestionToken: true,
							},
						],
						statements: `
                            const [service] = useState(() => new ${serviceName}());
                            const apiConfig = useApiContext();
                            return useSWR(
                                ${cacheKey},
                                () => service.${model.methodName}(${executionArgs}),
                                config
                            );
                        `,
					});
				} else {
					const mutationArgType = paramList
						? `{ ${paramList} }`
						: "Record<string, never>";
					hookFile.addFunction({
						name: methodHookName,
						isExported: true,
						parameters: [
							{
								name: "config",
								type: `SWRMutationConfiguration<${returnType}, Error, string, ${mutationArgType}>`,
								hasQuestionToken: true,
							},
						],
						statements: `
                            const [service] = useState(() => new ${serviceName}());
                            const apiConfig = useApiContext();
                            return useSWRMutation(
                                '${model.methodName}',
                                (key, { arg }: { arg: ${mutationArgType} }) => service.${model.methodName}(${model.parameters.map((p) => `arg.${p.name}`).join(", ") || ""}${model.parameters.length > 0 ? ", apiConfig" : "apiConfig"}),
                                config
                            );
                        `,
					});
				}
			}

			hookFile.formatText();

			hooksIndex.addExportDeclaration({
				moduleSpecifier: `./${fileName.replace(".ts", ".js")}`,
				namedExports: [hookName],
			});
		}
		hooksIndex.formatText();

		const shouldGenerateTests =
			config.options.tests ?? config.options.generateServiceTests ?? false;
		if (shouldGenerateTests) {
			const testGenerator = new ReactHookTestGenerator(parser, project, config);
			for (const controllerName of Object.keys(operationsByController)) {
				testGenerator.generateHookTestFile(controllerName, hooksDir);
			}
		}
	}
}
