import { Project } from 'ts-morph';
import * as path from 'node:path';

import { SwaggerParser } from '@src/openapi/parse.js';
import { discoverAdminResources } from '@src/vendors/angular/admin/resource-discovery.js';
import { Resource } from '@src/core/types/index.js';

import { ListComponentGenerator } from './list-component.generator.js';
import { FormComponentGenerator } from './form-component.generator.js';
import { RoutingGenerator } from './routing.generator.js';
import { CustomValidatorsGenerator } from './custom-validators.generator.js';
import { StylingBuilder } from './styling.builder.js';
import { AdminTestGenerator } from './admin-test.generator.js';
import { I18nGenerator } from './i18n.generator.js';

/**
 * Main coordinator for generating the React Admin Interface.
 * It discovers admin-compatible resources and delegates to specific React component generators.
 */
export class ReactAdminGenerator {
    private allResources: Resource[] = [];

    /**
     * Initializes a new ReactAdminGenerator.
     * @param parser The parsed OpenAPI specification.
     * @param project The ts-morph project for writing source files.
     */
    constructor(
        private parser: SwaggerParser,
        private project: Project,
    ) {}

    /**
     * Executes the admin generation process for React.
     * @param outputRoot The root directory path for generation.
     */
    public async generate(outputRoot: string): Promise<void> {
        console.log('🚀 Generating React Admin UI...');

        this.allResources = discoverAdminResources(this.parser);

        if (this.allResources.length === 0) {
            console.warn('⚠️ No resources suitable for admin UI generation were found. Skipping.');
            return;
        }

        const adminDir = path.posix.join(outputRoot, 'admin');

        if (!this.project.getFileSystem().directoryExistsSync(adminDir)) {
            this.project.getFileSystem().mkdirSync(adminDir);
        }

        const listGen = new ListComponentGenerator(this.project);
        const formGen = new FormComponentGenerator(this.project);
        const routeGen = new RoutingGenerator(this.project);
        const validatorGen = new CustomValidatorsGenerator(this.project);
        const testGen = new AdminTestGenerator(this.project);
        const styleGen = new StylingBuilder(this.project);
        const i18nGen = new I18nGenerator(this.project);

        let needsValidators = false;

        for (const resource of this.allResources) {
            console.log(`  -> Generating for resource: ${resource.name}`);

            const resourceDir = path.posix.join(adminDir, resource.name);

            if (resource.operations.some(op => op.action === 'list')) {
                listGen.generate(resource, adminDir);
                testGen.generate(`${resource.name}-list`, resourceDir);
                styleGen.generateCss(`${resource.name}-list`, resourceDir);
            }

            if (resource.isEditable) {
                formGen.generate(resource, adminDir);
                testGen.generate(`${resource.name}-form`, resourceDir);
                styleGen.generateCss(`${resource.name}-form`, resourceDir);
                needsValidators = true;
            }

            routeGen.generate(resource, adminDir);
        }

        if (needsValidators) {
            validatorGen.generate(adminDir);
        }

        console.log('  -> Generating i18n hooks...');
        i18nGen.generate(adminDir);

        console.log('  -> Generating React App Routing (App Shell)...');
        routeGen.generateMaster(this.allResources, adminDir);

        console.log('✅ React Admin UI generation complete.');
    }
}
