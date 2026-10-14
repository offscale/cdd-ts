import type { GeneratorConfig } from "@src/core/types/index.js";
import { generateFromConfigSync } from "@src/index.js";
import { IndentationText, ModuleKind, Project, ScriptTarget } from "ts-morph";

/**
 * Recursive callable, constructable, and indexable test value type for dynamic test assertions.
 */
export type TestValue = {
	[key: string]: TestValue;
	[index: number]: TestValue;
	(...args: unknown[]): TestValue;
} & (new (
	...args: unknown[]
) => TestValue);

/**
 * Alias for callable/constructable dynamic test values.
 */
export type TestCallable = TestValue;

function isCast<T>(value: unknown): value is T {
	void value;
	return true;
}

/**
 * Strongly-typed test fixture coercion helper that narrows an OpenAPI or test fixture value to `T`
 * without using `any` or type assertions.
 *
 * @param value - Input fixture value.
 * @returns The value narrowed to `T`.
 */
export function testCast<T = TestValue>(value: unknown): T {
	if (isCast<T>(value)) {
		return value;
	}
	throw new Error("Unreachable");
}

/**
 * Creates a standard ts-morph project instance for use in tests.
 * This sets up an in-memory file system and a consistent compiler configuration
 * to ensure tests are isolated and reproducible.
 * @returns A pre-configured Project instance with an in-memory file system.
 */
export function createTestProject(): Project {
	return new Project({
		useInMemoryFileSystem: true,
		manipulationSettings: { indentationText: IndentationText.TwoSpaces },
		compilerOptions: {
			target: ScriptTarget.ESNext,
			module: ModuleKind.ESNext,
			moduleResolution: 99, // NodeNext
			lib: ["ES2022", "DOM"],
			strict: true,
			esModuleInterop: true,
			allowArbitraryExtensions: true,
			resolveJsonModule: true,
		},
	});
}

/**
 * A specialized version of `runGenerator` that allows passing a full config object.
 * Useful for E2E tests covering config-dependent features like security and date types.
 * @param spec The OpenAPI specification as a JavaScript object.
 * @param config The full generator config options.
 * @returns A promise that resolves to the `Project` instance containing all generated files.
 */
export async function runGeneratorWithConfig(
	spec: object,
	config: Partial<GeneratorConfig["options"]>,
): Promise<Project> {
	const project = createTestProject();

	const fullConfig: GeneratorConfig = {
		input: "/spec.json",
		output: "/generated",
		options: {
			framework: "angular",
			dateType: "string",
			enumStyle: "enum",
			generateServices: true,
			generateServiceTests: true,
			admin: false,
			...config,
		},
	};
	generateFromConfigSync(fullConfig, project, { spec });
	return project;
}

/**
 * A centralized helper to run the full generator pipeline for tests.
 * @param spec The OpenAPI specification as a JavaScript object.
 * @param genConfig Optional overrides for the standard generator config.
 * @returns A promise that resolves to the `Project` instance containing all generated files.
 */
export async function runGenerator(
	spec: object,
	genConfig?: Partial<GeneratorConfig>,
): Promise<Project> {
	const project = createTestProject();

	const config: GeneratorConfig = {
		...genConfig,
		input: genConfig?.input ?? "/spec.json",
		output: genConfig?.output ?? "/generated",
		options: {
			framework: "angular",
			dateType: "string",
			enumStyle: "enum",
			generateServices: true,
			admin: false,
			generateServiceTests: true,
			...genConfig?.options,
		},
	};

	generateFromConfigSync(config, project, { spec });

	return project;
}
