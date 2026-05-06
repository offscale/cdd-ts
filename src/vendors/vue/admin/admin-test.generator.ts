import { Project } from 'ts-morph';
import * as path from 'node:path';

/**
 * Generates unit tests for the Vue Admin components.
 */
export class AdminTestGenerator {
    /**
     * Initializes a new AdminTestGenerator.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates a basic vitest specification for a given Vue component.
     * @param componentName The base name of the component (e.g. 'users-list.component').
     * @param resourceDir The directory containing the component.
     */
    public generate(componentName: string, resourceDir: string): void {
        const filePath = path.posix.join(resourceDir, `${componentName}.spec.ts`);
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addStatements(
            `
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Component from './${componentName}.vue';

// Mock the API client injection
vi.mock('vue', async (importOriginal) => {
    const actual = await importOriginal<typeof import('vue')>();
    return {
        ...actual,
        inject: vi.fn(() => ({
            // Provide dummy implementations of service methods if necessary
            list: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue({}),
        }))
    };
});

describe('${componentName}.vue', () => {
    it('mounts successfully', () => {
        const wrapper = mount(Component, {
            global: {
                stubs: {
                    'router-link': true,
                    'router-view': true
                }
            }
        });
        expect(wrapper.exists()).toBe(true);
    });
});
`.trim(),
        );
        sourceFile.formatText();
    }
}
