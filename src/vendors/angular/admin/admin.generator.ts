import * as path from "node:path";
import type { GeneratorConfig } from "@src/core/types/config.js";
import type { Resource } from "@src/core/types/index.js";
import type { SwaggerParser } from "@src/openapi/parse.js";
import { discoverAdminResources } from "@src/vendors/angular/admin/resource-discovery.js";
import type { Project } from "ts-morph";
import { AdminTestGenerator } from "./admin-test.generator.js";
import { CustomValidatorsGenerator } from "./custom-validators.generator.js";
import { ElementsGenerator } from "./elements.generator.js";
import { FormComponentGenerator } from "./form-component.generator.js";
import { I18nGenerator } from "./i18n.generator.js";
import { ListComponentGenerator } from "./list-component.generator.js";
import { RoutingGenerator } from "./routing.generator.js";

/**
 * Main coordinator for generating the Angular Admin Interface.
 * It discovers admin-compatible resources and delegates to specific component generators.
 */
export class AdminGenerator {
	private allResources: Resource[] = [];

	constructor(
		private parser: SwaggerParser,

		private project: Project,

		private config?: GeneratorConfig,
	) {}

	/**
	 * Executes the admin generation process.
	 * @param outputRoot The root directory path for generation.
	 */
	public generate(outputRoot: string): void {
		console.log("🚀 Generating Admin UI...");

		this.allResources = discoverAdminResources(this.parser);

		if (this.allResources.length === 0) {
			console.warn(
				"⚠️ No resources suitable for admin UI generation were found. Skipping.",
			);

			return;
		}

		// Use standard node path to respect OS separators, ensuring checks and creation work reliably.
		// Note: In ts-morph in-memory FS, consistent separators are preferred, but Node paths help with cross-OS test consistency.

		const adminDir = path.join(outputRoot, "admin");

		// Ensure directory creation in the project filesystem

		if (!this.project.getFileSystem().directoryExistsSync(adminDir)) {
			this.project.getFileSystem().mkdirSync(adminDir);
		}

		const formGen = new FormComponentGenerator(this.project, this.parser);

		const listGen = new ListComponentGenerator(this.project);

		const routeGen = new RoutingGenerator(this.project);

		const validatorGen = new CustomValidatorsGenerator(this.project);

		const elementsGen = new ElementsGenerator(this.project);

		const i18nGen = new I18nGenerator(this.project);

		const testGen = new AdminTestGenerator(this.project);

		let needsCustomValidators = false;

		const shouldGenerateTests =
			this.config?.options?.tests ??
			this.config?.options?.generateAdminTests ??
			false;

		for (const resource of this.allResources) {
			console.log(`  -> Generating for resource: ${resource.name}`);

			const resourceDir = path.join(adminDir, resource.name);

			if (resource.operations.some((op) => op.action === "list")) {
				listGen.generate(resource, adminDir);
			}

			if (resource.isEditable) {
				const formResult = formGen.generate(resource, adminDir);

				if (formResult.usesCustomValidators) {
					needsCustomValidators = true;
				}
			}

			routeGen.generate(resource, adminDir);

			if (shouldGenerateTests) {
				testGen.generate(resource, resourceDir);
			}
		}

		routeGen.generateMaster(this.allResources, adminDir);

		console.log("  -> Generating i18n service...");
		i18nGen.generate(adminDir);

		if (needsCustomValidators) {
			console.log("  -> Generating shared custom validators...");

			validatorGen.generate(adminDir);
		}

		console.log("  -> Generating Web Components (Elements) registration...");

		elementsGen.generate(this.allResources, adminDir);

		console.log("✅ Admin UI generation complete.");
	}
}
