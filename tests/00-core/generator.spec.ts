import { describe, it, expect } from "vitest";
import { AbstractClientGenerator } from "../../src/core/generator.js";
import type { Project } from "ts-morph";
import type { SwaggerParser } from "../../src/openapi/parse.js";
import type { GeneratorConfig } from "../../src/core/types/config.js";

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

describe("AbstractClientGenerator", () => {
	it("should be extensible", async () => {
		const generator = new MockGenerator();
		expect(generator.generate).toBeDefined();
	});
});
