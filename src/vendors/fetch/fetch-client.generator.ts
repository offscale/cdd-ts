/**
 * Orchestrates the generation of a native Fetch API client SDK.
 *
 * @module vendors/fetch/fetch-client.generator
 */
import type { Project } from "ts-morph";
import { AbstractClientGenerator } from "../../core/generator.js";
import type { GeneratorConfig } from "../../core/types/index.js";
import { MultipartBuilderGenerator } from "../../functions/emit_multipart.js";
import { ContentDecoderGenerator } from "../../openapi/emit_content_decoder.js";
import { ContentEncoderGenerator } from "../../openapi/emit_content_encoder.js";
import { XmlBuilderGenerator } from "../../openapi/emit_xml_builder.js";
import { XmlParserGenerator } from "../../openapi/emit_xml_parser.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { FetchServiceGenerator } from "./service/service.generator.js";
import { FetchServiceTestGenerator } from "./test/service-test.generator.js";

/**
 * Generates an entire API client using the native fetch implementation.
 * It coordinates the generation of models, utility functions, and the
 * fetch-specific service classes.
 */
export class FetchClientGenerator extends AbstractClientGenerator {
	/**
	 * Executes the generation pipeline for the fetch client.
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
			generateTransportExtras: (proj, out) => {
				new ContentEncoderGenerator(proj).generate(out);
				new ContentDecoderGenerator(proj).generate(out);
				new XmlBuilderGenerator(proj).generate(out);
				new XmlParserGenerator(proj).generate(out);
				new MultipartBuilderGenerator(proj).generate(out);
			},
			createServiceGenerator: (p, proj, cfg) =>
				new FetchServiceGenerator(p, proj, cfg),
			createServiceTestGenerator: (p, proj, cfg) =>
				new FetchServiceTestGenerator(p, proj, cfg),
		});
	}
}
