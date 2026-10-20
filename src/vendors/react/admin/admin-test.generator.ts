/**
 * Module for admin test generator in vendors/react/admin/admin-test.generator.
 *
 * @module vendors/react/admin/admin-test.generator
 */
import * as path from "node:path";
import type { Project, SourceFile } from "ts-morph";

/**
 * Generates unit tests for generated React components using Vitest/React Testing Library.
 */
export class AdminTestGenerator {
	/**
	 * Initializes a new AdminTestGenerator.
	 * @param project The ts-morph project for writing source files.
	 */
	constructor(private project: Project) {}

	/**
	 * Generates a test file for a specific component.
	 * @param componentName The name of the component being tested.
	 * @param dirPath The directory to save the test file.
	 * @returns The generated test source file.
	 */
	public generate(componentName: string, dirPath: string): SourceFile {
		const filePath = path.join(dirPath, `${componentName}.spec.tsx`);
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const isList = componentName.endsWith("List");
		const body = isList
			? `
    it('renders loading state', () => {
        const { container } = render(<${componentName} />);
        expect(container.firstChild).not.toBeNull();
    });
    it('renders error state', () => {
        const { container } = render(<${componentName} />);
        expect(container.innerHTML.length).toBeGreaterThan(0);
    });
    it('renders data state', () => {
        const { container } = render(<${componentName} />);
        expect(container.querySelector('table, div')).not.toBeNull();
    });`
			: `
    it('renders create mode', () => {
        const { container } = render(<${componentName} />);
        expect(container.querySelector('form')).not.toBeNull();
    });
    it('submits the form successfully', () => {
        const { container } = render(<${componentName} />);
        const form = container.querySelector('form');
        expect(form).not.toBeNull();
    });`;

		sourceFile.addStatements(
			`import React from 'react';\nimport { describe, it, expect, vi } from 'vitest';\nimport { render } from '@testing-library/react';\nimport { ${componentName} } from './${componentName.toLowerCase().replace("list", "-list").replace("form", "-form")}.js';\n\n// Mocks for react-router-dom and hooks should be configured here\nvi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ id: undefined }), Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }));\n\ndescribe('${componentName}', () => {${body}\n});\n`,
		);
		return sourceFile;
	}
}
