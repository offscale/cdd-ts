/**
 * Orchestrates the generation of an Axios-based API client SDK.
 *
 * @module vendors/axios/axios-client.generator
 */
import type { Project } from "ts-morph";
import { AbstractClientGenerator } from "../../core/generator.js";
import type { GeneratorConfig } from "../../core/types/index.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { AxiosServiceGenerator } from "./service/service.generator.js";
import { AxiosServiceTestGenerator } from "./test/service-test.generator.js";

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
		this.generateHttpClientPipeline(project, parser, config, outputRoot, {
			createServiceGenerator: (p, proj, cfg) =>
				new AxiosServiceGenerator(p, proj, cfg),
			createServiceTestGenerator: (p, proj, cfg) =>
				new AxiosServiceTestGenerator(p, proj, cfg),
		});
	}
}
