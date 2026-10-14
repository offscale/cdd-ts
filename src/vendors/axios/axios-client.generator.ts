/**
 * Orchestrates the generation of an Axios-based API client SDK.
 *
 * @module vendors/axios/axios-client.generator
 */
import { posix as path } from "node:path";
import type { Project } from "ts-morph";
import { AbstractClientGenerator } from "../../core/generator.js";
import type { GeneratorConfig } from "../../core/types/index.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { VanillaAdminGenerator } from "../vanilla/admin/admin.generator.js";
import { AxiosServiceGenerator } from "./service/service.generator.js";
import { AxiosServiceTestGenerator } from "./test/service-test.generator.js";
import {
	AxiosMainIndexGenerator,
	AxiosServiceIndexGenerator,
} from "./utils/index.generator.js";

/**
 * Generates an entire API client using the axios implementation.
 * It coordinates the generation of models, utility functions, and the
 * axios-specific service classes.
 */
export class AxiosClientGenerator extends AbstractClientGenerator {
	/**
	 * Executes the generation pipeline for the axios client.
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
		// 1 & 2. Shared Models and Core OpenAPI Metadata
		this.generateSharedCore(project, parser, config, outputRoot);

		// 3. Services and Axios Specifics
		if (config.options.generateServices ?? true) {
			const servicesDir = path.join(outputRoot, "services");
			const controllerGroups = this.groupOperationsByController(parser);

			new AxiosServiceGenerator(parser, project, config).generate(
				servicesDir,
				controllerGroups,
			);

			new AxiosServiceIndexGenerator(project).generateIndex(outputRoot);

			const shouldGenerateTests =
				config.options.tests ?? config.options.generateServiceTests ?? false;
			if (shouldGenerateTests) {
				const testGenerator = new AxiosServiceTestGenerator(
					parser,
					project,
					config,
				);

				for (const [controllerName, operations] of Object.entries(
					controllerGroups,
				)) {
					testGenerator.generateServiceTestFile(
						controllerName,
						operations,
						servicesDir,
					);
				}

				console.log("✅ Axios Service tests generated.");
			}

			if (config.options.admin) {
				new VanillaAdminGenerator(parser, project).generate(outputRoot);
			}
		}

		new AxiosMainIndexGenerator(project, config, parser).generateMainIndex(
			outputRoot,
		);
	}
}
