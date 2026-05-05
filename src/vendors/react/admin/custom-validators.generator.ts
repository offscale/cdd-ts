import { Project, SourceFile } from 'ts-morph';
import * as path from 'node:path';

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
        const filePath = path.join(adminDir, 'shared', 'validators.ts');
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addStatements(
            `export const isRequired = (value: any) => value !== undefined && value !== null && value !== '';\n`,
        );
        return sourceFile;
    }
}
