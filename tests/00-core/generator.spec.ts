import { describe, it, expect } from 'vitest';
import { AbstractClientGenerator } from '../../src/core/generator.js';
import { Project } from 'ts-morph';
import { SwaggerParser } from '../../src/openapi/parse.js';
import { GeneratorConfig } from '../../src/core/types/config.js';

class MockGenerator extends AbstractClientGenerator {
    async generate(
        _project: Project,
        _parser: SwaggerParser,
        _config: GeneratorConfig,
        _outputDir: string,
    ): Promise<void> {
        // Mock implementation
    }
}

describe('AbstractClientGenerator', () => {
    it('should be extensible', async () => {
        const generator = new MockGenerator();
        expect(generator.generate).toBeDefined();
    });
});
