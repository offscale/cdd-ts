import { Project, SourceFile } from 'ts-morph';
import * as path from 'node:path';

/**
 * Generates an i18n service scaffold for Angular components, preparing the app for localization.
 */
export class I18nGenerator {
    /**
     * Initializes a new I18nGenerator.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates a shared i18n service file.
     * @param adminDir The root admin directory.
     * @returns The generated source file.
     */
    public generate(adminDir: string): SourceFile {
        const filePath = path.join(adminDir, 'shared', 'i18n.service.ts');
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addStatements(`import { Injectable } from '@angular/core';

/**
 * A lightweight translation service scaffold.
 * Replace this with @ngx-translate/core or Angular native i18n for production environments.
 */
@Injectable({
    providedIn: 'root'
})
export class TranslationService {
    public t(key: string, defaultValue: string): string {
        // Fallback translation logic
        return defaultValue;
    }
}\n`);
        return sourceFile;
    }
}
