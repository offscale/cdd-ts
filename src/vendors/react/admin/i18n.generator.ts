/**
 * Module for i18n generator in vendors/react/admin/i18n.generator.
 *
 * @module vendors/react/admin/i18n.generator
 */
import * as path from "node:path";
import type { Project, SourceFile } from "ts-morph";

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
		const filePath = path.join(adminDir, "shared", "i18n.ts");
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addStatements(`import { useCallback, useState } from 'react';

const messages: Record<string, Record<string, string>> = {
    en: {
        'admin.save': 'Save',
        'admin.cancel': 'Cancel',
        'admin.delete': 'Delete',
        'admin.edit': 'Edit',
        'admin.create': 'Create',
        'admin.list': 'List',
        'admin.actions': 'Actions',
        'admin.confirmDelete': 'Are you sure you want to delete this item?',
        'admin.loading': 'Loading...',
        'admin.error': 'An error occurred.',
        'admin.noData': 'No data available.'
    }
};

/**
 * A lightweight translation hook with dictionary lookup and fallback support.
 */
export const useTranslation = (initialLocale = 'en') => {
    const [locale, setLocale] = useState<string>(initialLocale);
    const t = useCallback((key: string, defaultValue?: string) => {
        return messages[locale]?.[key] ?? defaultValue ?? key;
    }, [locale]);

    return { t, locale, setLocale };
};\n`);
		return sourceFile;
	}
}
