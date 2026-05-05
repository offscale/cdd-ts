import { Project, SourceFile } from 'ts-morph';
import * as path from 'node:path';
import { Resource } from '@src/core/types/index.js';
import { pascalCase } from '@src/functions/utils.js';

/**
 * Generates routing configurations and the App Shell for a React Admin UI.
 */
export class RoutingGenerator {
    /**
     * Initializes a new RoutingGenerator.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates resource-specific routes.
     * @param resource The resource to generate routing for.
     * @param adminDir The root admin directory.
     * @returns The generated source file.
     */
    public generate(resource: Resource, adminDir: string): SourceFile {
        const filePath = path.join(adminDir, `${resource.name}`, `routes.ts`);
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        const componentBaseName = pascalCase(resource.name);

        let statements = `import { RouteObject } from 'react-router-dom';\n`;
        let routes = [];

        if (resource.operations.some(op => op.action === 'list')) {
            statements += `import { ${componentBaseName}List } from './${resource.name}-list';\n`;
            routes.push(`{ path: '', element: <${componentBaseName}List /> }`);
        }

        if (resource.isEditable) {
            statements += `import { ${componentBaseName}Form } from './${resource.name}-form';\n`;
            routes.push(`{ path: 'new', element: <${componentBaseName}Form /> }`);
            routes.push(`{ path: 'edit/:id', element: <${componentBaseName}Form /> }`);
        }

        statements += `\n/**\n * Application Routes for ${resource.name}.\n */\nexport const ${resource.name}Routes: RouteObject[] = [\n    ${routes.join(',\n    ')}\n];\n`;
        sourceFile.addStatements(statements);

        return sourceFile;
    }

    /**
     * Generates the master App Shell and Routing setup.
     * @param resources All discovered resources.
     * @param adminDir The root admin directory.
     * @returns The generated App Shell source file.
     */
    public generateMaster(resources: Resource[], adminDir: string): SourceFile {
        const filePath = path.join(adminDir, `app.tsx`);
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        let statements = `import React, { Suspense, lazy } from 'react';\nimport { BrowserRouter, Routes, Route, Link } from 'react-router-dom';\nimport { useTranslation } from './shared/i18n.js';\n\n`;

        const routeLines: string[] = [];
        const linkLines: string[] = [];

        for (const res of resources) {
            const compName = `${pascalCase(res.name)}List`;
            if (res.operations.some(op => op.action === 'list')) {
                statements += `const ${compName} = lazy(() => import('./${res.name}/${res.name}-list.js').then(m => ({ default: m.${compName} })));\n`;
                routeLines.push(`                        <Route path="/${res.name}" element={<${compName} />} />`);
                linkLines.push(
                    `                        <li><Link to="/${res.name}">{t('nav.${res.name}', '${pascalCase(res.name)}')}</Link></li>`,
                );
            }
            if (res.isEditable) {
                const formName = `${pascalCase(res.name)}Form`;
                statements += `const ${formName} = lazy(() => import('./${res.name}/${res.name}-form.js').then(m => ({ default: m.${formName} })));\n`;
                routeLines.push(`                        <Route path="/${res.name}/new" element={<${formName} />} />`);
                routeLines.push(
                    `                        <Route path="/${res.name}/edit/:id" element={<${formName} />} />`,
                );
            }
        }

        statements += `\n/**\n * Auto-generated App Shell and Router mapping.\n */\nexport const App = () => {
    const { t } = useTranslation();

    return (
        <BrowserRouter>
            <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh' }}>
                <aside style={{ width: '250px', borderRight: '1px solid #ccc', padding: '1rem' }}>
                    <nav aria-label={t('main_nav', 'Main Navigation')}>
                        <h2>{t('admin_menu', 'Admin Menu')}</h2>
                        <ul style={{ listStyleType: 'none', padding: 0 }}>
${linkLines.join('\n')}
                        </ul>
                    </nav>
                </aside>
                <main style={{ flex: 1, padding: '2rem' }} role="main">
                    <Suspense fallback={<div role="status" aria-live="polite">{t('loading_module', 'Loading module...')}</div>}>
                        <Routes>
${routeLines.join('\n')}
                            <Route path="/" element={<div>{t('welcome_message', 'Welcome to the Admin Dashboard')}</div>} />
                        </Routes>
                    </Suspense>
                </main>
            </div>
        </BrowserRouter>
    );
};\n`;

        sourceFile.addStatements(statements);
        return sourceFile;
    }
}
