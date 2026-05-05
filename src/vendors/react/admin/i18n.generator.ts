import { Project, SourceFile } from 'ts-morph';
import * as path from 'node:path';

/**
 * Generates an i18n hook scaffold for React components, preparing the app for localization.
 */
export class I18nGenerator {
    /**
     * Initializes a new I18nGenerator.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates a shared i18n file.
     * @param adminDir The root admin directory.
     * @returns The generated source file.
     */
    public generate(adminDir: string): SourceFile {
        const filePath = path.join(adminDir, 'shared', 'i18n.ts');
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addStatements(`import { useCallback } from 'react';

/**
 * A lightweight translation hook scaffold.
 * Replace this with react-i18next or react-intl for production environments.
 */
export const useTranslation = () => {
    const t = useCallback((key: string, defaultValue: string) => {
        // Fallback translation logic
        return defaultValue;
    }, []);

    return { t };
};\n`);
        return sourceFile;
    }
}
