/**
 * Generates TypeScript model interfaces, enums, and type aliases from OpenAPI schemas, webhooks, callbacks, links, and response headers.
 *
 * @module classes/emit
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import type {
	GeneratorConfig,
	SwaggerDefinition,
} from "../core/types/index.js";
import { pascalCase } from "../functions/utils.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { generateEnum, generateTypeAlias } from "./emit_enums.js";
import { emitInlineOperationTypes } from "./emit_inline_operation_types.js";
import {
	generateInterface,
	shouldGenerateInterface,
} from "./emit_interfaces.js";

/**
 * Generates TypeScript model definitions under `models/` and re-exports them via `models/index.ts`.
 */
export class TypeGenerator {
	/**
	 * Creates a new `TypeGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification wrapper.
	 * @param project - The target `ts-morph` project.
	 * @param config - Active generator configuration.
	 */
	constructor(
		private parser: SwaggerParser,
		private project: Project,
		private config: GeneratorConfig,
	) {}

	/**
	 * Generates all model files and `models/index.ts` under the specified output directory.
	 *
	 * @param outputDir - Root directory for generated output files.
	 */
	public generate(outputDir: string): void {
		const modelsDir = path.join(outputDir, "models");
		const indexFilePath = path.join(modelsDir, "index.ts");
		const indexSourceFile = this.project.createSourceFile(indexFilePath, "", {
			overwrite: true,
		});

		const definitions = this.parser.schemas;
		const generatedFileNames = new Set<string>();

		const getFile = (name: string) => {
			const safeName = pascalCase(name);
			const filePath = path.join(modelsDir, `${safeName}.ts`);
			let sf = this.project.getSourceFile(filePath);
			if (!sf) {
				sf = this.project.createSourceFile(filePath, "", { overwrite: true });
				generatedFileNames.add(safeName);
			}
			return sf;
		};

		const processDefinition = (
			name: string,
			def: SwaggerDefinition | boolean,
		) => {
			const sourceFile = getFile(name);
			if (typeof def === "boolean") {
				generateTypeAlias(sourceFile, name, def, this.config, this.parser);
				return;
			}

			if (def.enum) {
				generateEnum(sourceFile, name, def, this.config);
			} else if (shouldGenerateInterface(def)) {
				generateInterface(sourceFile, name, def, this.config, this.parser);
			} else {
				generateTypeAlias(sourceFile, name, def, this.config, this.parser);
			}
		};

		// 1. Type Definitions
		definitions.forEach((def) => {
			processDefinition(def.name, def.definition);
		});

		// 2-5. Webhooks, Callbacks, Links, and Response Headers
		emitInlineOperationTypes(
			this.parser,
			this.config,
			getFile,
			processDefinition,
		);

		// Finalize files: format them and add cross-imports
		const allNames = Array.from(generatedFileNames);
		allNames.forEach((name) => {
			indexSourceFile.addExportDeclaration({ moduleSpecifier: `./${name}.js` });
			const sf = this.project.getSourceFileOrThrow(
				path.join(modelsDir, `${name}.ts`),
			);
			const otherNames = allNames.filter((n) => n !== name);
			if (otherNames.length > 0) {
				sf.insertImportDeclaration(0, {
					isTypeOnly: true,
					moduleSpecifier: "./index.js",
					namedImports: otherNames,
				});
			}
			sf.formatText();
		});
		indexSourceFile.formatText();
	}
}
