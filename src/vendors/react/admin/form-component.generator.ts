import { Project, SourceFile } from 'ts-morph';
import * as path from 'node:path';
import { Resource } from '@src/core/types/index.js';
import { pascalCase } from '@src/functions/utils.js';
import { ReactElementBuilder } from './html-element.builder.js';
import { FormRenderer } from './form.renderer.js';

/**
 * Generates a React form component for a resource.
 */
export class FormComponentGenerator {
    /**
     * Initializes a new FormComponentGenerator.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates a React form component (TSX) for the specified resource.
     * @param resource The resource to generate a form component for.
     * @param adminDir The directory to save the output files.
     * @returns The generated source file.
     */
    public generate(resource: Resource, adminDir: string): SourceFile {
        const filePath = path.join(adminDir, `${resource.name}`, `${resource.name}-form.tsx`);
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        const componentName = `${pascalCase(resource.name)}Form`;

        const getOp = resource.operations.find(op => op.action === 'getById');
        const getHook = getOp?.methodName ? `use${pascalCase(getOp.methodName)}` : `useGet${pascalCase(resource.name)}`;

        const createOp = resource.operations.find(op => op.action === 'create');
        const createHook = createOp?.methodName
            ? `use${pascalCase(createOp.methodName)}`
            : `useCreate${pascalCase(resource.name)}`;

        const updateOp = resource.operations.find(op => op.action === 'update');
        const updateHook = updateOp?.methodName
            ? `use${pascalCase(updateOp.methodName)}`
            : `useUpdate${pascalCase(resource.name)}`;

        const imports = [
            `import React, { useTransition, useCallback } from 'react';`,
            `import { useNavigate, useParams } from 'react-router-dom';`,
            `import { ${getHook}, ${createHook}, ${updateHook} } from '../../hooks/${resource.name}.hook.js';`,
            `import { useTranslation } from '../../shared/i18n.js';`,
            `import './${resource.name}-form.css';`,
        ];

        const fields = FormRenderer.extractFields(resource);

        const body = `    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isEdit = Boolean(id);
    const [isPending, startTransition] = useTransition();

    // Fetch data conditionally only when editing
    const { data: initialData } = ${getHook}(isEdit ? id : null);
    
    const { trigger: create } = ${createHook}();
    const { trigger: update } = ${updateHook}();

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const payload = Object.fromEntries(formData.entries());

        startTransition(async () => {
            try {
                if (isEdit) {
                    await update({ id, body: payload });
                } else {
                    await create({ body: payload });
                }
                navigate('/${resource.name}');
            } catch (err) {
                console.error(t('error_saving', 'Failed to save'), err);
            }
        });
    }, [isEdit, id, update, create, navigate, t]);

    const onCancel = useCallback(() => {
        navigate('/${resource.name}');
    }, [navigate]);`;

        const render = `
            <h2>{isEdit ? t('edit', 'Edit') : t('create', 'Create')} {t('resource.${resource.name}', '${pascalCase(resource.name)}')}</h2>
            <form onSubmit={onSubmit} aria-label={t('form_aria_label', '${pascalCase(resource.name)} Form')}>
                ${fields.length ? fields.map(p => ReactElementBuilder.buildInput(p.name, (p.schema as any)?.type === 'number' ? 'number' : 'text', true)).join('\n') : ReactElementBuilder.buildInput('name', 'text', true)}
                <div className="form-actions">
                    <button type="submit" className="btn-primary" aria-label={t('save_aria', 'Save ${pascalCase(resource.name)}')} disabled={isPending}>
                        {isPending ? t('saving', 'Saving...') : t('save', 'Save')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={onCancel} aria-label={t('cancel_aria', 'Cancel')} disabled={isPending}>
                        {t('cancel', 'Cancel')}
                    </button>
                </div>
            </form>`;

        const content = ReactElementBuilder.buildFunctionalComponent(componentName, imports, body, render);
        sourceFile.addStatements(content);

        return sourceFile;
    }
}
