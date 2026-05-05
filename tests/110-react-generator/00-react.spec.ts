import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactClientGenerator } from '../../src/vendors/react/react-client.generator.js';
import { FetchClientGenerator } from '../../src/vendors/fetch/fetch-client.generator.js';
import { Project } from 'ts-morph';
import { SwaggerParser } from '../../src/openapi/parse.js';
import { GeneratorConfig } from '../../src/core/types/index.js';

describe('React Implementation', () => {
    beforeEach(() => {
        vi.spyOn(FetchClientGenerator.prototype, 'generate').mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should generate React hooks for services', async () => {
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
                        parameters: [
                            {
                                name: 'body',
                                in: 'query',
                                schema: { type: 'string' },
                            },
                        ],
                        responses: {
                            '201': { description: 'Created' },
                        },
                    },
                },
                '/foo-bar': {
                    get: {
                        tags: ['Collision'],
                        responses: {
                            '200': { description: 'Success' },
                        },
                    },
                },
                '/foo_bar': {
                    get: {
                        tags: ['Collision'],
                        responses: {
                            '200': { description: 'Success' },
                        },
                    },
                },
                '/invalid-chars': {
                    get: {
                        tags: ['Invalid'],
                        operationId: 'my-invalid-name!',
                        responses: {
                            '200': { description: 'Success' },
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
                    post: {
                        operationId: 'postUntagged',
                        responses: {
                            '201': { description: 'Created' },
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
        const generator = new ReactClientGenerator();

        await generator.generate(project, parser, config, '/output');

        const hooksIndex = project.getSourceFile('/output/hooks/index.ts');
        expect(hooksIndex).toBeDefined();
        expect(hooksIndex!.getFullText()).toContain('export { useUsersService } from "./users.hook.js";');

        const hookFile = project.getSourceFile('/output/hooks/users.hook.ts');
        expect(hookFile).toBeDefined();
        const hookText = hookFile!.getFullText();
        console.log('HOOK TEXT:', hookText);
        expect(hookText).toContain(`import { useState } from "react";`);
        expect(hookText).toContain(`import { useApiContext } from "../provider.js";`);
        expect(hookText).toContain(`import { UsersService } from "../services/users.service.js";`);
        expect(hookText).toContain(`export function useUsersService()`);
        expect(hookText).toContain(`const [service] = useState(() => new UsersService());`);
        expect(hookText).toContain(`return service;`);

        expect(hookText).toContain(
            `export function useGetUsers(config?: SWRConfiguration<string | number | boolean | object | undefined | null, any>)`,
        );
        expect(hookText).toContain(`useSWR(`);
        expect(hookText).toContain(`() => service.getUsers(apiConfig)`);

        expect(hookText).toContain(
            `export function useCreateUser(config?: SWRMutationConfiguration<string | number | boolean | object | undefined | null, any, any, any>)`,
        );
        expect(hookText).toContain(`useSWRMutation(`);
        expect(hookText).toContain(`'createUser',`);
        expect(hookText).toContain(`service.createUser(arg.body, apiConfig)`);

        const collisionHookText = project.getSourceFile('/output/hooks/collision.hook.ts')!.getFullText();
        expect(collisionHookText).toContain('useGetFooBar');
        expect(collisionHookText).toContain('useGetFooBar2');

        const invalidHookText = project.getSourceFile('/output/hooks/invalid.hook.ts')!.getFullText();
        expect(invalidHookText).toContain('useMyInvalidName');

        expect(FetchClientGenerator.prototype.generate).toHaveBeenCalled();
    });

    it('should generate admin UI if config.options.admin is true', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const config = { options: { admin: true } } as unknown as GeneratorConfig;

        const spec = {
            openapi: '3.1.0',
            info: { title: 'Test API', version: '1.0.0' },
            paths: {
                '/admin-users': {
                    get: {
                        tags: ['AdminUsers'],
                        operationId: 'getAdminUsers',
                        responses: {
                            '200': { description: 'Success' },
                        },
                    },
                },
            },
        };
        const parser = new SwaggerParser(spec, {} as any);

        const generator = new ReactClientGenerator();
        await generator.generate(project, parser, config, '/out');

        // Check that an admin generator was run (app.tsx is created by Admin Generator's Master Routing)
        expect(project.getSourceFile('/out/admin/app.tsx')).toBeDefined();
    });
});
