/**
 * Orchestrates the generation of an Angular SDK client, services, interceptors, tokens, tests, and Admin UI.
 *
 * @module vendors/angular/angular-client.generator
 */
import { posix as path } from "node:path";
import type { Project } from "ts-morph";
import { AbstractClientGenerator } from "../../core/generator.js";
import type { GeneratorConfig } from "../../core/types/index.js";
import { MultipartBuilderGenerator } from "../../functions/emit_multipart.js";
import { camelCase } from "../../functions/utils.js";
import { ContentDecoderGenerator } from "../../openapi/emit_content_decoder.js";
import { ContentEncoderGenerator } from "../../openapi/emit_content_encoder.js";
import { ResponseHeaderRegistryGenerator } from "../../openapi/emit_response_header_registry.js";
import { XmlBuilderGenerator } from "../../openapi/emit_xml_builder.js";
import { XmlParserGenerator } from "../../openapi/emit_xml_parser.js";
import type { SwaggerParser } from "../../openapi/parse.js";
import { AdminGenerator } from "./admin/admin.generator.js";
import { AdminTestGenerator } from "./admin/admin-test.generator.js";
import { discoverAdminResources } from "./admin/resource-discovery.js";
import { ServiceGenerator } from "./service/service.generator.js";
import { IntegrationTestGenerator } from "./test/integration-test.generator.js";
import { ServiceTestGenerator } from "./test/service-test-generator.js";
import { AuthInterceptorGenerator } from "./utils/auth-interceptor.generator.js";
import { AuthTokensGenerator } from "./utils/auth-tokens.generator.js";
import { BaseInterceptorGenerator } from "./utils/base-interceptor.generator.js";
import { DateTransformerGenerator } from "./utils/date-transformer.generator.js";
import { ExtensionTokensGenerator } from "./utils/extension-tokens.generator.js";
import { FileDownloadGenerator } from "./utils/file-download.generator.js";
import { HttpParamsBuilderGenerator } from "./utils/http-params-builder.generator.js";
import {
	MainIndexGenerator,
	ServiceIndexGenerator,
} from "./utils/index.generator.js";
import { LinkServiceGenerator } from "./utils/link-service.generator.js";
import { LinkSetParserGenerator } from "./utils/link-set-parser.generator.js";
import { OAuthHelperGenerator } from "./utils/oauth-helper.generator.js";
import { ProviderGenerator } from "./utils/provider.generator.js";
import { RequestContextGenerator } from "./utils/request-context.generator.js";
import { ResponseHeaderParserGenerator } from "./utils/response-header-parser.generator.js";
import { TokenGenerator } from "./utils/token.generator.js";
import { WebhookHelperGenerator } from "./utils/webhook-helper.generator.js";

/**
 * Generates an Angular-based API client SDK.
 */
export class AngularClientGenerator extends AbstractClientGenerator {
	/**
	 * Executes the generation pipeline for the Angular client.
	 *
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
		console.log("✅ Models generated.");

		// 3. Services and Angular Specifics
		if (config.options.generateServices ?? true) {
			const servicesDir = path.join(outputRoot, "services");
			const controllerGroups = this.groupOperationsByController(parser);

			new ServiceGenerator(parser, project, config).generate(
				servicesDir,
				controllerGroups,
			);

			new ServiceIndexGenerator(project).generateIndex(outputRoot);
			console.log("✅ Services generated.");

			new TokenGenerator(project, config.clientName).generate(outputRoot);
			new RequestContextGenerator(project).generate(outputRoot);
			new ExtensionTokensGenerator(project).generate(outputRoot);
			new HttpParamsBuilderGenerator(project).generate(outputRoot);
			new FileDownloadGenerator(project).generate(outputRoot);
			new XmlBuilderGenerator(project).generate(outputRoot);
			new XmlParserGenerator(project).generate(outputRoot);
			new ContentDecoderGenerator(project).generate(outputRoot);
			new ContentEncoderGenerator(project).generate(outputRoot);
			new MultipartBuilderGenerator(project).generate(outputRoot);
			new LinkServiceGenerator(parser, project).generate(outputRoot);
			new ResponseHeaderRegistryGenerator(parser, project).generate(outputRoot);
			new LinkSetParserGenerator(project).generate(outputRoot);
			new ResponseHeaderParserGenerator(project).generate(outputRoot);
			new WebhookHelperGenerator(parser, project).generate(outputRoot);

			if (config.options.dateType === "Date") {
				new DateTransformerGenerator(project).generate(outputRoot);
			}

			const securitySchemes = parser.getSecuritySchemes();
			let tokenNames: string[] = [];

			if (Object.keys(securitySchemes).length > 0) {
				new AuthTokensGenerator(project).generate(outputRoot);

				const interceptorGenerator = new AuthInterceptorGenerator(
					parser,
					project,
				);
				const interceptorResult = interceptorGenerator.generate(outputRoot);
				tokenNames = interceptorResult?.tokenNames || [];

				if (Object.values(securitySchemes).some((s) => s.type === "oauth2")) {
					new OAuthHelperGenerator(parser, project).generate(outputRoot);
				}
			}

			new BaseInterceptorGenerator(project, config.clientName).generate(
				outputRoot,
			);
			new ProviderGenerator(parser, project, tokenNames).generate(outputRoot);
			console.log("✅ Utilities and providers generated.");

			const shouldGenerateTests =
				config.options.tests ?? config.options.generateServiceTests ?? false;
			if (shouldGenerateTests) {
				console.log("📝 Generating tests for services...");

				const testGenerator = new ServiceTestGenerator(parser, project, config);
				const integrationTestGen = new IntegrationTestGenerator(
					parser,
					project,
				);

				const controllerGroupsForTest =
					this.groupOperationsByController(parser);

				for (const [controllerName, operations] of Object.entries(
					controllerGroupsForTest,
				)) {
					for (const op of operations) {
						if (!op.methodName && op.operationId) {
							op.methodName = camelCase(op.operationId);
						}
					}

					testGenerator.generateServiceTestFile(
						controllerName,
						operations,
						servicesDir,
					);
				}

				integrationTestGen.generate(
					controllerGroupsForTest,
					outputRoot,
					config.clientName,
				);

				console.log("✅ Service tests generated.");
			}

			if (config.options.admin) {
				new AdminGenerator(parser, project, config).generate(outputRoot);

				const shouldGenerateAdminTests =
					config.options.tests ?? config.options.generateAdminTests ?? false;

				if (shouldGenerateAdminTests) {
					console.log("📝 Generating tests for admin UI...");

					const adminTestGen = new AdminTestGenerator(project);
					const adminResources = discoverAdminResources(parser);

					for (const resource of adminResources) {
						adminTestGen.generate(resource, path.join(outputRoot, "admin"));
					}

					console.log("✅ Admin UI tests generated.");
				}
			}
		}

		new MainIndexGenerator(project, config, parser).generateMainIndex(
			outputRoot,
		);

		console.log(
			`🎉 Generation complete! Output written to: ${path.resolve(outputRoot)}`,
		);
	}
}
