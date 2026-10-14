/**
 * Abstract contracts and base template class for framework-specific SDK generators.
 *
 * @module core/generator
 */
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
import { InfoGenerator } from "../openapi/emit_info.js";
import { LinkGenerator } from "../openapi/emit_link.js";
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
import type { PathInfo } from "./types/analysis.js";
import type { GeneratorConfig } from "./types/config.js";

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
