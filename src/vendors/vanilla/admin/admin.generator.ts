import * as path from "node:path";
import type { Resource } from "@src/core/types/index.js";

import type { SwaggerParser } from "@src/openapi/parse.js";
import { discoverAdminResources } from "@src/vendors/angular/admin/resource-discovery.js";
import type { Project } from "ts-morph";
import { AppShellGenerator } from "./app-shell.generator.js";
import { FormComponentGenerator } from "./form-component.generator.js";
import { ListComponentGenerator } from "./list-component.generator.js";

export class VanillaAdminGenerator {
	private allResources: Resource[] = [];

	constructor(
		private parser: SwaggerParser,

		private project: Project,
	) {}

	public generate(outputRoot: string): void {
		console.log("🚀 Generating Vanilla Web Components Admin UI...");

		this.allResources = discoverAdminResources(this.parser);

		if (this.allResources.length === 0) {
			console.warn(
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
			console.log(`  -> Generating for resource: ${resource.name}`);

			if (resource.operations.some((op) => op.action === "list")) {
				listGen.generate(resource, adminDir);
			}

			if (resource.isEditable) {
				formGen.generate(resource, adminDir);
			}
		}

		console.log("  -> Generating App Shell (Router & Layout)...");

		appShellGen.generate(this.allResources, adminDir);

		console.log("✅ Vanilla Admin UI generation complete.");
	}
}
