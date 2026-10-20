/**
 * Module for custom validators generator in vendors/react/admin/custom-validators.generator.
 *
 * @module vendors/react/admin/custom-validators.generator
 */
import * as path from "node:path";
import type { Project, SourceFile } from "ts-morph";

/**
 * Generates custom validation logic (e.g. Yup or Zod schemas) for React forms.
 */
export class CustomValidatorsGenerator {
	/**
	 * Initializes a new CustomValidatorsGenerator.
	 * @param project The ts-morph project for writing source files.
	 */
	constructor(private project: Project) {}

	/**
	 * Generates a shared validators file.
	 * @param adminDir The root admin directory.
	 * @returns The generated source file.
	 */
	public generate(adminDir: string): SourceFile {
		const filePath = path.join(adminDir, "shared", "validators.ts");
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addStatements(
			`export const isRequired = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

export const minLength = (min: number) => (value: unknown): boolean =>
    typeof value !== 'string' || value.length >= min;

export const maxLength = (max: number) => (value: unknown): boolean =>
    typeof value !== 'string' || value.length <= max;

export const pattern = (regexPattern: string) => (value: unknown): boolean =>
    typeof value !== 'string' || new RegExp(regexPattern).test(value);

export const minimum = (min: number) => (value: unknown): boolean =>
    typeof value !== 'number' || value >= min;

export const maximum = (max: number) => (value: unknown): boolean =>
    typeof value !== 'number' || value <= max;

export const exclusiveMinimum = (min: number) => (value: unknown): boolean =>
    typeof value === 'number' && value > min;

export const exclusiveMaximum = (max: number) => (value: unknown): boolean =>
    typeof value === 'number' && value < max;

export const multipleOf = (factor: number) => (value: unknown): boolean =>
    typeof value === 'number' && factor !== 0 && value % factor === 0;

export const uniqueItems = (value: unknown): boolean =>
    !Array.isArray(value) || new Set(value).size === value.length;

export const minProperties = (min: number) => (value: unknown): boolean =>
    typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length >= min;

export const maxProperties = (max: number) => (value: unknown): boolean =>
    typeof value !== 'object' || value === null || Array.isArray(value) || Object.keys(value).length <= max;

export const constValidator = (expected: unknown) => (value: unknown): boolean =>
    Object.is(value, expected);
`,
		);
		return sourceFile;
	}
}
