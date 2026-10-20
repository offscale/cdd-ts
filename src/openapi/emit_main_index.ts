/**
 * Shared barrel (`index.ts`) generators for SDK services and root package entrypoints across Fetch, Axios, and Node client generators.
 *
 * @module openapi/emit_main_index
 */
import { posix as path } from "node:path";
import type { Project } from "ts-morph";
import type { GeneratorConfig } from "../core/types/index.js";
import type { SwaggerParser } from "./parse.js";

/**
 * Discovers and writes a `services/index.ts` barrel file aggregating generated client service classes.
 */
export class SdkServiceIndexGenerator {
	/**
	 * Creates a new `SdkServiceIndexGenerator`.
	 *
	 * @param project - The active `ts-morph` Project AST environment.
	 */
	constructor(private project: Project) {}

	/**
	 * Generates `services/index.ts` exporting all generated `.service.ts` and `.client.ts` classes.
	 *
	 * @param outputRoot - Root output directory of the generated SDK.
	 */
	public generateIndex(outputRoot: string): void {
		const servicesDir = path.join(outputRoot, "services");
		const absServicesDir = path.resolve(servicesDir);

		const serviceFiles = this.project.getSourceFiles().filter((sf) => {
			const absFileDir = path.resolve(path.dirname(sf.getFilePath()));
			return (
				absFileDir === absServicesDir &&
				(sf.getFilePath().endsWith(".service.ts") ||
					sf.getFilePath().endsWith(".client.ts"))
			);
		});

		if (serviceFiles.length === 0) return;

		const indexPath = path.join(servicesDir, "index.ts");
		const sourceFile = this.project.createSourceFile(indexPath, "", {
			overwrite: true,
		});

		for (const serviceFile of serviceFiles) {
			const serviceClass = serviceFile.getClasses()[0];
			const className = serviceClass?.getName();
			if (serviceClass?.isExported() && className) {
				const moduleSpecifier = `./${path.basename(serviceFile.getFilePath(), ".ts")}`;
				sourceFile.addExportDeclaration({
					namedExports: [className],
					moduleSpecifier,
				});
			}
		}

		sourceFile.formatText();
	}
}

/**
 * Generates the root `index.ts` export barrel for a generated SDK package.
 */
export class SdkMainIndexGenerator {
	/**
	 * Creates a new `SdkMainIndexGenerator`.
	 *
	 * @param project - The active `ts-morph` Project AST environment.
	 * @param config - The generator configuration options.
	 * @param parser - The parsed OpenAPI specification.
	 */
	constructor(
		private project: Project,
		private config: GeneratorConfig,
		private parser: SwaggerParser,
	) {}

	/**
	 * Generates the root `index.ts` file inside `outputRoot`.
	 *
	 * @param outputRoot - Root output directory of the generated SDK.
	 */
	public generateMainIndex(outputRoot: string): void {
		const indexPath = path.join(outputRoot, "index.ts");
		const sourceFile = this.project.createSourceFile(indexPath, "", {
			overwrite: true,
		});

		if (this.parser.schemas.length > 0) {
			sourceFile.addExportDeclaration({ moduleSpecifier: "./models" });
		}

		if (this.config.options.generateServices ?? true) {
			sourceFile.addExportDeclaration({ moduleSpecifier: "./services" });
		}

		sourceFile.addExportDeclaration({ moduleSpecifier: "./utils/server-url" });
		sourceFile.addExportDeclaration({
			moduleSpecifier: "./utils/parameter-serializer",
		});

		sourceFile.formatText();
	}
}
