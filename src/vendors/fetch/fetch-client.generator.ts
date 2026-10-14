/**
 * Orchestrates the generation of a native Fetch API client SDK.
 *
 * @module vendors/fetch/fetch-client.generator
 */
import { posix as path } from "node:path";
import type { Project } from "ts-morph";
import { AbstractClientGenerator } from "../../core/generator.js";
import type { GeneratorConfig } from "../../core/types/index.js";
import { MultipartBuilderGenerator } from "../../functions/emit_multipart.js";
import { ContentDecoderGenerator } from "../../openapi/emit_content_decoder.js";
import { ContentEncoderGenerator } from "../../openapi/emit_content_encoder.js";
import { XmlBuilderGenerator } from "../../openapi/emit_xml_builder.js";
import { XmlParserGenerator } from "../../openapi/emit_xml_parser.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { McpGenerator } from "../mcp/emit.js";
import { VanillaAdminGenerator } from "../vanilla/admin/admin.generator.js";
import { FetchServiceGenerator } from "./service/service.generator.js";
import { FetchServiceTestGenerator } from "./test/service-test.generator.js";
import {
	FetchMainIndexGenerator,
	FetchServiceIndexGenerator,
} from "./utils/index.generator.js";

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
		// 1 & 2. Shared Models and Core OpenAPI Metadata
		this.generateSharedCore(project, parser, config, outputRoot);

		new ContentEncoderGenerator(project).generate(outputRoot);
		new ContentDecoderGenerator(project).generate(outputRoot);
		new XmlBuilderGenerator(project).generate(outputRoot);
		new XmlParserGenerator(project).generate(outputRoot);
		new MultipartBuilderGenerator(project).generate(outputRoot);

		// 3. Services and Fetch Specifics
		if (config.options.generateServices ?? true) {
			const servicesDir = path.join(outputRoot, "services");
			const controllerGroups = this.groupOperationsByController(parser);

			new FetchServiceGenerator(parser, project, config).generate(
				servicesDir,
				controllerGroups,
			);

			new FetchServiceIndexGenerator(project).generateIndex(outputRoot);

			const shouldGenerateTests =
				config.options.tests ?? config.options.generateServiceTests ?? false;
			if (shouldGenerateTests) {
				const testGenerator = new FetchServiceTestGenerator(
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

				console.log("✅ Fetch Service tests generated.");
			}

			if (config.options.admin) {
				new VanillaAdminGenerator(parser, project).generate(outputRoot);
			}

			if (config.options.mcp) {
				new McpGenerator().generate(project, parser, config, outputRoot);
			}
		}

		new FetchMainIndexGenerator(project, config, parser).generateMainIndex(
			outputRoot,
		);
	}
}
