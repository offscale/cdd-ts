import type { GeneratorConfig } from "@src/core/types/index.js";
import { AbstractServiceGenerator } from "@src/functions/emit_service.js";

import { SwaggerParser } from "@src/openapi/parse.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
	createTestConfig,
	createTestOperation,
	createTestSpec,
} from "../shared/helpers.js";

class TestServiceGenerator extends AbstractServiceGenerator {
	protected getFileName(controllerName: string): string {
		return `${controllerName}.ts`;
	}

	protected generateImports(): void {
		// No-op for test
	}

	protected generateServiceContent(): void {
		// No-op for test
	}
}

describe("Generators: Service Base", () => {
	it("should sanitize invalid provided method names", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const config: GeneratorConfig = createTestConfig({
			input: "",
			output: "/out",
			options: {},
		});
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "Test", version: "1" },
				paths: {},
			}),
			config,
		);

		const generator = new TestServiceGenerator(parser, project, config);
		const operations = [
			createTestOperation({
				method: "get",
				path: "/test",
				methodName: "bad-name",
			}),
		];

		generator.generate("/out", { Test: operations });

		expect(operations[0]?.methodName).toBe("badName");
	});
});
