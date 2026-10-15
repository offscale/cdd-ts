import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { parseExamplesMetadata } from "../../src/mocks/parse.js";
import { evaluateAstLiteral } from "../../src/openapi/parse_ast_literal.js";

describe("parseExamplesMetadata & evaluateAstLiteral", () => {
	it("should return undefined if sourceFile is missing", () => {
		expect(parseExamplesMetadata(null)).toBeUndefined();
		expect(parseExamplesMetadata(undefined)).toBeUndefined();
		expect(evaluateAstLiteral(undefined)).toBeUndefined();
	});

	it("should return undefined if API_EXAMPLES is not present", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile = project.createSourceFile(
			"examples.ts",
			"export const OTHER_VAR = {};",
		);

		expect(parseExamplesMetadata(sourceFile)).toBeUndefined();
	});

	it("should return undefined if API_EXAMPLES has no initializer", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile = project.createSourceFile(
			"examples.ts",
			"export declare const API_EXAMPLES: Record<string, unknown>;",
		);

		expect(parseExamplesMetadata(sourceFile)).toBeUndefined();
	});

	it("should return undefined if API_EXAMPLES cannot be statically parsed (no code execution)", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile = project.createSourceFile(
			"examples.ts",
			"export const API_EXAMPLES = (() => { throw new Error('Should not execute!'); })();",
		);

		expect(parseExamplesMetadata(sourceFile)).toBeUndefined();
	});

	it("should return undefined if parsed API_EXAMPLES evaluates to primitive, null, or array", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile1 = project.createSourceFile(
			"examples1.ts",
			'export const API_EXAMPLES = "hello";',
		);
		expect(parseExamplesMetadata(sourceFile1)).toBeUndefined();

		const sourceFile2 = project.createSourceFile(
			"examples2.ts",
			"export const API_EXAMPLES = null;",
		);
		expect(parseExamplesMetadata(sourceFile2)).toBeUndefined();

		const sourceFile3 = project.createSourceFile(
			"examples3.ts",
			"export const API_EXAMPLES = [1, 2, 3];",
		);
		expect(parseExamplesMetadata(sourceFile3)).toBeUndefined();
	});

	it("should correctly parse API_EXAMPLES with all literal types (numbers, unary +/-, booleans, null, undefined, arrays, templates, type assertions)", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const sourceFile = project.createSourceFile(
			"examples.ts",
			[
				"export const API_EXAMPLES = ({",
				"	UserExample: {",
				"		summary: `A user example`,",
				'		100: "numericKey",',
				"		value: {",
				"			id: 1,",
				"			neg: -42,",
				"			pos: +7,",
				"			active: true,",
				"			deleted: false,",
				"			nothing: null,",
				"			missing: undefined,",
				'			tags: ["a", `b`, -1, true, false, null, undefined],',
				"		},",
				"	},",
				"} as const);",
			].join("\n"),
		);

		const result = parseExamplesMetadata(sourceFile);
		expect(result).toEqual({
			UserExample: {
				summary: "A user example",
				"100": "numericKey",
				value: {
					id: 1,
					neg: -42,
					pos: 7,
					active: true,
					deleted: false,
					nothing: null,
					missing: undefined,
					tags: ["a", "b", -1, true, false, null, undefined],
				},
			},
		});
	});

	it("should return undefined for unsupported object properties, computed keys, non-numeric unary ops, or non-literal array elements", () => {
		const project = new Project({ useInMemoryFileSystem: true });

		const sfSpread = project.createSourceFile(
			"spread.ts",
			"export const API_EXAMPLES = { ...other };",
		);
		expect(parseExamplesMetadata(sfSpread)).toBeUndefined();

		const sfComputed = project.createSourceFile(
			"computed.ts",
			"export const API_EXAMPLES = { [1 + 2]: 'val' };",
		);
		expect(parseExamplesMetadata(sfComputed)).toBeUndefined();

		const sfUnaryBool = project.createSourceFile(
			"unary.ts",
			"export const API_EXAMPLES = { flag: !true };",
		);
		expect(parseExamplesMetadata(sfUnaryBool)).toBeUndefined();

		const sfUnaryTilde = project.createSourceFile(
			"tilde.ts",
			"export const API_EXAMPLES = { num: ~5 };",
		);
		expect(parseExamplesMetadata(sfUnaryTilde)).toBeUndefined();

		const sfBadArray = project.createSourceFile(
			"bad_arr.ts",
			"export const API_EXAMPLES = { arr: [1, someCall()] };",
		);
		expect(parseExamplesMetadata(sfBadArray)).toBeUndefined();

		const sfBadProp = project.createSourceFile(
			"bad_prop.ts",
			"export const API_EXAMPLES = { prop: someVar };",
		);
		expect(parseExamplesMetadata(sfBadProp)).toBeUndefined();
	});
});
