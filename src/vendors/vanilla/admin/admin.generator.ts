/**
 * Module for admin generator in vendors/vanilla/admin/admin.generator.
 *
 * @module vendors/vanilla/admin/admin.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";
import { discoverAdminResources } from "../../../core/admin/resource-discovery.js";
import { type Resource, resolveLogger } from "../../../core/types/index.js";
import type { SwaggerParser } from "../../../openapi/parse.js";
import { AppShellGenerator } from "./app-shell.generator.js";
import { FormComponentGenerator } from "./form-component.generator.js";
import { ListComponentGenerator } from "./list-component.generator.js";

/** Generator/utility class `VanillaAdminGenerator`. */
export class VanillaAdminGenerator {
	private allResources: Resource[] = [];

	/**
	 * Creates a new `VanillaAdminGenerator` instance.
	 * @param parser - Parsed OpenAPI specification instance.
	 * @param project - Target `ts-morph` project instance.
	 */
	constructor(
		private parser: SwaggerParser,

		private project: Project,
	) {}

	/**
	 * Executes `generate` on `VanillaAdminGenerator`.
	 * @param outputRoot - Parameter `outputRoot` (string).
	 */
	public generate(outputRoot: string): void {
		const logger = resolveLogger(this.parser.config);
		logger.info("🚀 Generating Vanilla Web Components Admin UI...");

		this.allResources = discoverAdminResources(this.parser);

		if (this.allResources.length === 0) {
			logger.warn(
				"⚠️ No resources suitable for admin UI generation were found. Skipping.",
			);

			return;
		}

		const adminDir = path.join(outputRoot, "admin");

		if (!this.project.getFileSystem().directoryExistsSync(adminDir)) {
			this.project.getFileSystem().mkdirSync(adminDir);
		}

		const listGen = new ListComponentGenerator(this.project);

		const formGen = new FormComponentGenerator(this.project);

		const appShellGen = new AppShellGenerator(this.project);

		for (const resource of this.allResources) {
			logger.info(`  -> Generating for resource: ${resource.name}`);

			if (resource.operations.some((op) => op.action === "list")) {
				listGen.generate(resource, adminDir);
			}

			if (resource.isEditable) {
				formGen.generate(resource, adminDir);
			}
		}

		logger.info("  -> Generating App Shell (Router & Layout)...");

		appShellGen.generate(this.allResources, adminDir);

		logger.info("✅ Vanilla Admin UI generation complete.");
	}
}
