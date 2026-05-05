import { Project, SourceFile } from 'ts-morph';
import * as path from 'node:path';
import { Resource } from '@src/core/types/index.js';
import { pascalCase } from '@src/functions/utils.js';
import { ReactElementBuilder } from './html-element.builder.js';

/**
 * Generates a React list component for a resource.
 */
export class ListComponentGenerator {
    /**
     * Initializes a new ListComponentGenerator.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates a React list component (TSX) for the specified resource.
     * @param resource The resource to generate a list component for.
     * @param adminDir The directory to save the output files.
     * @returns The generated source file.
     */
    public generate(resource: Resource, adminDir: string): SourceFile {
        const filePath = path.join(adminDir, `${resource.name}`, `${resource.name}-list.tsx`);
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        const componentName = `${pascalCase(resource.name)}List`;

        const listOp = resource.operations.find(op => op.action === 'list');
        const hookName = listOp?.methodName
            ? `use${pascalCase(listOp.methodName)}`
            : `useGet${pascalCase(resource.name)}`;

        const imports = [
            `import React from 'react';`,
            `import { Link } from 'react-router-dom';`,
            `import { ${hookName} } from '../../hooks/${resource.name}.hook.js';`,
            `import { useTranslation } from '../../shared/i18n.js';`,
            `import './${resource.name}-list.css';`,
        ];

        const props = resource.formProperties?.slice(0, 5) || [{ name: 'id', schema: { type: 'string' } }];

        const body = `    const { data, error, isLoading } = ${hookName}();\n    const { t } = useTranslation();\n\n    if (isLoading) return <div role="status" aria-live="polite">{t('loading', 'Loading...')}</div>;\n    if (error) return <div role="alert">{t('error_loading', 'Error loading data')}</div>;`;

        const render = `
            <h2>{t('resource.${resource.name}', '${pascalCase(resource.name)}')} {t('list', 'List')}</h2>
            <Link to="/${resource.name}/new" className="btn-create" aria-label={t('create_new_aria', 'Create New ${pascalCase(resource.name)}')}>
                {t('create_new', 'Create New')}
            </Link>
            <table>
                <thead>
                    <tr>
                        ${props.map(p => `<th scope="col">{t('field.${p.name}', '${pascalCase(p.name)}')}</th>`).join('\n                        ')}
                        <th scope="col">{t('actions', 'Actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.map((item: any) => (
                        <tr key={item.id}>
                            ${props.map(p => `<td>{item.${p.name}}</td>`).join('\n                            ')}
                            <td>
                                <Link to={\`/${resource.name}/edit/\${item.id}\`} aria-label={t('edit_item_aria', 'Edit item \${item.id}')}>
                                    {t('edit', 'Edit')}
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>`;

        const content = ReactElementBuilder.buildFunctionalComponent(componentName, imports, body, render);
        sourceFile.addStatements(content);

        return sourceFile;
    }
}
