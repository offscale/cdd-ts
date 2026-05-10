// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateFromConfigSync } from '@src/index.js';
import { SwaggerParser } from '@src/openapi/parse.js';
import { GeneratorConfig } from '@src/core/types/index.js';
import { coverageSpec, emptySpec } from '../shared/specs.js';
import { createTestProject, runGeneratorWithConfig } from '../shared/helpers.js';

vi.mock('fs', async importOriginal => {
    const original = await importOriginal<typeof import('fs')>();
    return { ...original, mkdirSync: vi.fn(), existsSync: vi.fn().mockReturnValue(true) };
});

describe('E2E: Core Orchestrator Flow', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should default to Angular framework when option is absent', async () => {
        const project = await runGeneratorWithConfig(coverageSpec, {});
        const filePaths = project.getSourceFiles().map(f => f.getFilePath());

        // Angular specific artifacts check
        expect(filePaths).toContain('/generated/services/users.service.ts');
    });

    it('should propagate errors from the file system save operation', async () => {
        const errorMessage = 'Disk is full';
        const project = createTestProject();
        const saveSpy = vi.spyOn(project, 'saveSync').mockImplementation(() => {
            throw new Error(errorMessage);
        });
        const config: GeneratorConfig = {
            input: '',
            output: '/generated',
            options: { generateServices: true } as string | number | boolean | object | undefined | null,
        };
        vi.spyOn(SwaggerParser, 'createSync').mockReturnValue(
            new SwaggerParser(emptySpec as string | number | boolean | object | undefined | null, config),
        );

        expect(() => generateFromConfigSync(config, project)).toThrow(errorMessage);
        expect(saveSpy).toHaveBeenCalled();
    });

    it('should generate react client when framework is react', async () => {
        const project = createTestProject();
        const config: GeneratorConfig = {
            input: '',
            output: '/generated',
            options: { framework: 'react' },
        };
        const testConfig = { spec: emptySpec };
        expect(() => {
            generateFromConfigSync(config, project, testConfig);
        }).not.toThrow();
    });

    it('should generate vue client when framework is vue', async () => {
        const project = createTestProject();
        const config: GeneratorConfig = {
            input: '',
            output: '/generated',
            options: { framework: 'vue' },
        };
        const testConfig = { spec: emptySpec };
        expect(() => generateFromConfigSync(config, project, testConfig)).not.toThrow();
    });

    it('should call CliGenerator when targetScope is to_sdk_cli', async () => {
        const project = createTestProject();
        const config: GeneratorConfig = {
            input: '',
            output: '/generated',
            options: { framework: 'angular' },
        };
        const testConfig = { spec: emptySpec };
        expect(() => generateFromConfigSync(config, project, testConfig, 'to_sdk_cli')).not.toThrow();
    });
});
