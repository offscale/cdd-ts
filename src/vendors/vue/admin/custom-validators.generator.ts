/**
 * Module for custom validators generator in vendors/vue/admin/custom-validators.generator.
 *
 * @module vendors/vue/admin/custom-validators.generator
 */
import * as path from "node:path";
import type { Project } from "ts-morph";

/**
 * Generates custom validation utility functions for the Vue Admin Interface forms.
 */
export class CustomValidatorsGenerator {
	/**
	 * Initializes a new CustomValidatorsGenerator.
	 * @param project The ts-morph project for writing source files.
	 */
	constructor(private project: Project) {}

	/**
	 * Generates the shared validators file.
	 * @param adminDir The root admin directory.
	 */
	public generate(adminDir: string): void {
		const dir = path.posix.join(adminDir, "shared");
		const filePath = path.posix.join(dir, "validators.ts");
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addStatements(
			`
/**
 * Validates that a value is provided.
 * @param value The value to check.
 * @returns true if valid, or an error string if invalid.
 */
export function required(value: unknown): boolean | string {
    if (value === null || value === undefined || value === '') {
        return 'This field is required';
    }
    return true;
}

/**
 * Validates that a value is a valid email address.
 * @param value The email string to check.
 * @returns true if valid or empty, or an error string if invalid.
 */
export function email(value: string): boolean | string {
    if (!value) return true; // Let required() handle empty states
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(value)) {
        return 'Invalid email address';
    }
    return true;
}

/**
 * Creates a validator that enforces a minimum string length.
 * @param length The minimum required length.
 * @returns A validator function.
 */
export function minLength(length: number) {
    return (value: string): boolean | string => {
        if (!value) return true;
        if (value.length < length) {
            return \`Must be at least \${length} characters\`;
        }
        return true;
    };
}

/**
 * Creates a validator that enforces a maximum string length.
 * @param length The maximum allowed length.
 * @returns A validator function.
 */
export function maxLength(length: number) {
    return (value: string): boolean | string => {
        if (!value) return true;
        if (value.length > length) {
            return \`Must be at most \${length} characters\`;
        }
        return true;
    };
}

/**
 * Creates a validator that enforces a regular expression pattern.
 * @param regexPattern The regular expression string.
 * @returns A validator function.
 */
export function pattern(regexPattern: string) {
    return (value: string): boolean | string => {
        if (!value) return true;
        if (!new RegExp(regexPattern).test(value)) {
            return \`Must match pattern \${regexPattern}\`;
        }
        return true;
    };
}

/**
 * Creates a validator that enforces a strictly greater-than minimum value.
 * @param min The exclusive minimum bound.
 * @returns A validator function.
 */
export function exclusiveMinimum(min: number) {
    return (value: number): boolean | string =>
        typeof value === 'number' && value > min ? true : \`Must be greater than \${min}\`;
}

/**
 * Creates a validator that enforces a strictly less-than maximum value.
 * @param max The exclusive maximum bound.
 * @returns A validator function.
 */
export function exclusiveMaximum(max: number) {
    return (value: number): boolean | string =>
        typeof value === 'number' && value < max ? true : \`Must be less than \${max}\`;
}

/**
 * Creates a validator that enforces divisibility by a factor.
 * @param factor The divisor.
 * @returns A validator function.
 */
export function multipleOf(factor: number) {
    return (value: number): boolean | string =>
        typeof value === 'number' && factor !== 0 && value % factor === 0
            ? true
            : \`Must be a multiple of \${factor}\`;
}

/**
 * Validates that an array contains only unique items.
 * @param value The array to validate.
 * @returns true if valid, or an error string if duplicate items exist.
 */
export function uniqueItems(value: unknown): boolean | string {
    if (!Array.isArray(value)) return true;
    return new Set(value).size === value.length ? true : 'Items must be unique';
}
`.trim(),
		);
		sourceFile.formatText();
	}
}
