import { Project } from 'ts-morph';
import * as path from 'node:path';

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
        const dir = path.posix.join(adminDir, 'shared');
        const filePath = path.posix.join(dir, 'validators.ts');
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addStatements(
            `
/**
 * Validates that a value is provided.
 * @param value The value to check.
 * @returns true if valid, or an error string if invalid.
 */
export function required(value: any): boolean | string {
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
`.trim(),
        );
        sourceFile.formatText();
    }
}
