import { Project } from 'ts-morph';
import * as path from 'node:path';

/**
 * Generates an internal i18n composable for the Vue Admin Interface.
 * It provides a simple reactive dictionary to support basic translations.
 */
export class I18nGenerator {
    /**
     * Initializes a new I18nGenerator.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates the shared i18n file.
     * @param adminDir The root admin directory.
     */
    public generate(adminDir: string): void {
        const dir = path.posix.join(adminDir, 'shared');
        const filePath = path.posix.join(dir, 'i18n.ts');
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addStatements(
            `
import { ref, computed } from 'vue';

const currentLocale = ref('en');

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
 * A lightweight reactive i18n composable for the admin interface.
 */
export function useI18n() {
    /**
     * Translates a given key based on the current locale.
     * @param key The translation key.
     * @returns The translated string, or the key if not found.
     */
    const t = (key: string): string => {
        return messages[currentLocale.value]?.[key] || key;
    };

    /**
     * Sets the current active locale.
     * @param locale The locale code (e.g., 'en').
     */
    const setLocale = (locale: string) => {
        currentLocale.value = locale;
    };

    return {
        t,
        locale: computed(() => currentLocale.value),
        setLocale
    };
}
`.trim(),
        );
        sourceFile.formatText();
    }
}
