import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGeneratorFactory, generateFromConfig } from '../../src/index.js';
import { AngularClientGenerator } from '../../src/vendors/angular/angular-client.generator.js';
import { ReactClientGenerator } from '../../src/vendors/react/react-client.generator.js';
import { VueClientGenerator } from '../../src/vendors/vue/vue-client.generator.js';
import { FetchClientGenerator } from '../../src/vendors/fetch/fetch-client.generator.js';
import { AxiosClientGenerator } from '../../src/vendors/axios/axios-client.generator.js';
import { NodeClientGenerator } from '../../src/vendors/node/node-client.generator.js';
import { Project } from 'ts-morph';
import { GeneratorConfig, SwaggerSpec } from '../../src/core/types/index.js';
import * as utils from '../../src/functions/utils.js';
import { SwaggerParser } from '../../src/openapi/parse.js';

vi.mock('../../src/openapi/parse.js', () => {
    const MockSwaggerParser = vi.fn();
    (MockSwaggerParser as unknown as Record<string, unknown>).create = vi.fn().mockResolvedValue({
        spec: { openapi: '3.0.0', info: { title: 'Test', version: '1' }, paths: {} },
        getSpec: vi.fn().mockReturnValue({}),
    });
    return { SwaggerParser: MockSwaggerParser };
});

vi.mock('../../src/vendors/cli/emit.js', () => {
    return {
        CliGenerator: class {
            generate = vi.fn();
        },
    };
});

describe('index.ts', () => {
    describe('getGeneratorFactory', () => {
        it('returns AngularClientGenerator by default', () => {
            expect(getGeneratorFactory('unknown')).toBeInstanceOf(AngularClientGenerator);
        });
        it('returns ReactClientGenerator for react', () => {
            expect(getGeneratorFactory('react')).toBeInstanceOf(ReactClientGenerator);
        });
        it('returns VueClientGenerator for vue', () => {
            expect(getGeneratorFactory('vue')).toBeInstanceOf(VueClientGenerator);
        });
        it('returns FetchClientGenerator for fetch implementation', () => {
            expect(getGeneratorFactory('angular', 'fetch')).toBeInstanceOf(FetchClientGenerator);
        });
        it('returns AxiosClientGenerator for axios implementation', () => {
            expect(getGeneratorFactory('angular', 'axios')).toBeInstanceOf(AxiosClientGenerator);
        });
        it('returns NodeClientGenerator for node implementation', () => {
            expect(getGeneratorFactory('angular', 'node')).toBeInstanceOf(NodeClientGenerator);
        });
    });

    describe('generateFromConfig', () => {
        let project: Project;
        let config: GeneratorConfig;
        let consoleLogSpy: import('vitest').MockInstance;
        let consoleErrorSpy: import('vitest').MockInstance;

        beforeEach(() => {
            project = new Project({ useInMemoryFileSystem: true });
            config = {
                input: 'http://example.com/spec.json',
                output: '/out',
                options: {
                    framework: 'angular',
                },
                compilerOptions: {},
            } as unknown as GeneratorConfig;
            consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should create output directory if it does not exist and is not test env', async () => {
            config.input = '/local/spec.json'; // local path to test console log branch

            // Allow isUrl to return false
            vi.spyOn(utils, 'isUrl').mockReturnValue(false);

            // Mocking the parse to fail so it stops but creates dir
            (SwaggerParser.create as import('vitest').Mock).mockRejectedValueOnce(new Error('Stop'));

            try {
                await generateFromConfig(config, project);
            } catch (e) {
                // Ignore failure
            }

            const fs = project.getFileSystem();
            expect(fs.directoryExistsSync('/out')).toBe(true);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file'));
        });

        it('should NOT create output directory if it already exists', async () => {
            config.input = '/local/spec.json';
            vi.spyOn(utils, 'isUrl').mockReturnValue(false);
            (SwaggerParser.create as import('vitest').Mock).mockRejectedValueOnce(new Error('Stop'));

            const fs = project.getFileSystem();
            fs.mkdirSync('/out'); // Pre-create the directory
            const mkdirSpy = vi.spyOn(fs, 'mkdirSync');

            try {
                await generateFromConfig(config, project);
            } catch (e) {
                console.error(e);
            }

            expect(mkdirSpy).not.toHaveBeenCalled();
        });

        it('should handle URL input logging', async () => {
            config.input = 'http://example.com/spec.json';
            vi.spyOn(utils, 'isUrl').mockReturnValue(true);
            (SwaggerParser.create as import('vitest').Mock).mockRejectedValueOnce(new Error('Stop'));

            try {
                await generateFromConfig(config, project);
            } catch (e) {
                // Ignore failure
            }
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('URL'));
        });

        it('should default framework to angular if not provided', async () => {
            config.options.framework = undefined;
            const testConfig = {
                spec: {
                    openapi: '3.0.0',
                    info: { title: 'Test', version: '1' },
                    paths: {},
                } as unknown as SwaggerParser,
            };
            const activeProjectSaveSpy = vi.spyOn(project, 'save').mockResolvedValue(undefined);
            const generateSpy = vi.spyOn(AngularClientGenerator.prototype, 'generate').mockResolvedValue(undefined);

            await generateFromConfig(config, project, testConfig);

            // Should not save if isTestEnv
            expect(activeProjectSaveSpy).not.toHaveBeenCalled();
            expect(generateSpy).toHaveBeenCalled();
        });

        it('should save project if not test env and target cli', async () => {
            const activeProjectSaveSpy = vi.spyOn(project, 'save').mockResolvedValue(undefined);

            // Ensure SwaggerParser.create resolves
            (SwaggerParser.create as import('vitest').Mock).mockResolvedValueOnce({
                spec: { openapi: '3.0.0', info: { title: 'Test', version: '1' }, paths: {} },
            });

            // Mock generator
            vi.spyOn(AngularClientGenerator.prototype, 'generate').mockResolvedValue(undefined);

            await generateFromConfig(config, project, undefined, 'to_sdk_cli');

            expect(activeProjectSaveSpy).toHaveBeenCalled();
        });

        it('should initialize a new Project if not provided', async () => {
            const generateSpy = vi.spyOn(AngularClientGenerator.prototype, 'generate').mockResolvedValue(undefined);

            // Should pass without project argument
            await generateFromConfig(config, undefined, {
                spec: {
                    openapi: '3.0.0',
                    info: { title: 'Test', version: '1' },
                    paths: {},
                } as unknown as SwaggerParser,
            });

            expect(generateSpy).toHaveBeenCalled();
        });

        it('should throw and log error if generation fails and not test env', async () => {
            config.input = 'invalid-input';
            const error = new Error('Parse Error');
            (SwaggerParser.create as import('vitest').Mock).mockRejectedValueOnce(error);

            try {
                await generateFromConfig(config, project);
                expect.unreachable('Should have thrown');
            } catch (e) {
                expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Generation failed:', 'Parse Error');
            }
        });

        it('should throw and log unknown error if generation fails and not test env', async () => {
            config.input = 'invalid-input';
            const error = 'String Error';
            (SwaggerParser.create as import('vitest').Mock).mockRejectedValueOnce(error);

            try {
                await generateFromConfig(config, project);
                expect.unreachable('Should have thrown');
            } catch (e) {
                expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Generation failed:', 'String Error');
            }
        });

        it('should throw WITHOUT logging if generation fails IN test env', async () => {
            const error = new Error('Parse Error');
            (SwaggerParser.create as import('vitest').Mock).mockRejectedValueOnce(error);

            try {
                // Pass testConfig to simulate isTestEnv = true
                await generateFromConfig(config, project, {} as unknown as SwaggerParser);
                expect.unreachable('Should have thrown');
            } catch (e) {
                expect(consoleErrorSpy).not.toHaveBeenCalled();
            }
        });
    });
});
