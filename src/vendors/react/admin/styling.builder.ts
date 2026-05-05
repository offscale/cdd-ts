import { Project, SourceFile } from 'ts-morph';
import * as path from 'node:path';

/**
 * Generates styling for React Admin components.
 */
export class StylingBuilder {
    /**
     * Initializes a new StylingBuilder.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates a Vanilla CSS file for a component.
     * @param componentName The name of the component.
     * @param dirPath The directory to save the CSS file.
     * @returns The generated CSS source file.
     */
    public generateCss(componentName: string, dirPath: string): SourceFile {
        const filePath = path.join(dirPath, `${componentName}.css`);
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addStatements(
            `.${componentName.toLowerCase()}-container {\n    display: flex;\n    flex-direction: column;\n    padding: 1rem;\n}\n`,
        );
        return sourceFile;
    }
}
