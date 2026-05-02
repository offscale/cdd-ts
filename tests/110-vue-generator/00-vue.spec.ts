import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VueClientGenerator } from '../../src/vendors/vue/vue-client.generator.js';
import { FetchClientGenerator } from '../../src/vendors/fetch/fetch-client.generator.js';
import { Project } from 'ts-morph';
import { SwaggerParser } from '../../src/openapi/parse.js';
import { GeneratorConfig } from '../../src/core/types/index.js';

describe('Vue Implementation', () => {
    beforeEach(() => {
        vi.spyOn(FetchClientGenerator.prototype, 'generate').mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should generate Vue composables for services', async () => {
        const project = new Project();
        const config = { options: { admin: false } } as GeneratorConfig;

        const spec = {
            openapi: '3.1.0',
            info: { title: 'Test API', version: '1.0.0' },
            paths: {
                '/users': {
                    get: {
                        tags: ['Users'],
                        operationId: 'getUsers',
                        responses: {
                            '200': { description: 'Success' },
                        },
                    },
                    post: {
                        tags: ['Users'],
                        operationId: 'createUser',
                        responses: {
                            '201': { description: 'Created' },
                        },
                    },
                },
                '/untagged': {
                    get: {
                        operationId: 'getUntagged',
                        responses: {
                            '200': { description: 'Success' },
                        },
                    },
                },
                '/': {
                    get: {
                        operationId: 'getRoot',
                        responses: {
                            '200': { description: 'Success' },
                        },
                    },
                },
            },
        };

        const parser = new SwaggerParser(spec, config);
        const generator = new VueClientGenerator();

        await generator.generate(project, parser, config, '/output');

        const composablesIndex = project.getSourceFile('/output/composables/index.ts');
        expect(composablesIndex).toBeDefined();
        expect(composablesIndex!.getFullText()).toContain('export { useUsersService } from "./users.composable.js";');

        const composableFile = project.getSourceFile('/output/composables/users.composable.ts');
        expect(composableFile).toBeDefined();
        const composableText = composableFile!.getFullText();
        expect(composableText).toContain(`import { UsersService } from "../services/users.service.js";`);
        expect(composableText).toContain(`export function useUsersService() {`);
        expect(composableText).toContain(`return new UsersService();`);

        expect(FetchClientGenerator.prototype.generate).toHaveBeenCalled();
    });
});
