/**
 * Abstract contracts and base template class for framework-specific SDK generators.
 *
 * @module core/generator
 */
import { posix as path } from "node:path";
import type { Project } from "ts-morph";
import { TypeGenerator } from "../classes/emit.js";
import { DiscriminatorGenerator } from "../classes/emit_discriminator.js";
import { CallbackGenerator } from "../functions/emit_callback.js";
import { ParameterSerializerGenerator } from "../functions/emit_parameter_serializer.js";
import { WebhookGenerator } from "../functions/emit_webhook.js";
import { pascalCase } from "../functions/utils.js";
import { ExamplesGenerator } from "../mocks/emit.js";
import { DocumentMetaGenerator } from "../openapi/emit_document_meta.js";
import { HeadersGenerator } from "../openapi/emit_headers.js";
import { IdpAuthHelperGenerator } from "../openapi/emit_idp_auth.js";
import { InfoGenerator } from "../openapi/emit_info.js";
import { LinkGenerator } from "../openapi/emit_link.js";
import {
	SdkMainIndexGenerator,
	SdkServiceIndexGenerator,
} from "../openapi/emit_main_index.js";
import { MediaTypesGenerator } from "../openapi/emit_media_types.js";
import { RequestBodiesGenerator } from "../openapi/emit_request_bodies.js";
import { ResponsesGenerator } from "../openapi/emit_responses.js";
import { SecurityGenerator } from "../openapi/emit_security.js";
import { SpecSnapshotGenerator } from "../openapi/emit_snapshot.js";
import { TagGenerator } from "../openapi/emit_tag.js";
import type { SwaggerParser } from "../openapi/parse.js";
import { PathsGenerator } from "../routes/emit.js";
import { ParametersGenerator } from "../routes/emit_parameters.js";
import { PathItemsGenerator } from "../routes/emit_path_items.js";
import { ServerGenerator } from "../routes/emit_server.js";
import { ServerUrlGenerator } from "../routes/emit_server_url.js";
import { McpGenerator } from "../vendors/mcp/emit.js";
import { VanillaAdminGenerator } from "../vendors/vanilla/admin/admin.generator.js";
import type { PathInfo } from "./types/analysis.js";
import type { GeneratorConfig } from "./types/config.js";

/**
 * Contract for a transport-specific service generator invoked by `AbstractClientGenerator`.
 */
export interface HttpServiceEmitter {
	/**
	 * Emits service files into `servicesDir`.
	 *
	 * @param servicesDir - Target `services/` directory.
	 * @param controllerGroups - Map of controller names to operations.
	 */
	generate(
		servicesDir: string,
		controllerGroups: Record<string, PathInfo[]>,
	): void;
}

/**
 * Contract for a transport-specific service unit test generator invoked by `AbstractClientGenerator`.
 */
export interface HttpServiceTestEmitter {
	/**
	 * Emits unit tests for a single controller service.
	 *
	 * @param controllerName - Name of the controller.
	 * @param operations - Operations belonging to the controller.
	 * @param servicesDir - Target `services/` directory.
	 */
	generateServiceTestFile(
		controllerName: string,
		operations: PathInfo[],
		servicesDir: string,
	): void;
}

/**
 * Hooks for configuring the shared HTTP client SDK orchestration pipeline.
 */
export interface HttpClientPipelineHooks {
	/**
	 * Optional hook to emit transport-specific utility files before service generation.
	 *
	 * @param project - The active `ts-morph` Project.
	 * @param outputRoot - Root output directory.
	 */
	generateTransportExtras?(project: Project, outputRoot: string): void;
	/**
	 * Factory returning the transport-specific service generator.
	 *
	 * @param parser - Parsed OpenAPI specification.
	 * @param project - The active `ts-morph` Project.
	 * @param config - Generator configuration.
	 * @returns A service generator implementing `HttpServiceEmitter`.
	 */
	createServiceGenerator(
		parser: SwaggerParser,
		project: Project,
		config: GeneratorConfig,
	): HttpServiceEmitter;
	/**
	 * Factory returning the transport-specific service unit test generator.
	 *
	 * @param parser - Parsed OpenAPI specification.
	 * @param project - The active `ts-morph` Project.
	 * @param config - Generator configuration.
	 * @returns A service test generator implementing `HttpServiceTestEmitter`.
	 */
	createServiceTestGenerator(
		parser: SwaggerParser,
		project: Project,
		config: GeneratorConfig,
	): HttpServiceTestEmitter;
	/**
	 * Optional hook invoked after service unit tests are generated (e.g. for integration test generation).
	 *
	 * @param controllerGroups - Map of controller names to operations.
	 * @param outputRoot - Root output directory.
	 */
	afterServiceTests?(
		controllerGroups: Record<string, PathInfo[]>,
		outputRoot: string,
	): void;
}

/**
 * Abstract contracts for framework-specific generators.
 */
export interface IClientGenerator {
	/**
	 * Execute the generation process.
	 * @param project - The active ts-morph project.
	 * @param parser - The parsed OpenAPI specification.
	 * @param config - The generation configuration.
	 * @param outputDir - The root directory for the output.
	 */
	generate(
		project: Project,
		parser: SwaggerParser,
		config: GeneratorConfig,
		outputDir: string,
	): void;
}

/**
 * Base class for Client Generators providing shared OpenAPI metadata, model, and controller grouping helpers.
 */
export abstract class AbstractClientGenerator implements IClientGenerator {
	/**
	 * Determines the canonical PascalCase controller name for an OpenAPI operation.
	 *
	 * @param op - The parsed PathInfo operation.
	 * @returns The PascalCase controller name.
	 */
	public static getControllerCanonicalName(op: PathInfo): string {
		if (Array.isArray(op.tags) && op.tags[0]) {
			return pascalCase(op.tags[0].toString());
		}

		const firstSegment = op.path.split("/").filter(Boolean)[0];

		return firstSegment ? pascalCase(firstSegment) : "Default";
	}

	/**
	 * Groups all operations from the parser by their canonical controller name.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @returns A map of controller names to their operations.
	 */
	public static groupPathsByCanonicalController(
		parser: SwaggerParser,
	): Record<string, PathInfo[]> {
		const groups: Record<string, PathInfo[]> = {};

		for (const op of parser.operations) {
			const group = AbstractClientGenerator.getControllerCanonicalName(op);

			if (!groups[group]) groups[group] = [];

			groups[group].push(op);
		}

		return groups;
	}

	/**
	 * Groups all operations from the parser by their canonical controller name (instance helper).
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @returns A map of controller names to their operations.
	 */
	protected groupOperationsByController(
		parser: SwaggerParser,
	): Record<string, PathInfo[]> {
		return AbstractClientGenerator.groupPathsByCanonicalController(parser);
	}

	/**
	 * Generates all framework-agnostic core models and OpenAPI metadata files (`models/`, `info.ts`, `servers.ts`, `security.ts`, `links.ts`, `callbacks.ts`, `webhooks.ts`, `discriminators.ts`, `tags.ts`, `examples.ts`, `media-types.ts`, `paths.ts`, `path-items.ts`, `headers.ts`, `parameters.ts`, `request-bodies.ts`, `responses.ts`, `document.ts`, `openapi.snapshot.json`, `utils/server-url.ts`, `utils/parameter-serializer.ts`).
	 *
	 * @param project - The active ts-morph project.
	 * @param parser - The parsed OpenAPI specification.
	 * @param config - The generator configuration.
	 * @param outputRoot - The root output directory.
	 */
	protected generateSharedCore(
		project: Project,
		parser: SwaggerParser,
		config: GeneratorConfig,
		outputRoot: string,
	): void {
		new TypeGenerator(parser, project, config).generate(outputRoot);
		new InfoGenerator(parser, project).generate(outputRoot);
		new ServerGenerator(parser, project).generate(outputRoot);
		new ServerUrlGenerator(parser, project).generate(outputRoot);
		new ParameterSerializerGenerator(project).generate(outputRoot);
		new IdpAuthHelperGenerator(project).generate(outputRoot);
		new CallbackGenerator(parser, project).generate(outputRoot);
		new WebhookGenerator(parser, project).generate(outputRoot);
		new LinkGenerator(parser, project).generate(outputRoot);
		new DiscriminatorGenerator(parser, project).generate(outputRoot);
		new SecurityGenerator(parser, project).generate(outputRoot);
		new TagGenerator(parser, project).generate(outputRoot);
		new ExamplesGenerator(parser, project).generate(outputRoot);
		new MediaTypesGenerator(parser, project).generate(outputRoot);
		new PathsGenerator(parser, project).generate(outputRoot);
		new PathItemsGenerator(parser, project).generate(outputRoot);
		new HeadersGenerator(parser, project).generate(outputRoot);
		new ParametersGenerator(parser, project).generate(outputRoot);
		new RequestBodiesGenerator(parser, project).generate(outputRoot);
		new ResponsesGenerator(parser, project).generate(outputRoot);
		new DocumentMetaGenerator(parser, project).generate(outputRoot);
		new SpecSnapshotGenerator(parser, project).generate(outputRoot);
	}

	/**
	 * Executes the shared HTTP client SDK pipeline (models, metadata, transport utilities, services, service index, unit tests, Vanilla Admin UI, MCP, and main index).
	 *
	 * @param project - The active `ts-morph` project.
	 * @param parser - The parsed OpenAPI specification.
	 * @param config - The generator configuration.
	 * @param outputRoot - The root output directory.
	 * @param hooks - Transport-specific factory hooks.
	 */
	protected generateHttpClientPipeline(
		project: Project,
		parser: SwaggerParser,
		config: GeneratorConfig,
		outputRoot: string,
		hooks: HttpClientPipelineHooks,
	): void {
		this.generateSharedCore(project, parser, config, outputRoot);
		hooks.generateTransportExtras?.(project, outputRoot);

		if (config.options.generateServices ?? true) {
			const servicesDir = path.join(outputRoot, "services");
			const controllerGroups = this.groupOperationsByController(parser);

			hooks
				.createServiceGenerator(parser, project, config)
				.generate(servicesDir, controllerGroups);

			new SdkServiceIndexGenerator(project).generateIndex(outputRoot);

			const shouldGenerateTests =
				config.options.tests ?? config.options.generateServiceTests ?? false;
			if (shouldGenerateTests) {
				const testGenerator = hooks.createServiceTestGenerator(
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
				hooks.afterServiceTests?.(controllerGroups, outputRoot);
			}

			if (config.options.admin) {
				new VanillaAdminGenerator(parser, project).generate(outputRoot);
			}

			if (config.options.mcp) {
				new McpGenerator().generate(project, parser, config, outputRoot);
			}
		}

		new SdkMainIndexGenerator(project, config, parser).generateMainIndex(
			outputRoot,
		);
	}

	/**
	 * Executes the generation pipeline for the target framework.
	 *
	 * @param project - The active ts-morph project.
	 * @param parser - The parsed OpenAPI specification.
	 * @param config - The generator configuration.
	 * @param outputDir - The root directory for the output.
	 */
	abstract generate(
		project: Project,
		parser: SwaggerParser,
		config: GeneratorConfig,
		outputDir: string,
	): void;
}
