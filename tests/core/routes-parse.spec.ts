import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { parsePathsMetadata } from "../../src/routes/parse.js";

describe("parsePathsMetadata", () => {
	it("should return undefined if sourceFile is missing", () => {
		expect(parsePathsMetadata(null)).toBeUndefined();
		expect(parsePathsMetadata(undefined)).toBeUndefined();
	});

	it("should return undefined if API_PATHS is not present", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile = project.createSourceFile(
			"paths.ts",
			"export const OTHER_VAR = {};",
		);

		expect(parsePathsMetadata(sourceFile)).toBeUndefined();
	});

	it("should return undefined if API_PATHS has no initializer", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile = project.createSourceFile(
			"paths.ts",
			"export declare const API_PATHS: Record<string, unknown>;",
		);

		expect(parsePathsMetadata(sourceFile)).toBeUndefined();
	});

	it("should return undefined if API_PATHS cannot be statically parsed", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile = project.createSourceFile(
			"paths.ts",
			"export const API_PATHS = someFunctionCall();",
		);

		expect(parsePathsMetadata(sourceFile)).toBeUndefined();
	});

	it("should return undefined if parsed API_PATHS evaluates to string, null, or array", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile1 = project.createSourceFile(
			"paths1.ts",
			'export const API_PATHS = "hello";',
		);
		expect(parsePathsMetadata(sourceFile1)).toBeUndefined();

		const sourceFile2 = project.createSourceFile(
			"paths2.ts",
			"export const API_PATHS = null;",
		);
		expect(parsePathsMetadata(sourceFile2)).toBeUndefined();

		const sourceFile3 = project.createSourceFile(
			"paths3.ts",
			"export const API_PATHS = [];",
		);
		expect(parsePathsMetadata(sourceFile3)).toBeUndefined();
	});

	it("should correctly parse API_PATHS metadata", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const metadata = {
			"/pet": {
				summary: "Pet operations",
				description: "Operations related to pets",
			},
		};
		const sourceFile = project.createSourceFile(
			"paths.ts",
			`export const API_PATHS = ${JSON.stringify(metadata, null, 2)};`,
		);

		const result = parsePathsMetadata(sourceFile);
		expect(result).toEqual(metadata);
	});
});
