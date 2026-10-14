/**
 * Module for elements generator in vendors/angular/admin/elements.generator.
 *
 * @module vendors/angular/admin/elements.generator
 */
import type { Project } from "ts-morph";
import type { Resource } from "../../../core/types/index.js";
import { camelCase, pascalCase } from "../../../functions/utils.js";

/** Generator/utility class `ElementsGenerator`. */
export class ElementsGenerator {
	/**
	 * Creates a new `ElementsGenerator` instance.
	 * @param project - Target `ts-morph` project instance.
	 */
	constructor(private readonly project: Project) {}

	/**
	 * Executes `generate` on `ElementsGenerator`.
	 * @param resources - List of analyzed API resources.
	 * @param outDir - Target output directory path.
	 */
	public generate(resources: Resource[], outDir: string): void {
		const filePath = `${outDir}/elements.ts`;

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "@angular/core",
			namedImports: ["Injector"],
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "@angular/elements",
			namedImports: ["createCustomElement"],
		});

		// Import components

		const componentNames: string[] = [];

		for (const resource of resources) {
			const hasList = resource.operations.some((op) => op.action === "list");

			const hasForm = resource.isEditable;

			if (hasList) {
				const className = `${pascalCase(resource.name)}ListComponent`;

				sourceFile.addImportDeclaration({
					moduleSpecifier: `./${resource.name}/${resource.name}-list/${resource.name}-list.component`,
					namedImports: [className],
				});

				componentNames.push(className);
			}

			if (hasForm) {
				const className = `${pascalCase(resource.name)}FormComponent`;

				sourceFile.addImportDeclaration({
					moduleSpecifier: `./${resource.name}/${resource.name}-form/${resource.name}-form.component`,
					namedImports: [className],
				});

				componentNames.push(className);
			}
		}

		// Generate registration function

		const body = componentNames
			.map((name) => {
				const tag = `app-${camelCase(name)
					.replace(/([A-Z])/g, "-$1")
					.toLowerCase()}`;

				return `
        const ${name}Element = createCustomElement(${name}, { injector });
        if (!customElements.get('${tag}')) {
            customElements.define('${tag}', ${name}Element);
        }`;
			})
			.join("\n");

		sourceFile.addFunction({
			isExported: true,
			name: "registerAdminWebComponents",
			parameters: [{ name: "injector", type: "Injector" }],
			statements: body,
		});
	}
}
