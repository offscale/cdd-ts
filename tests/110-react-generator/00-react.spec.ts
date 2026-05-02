import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactClientGenerator } from '../../src/vendors/react/react-client.generator.js';
import { FetchClientGenerator } from '../../src/vendors/fetch/fetch-client.generator.js';
import { Project } from 'ts-morph';
import { SwaggerParser } from '../../src/openapi/parse.js';
import { GeneratorConfig } from '../../src/core/types/index.js';
import * as path from 'node:path';

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
        const generator = new ReactClientGenerator();

        await generator.generate(project, parser, config, '/output');

        const hooksIndex = project.getSourceFile('/output/hooks/index.ts');
        expect(hooksIndex).toBeDefined();
        expect(hooksIndex!.getFullText()).toContain('export { useUsersService } from "./users.hook.js";');

        const hookFile = project.getSourceFile('/output/hooks/users.hook.ts');
        expect(hookFile).toBeDefined();
        const hookText = hookFile!.getFullText();
        expect(hookText).toContain(`import { useMemo } from "react";`);
        expect(hookText).toContain(`import { UsersService } from "../services/users.service.js";`);
        expect(hookText).toContain(`export function useUsersService() {`);
        expect(hookText).toContain(`return useMemo(() => new UsersService(), []);`);

        expect(FetchClientGenerator.prototype.generate).toHaveBeenCalled();
    });
});
