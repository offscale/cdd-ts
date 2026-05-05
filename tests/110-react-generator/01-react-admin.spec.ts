import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ReactAdminGenerator } from '@src/vendors/react/admin/admin.generator.js';
import { ListComponentGenerator } from '@src/vendors/react/admin/list-component.generator.js';
import { FormComponentGenerator } from '@src/vendors/react/admin/form-component.generator.js';
import { RoutingGenerator } from '@src/vendors/react/admin/routing.generator.js';
import { SwaggerParser } from '@src/openapi/parse.js';
import { CustomValidatorsGenerator } from '@src/vendors/react/admin/custom-validators.generator.js';
import { StylingBuilder } from '@src/vendors/react/admin/styling.builder.js';
import { AdminTestGenerator } from '@src/vendors/react/admin/admin-test.generator.js';
import { FormRenderer } from '@src/vendors/react/admin/form.renderer.js';
import { ReactElementBuilder } from '@src/vendors/react/admin/html-element.builder.js';
import { I18nGenerator } from '@src/vendors/react/admin/i18n.generator.js';
import { Resource } from '@src/core/types/index.js';

const mockDoc: any = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
        '/users': {
            get: {
                operationId: 'getUsers',
                responses: { '200': { description: 'OK' } },
            },
            post: {
                operationId: 'createUser',
                responses: { '201': { description: 'Created' } },
            },
        },
        '/settings': {
            put: {
                operationId: 'updateSettings',
                responses: { '200': { description: 'OK' } },
            },
        },
    },
};

describe('ReactAdminGenerator', () => {
    let project: Project;
    let parser: SwaggerParser;

    beforeEach(async () => {
        project = new Project({ useInMemoryFileSystem: true });
        parser = new SwaggerParser(mockDoc, {} as any);
    });

    it('generates admin UI files successfully', async () => {
        const generator = new ReactAdminGenerator(parser, project);
        await generator.generate('/out');

        expect(project.getSourceFile('/out/admin/users/users-list.spec.tsx')).toBeDefined();
        expect(project.getSourceFile('/out/admin/users/users-list.css')).toBeDefined();
        expect(project.getSourceFile('/out/admin/shared/validators.ts')).toBeDefined();
        expect(project.getSourceFile('/out/admin/shared/i18n.ts')).toBeDefined();
        expect(project.getSourceFile('/out/admin/users/users-form.tsx')).toBeDefined();
        expect(project.getSourceFile('/out/admin/users/routes.ts')).toBeDefined();
        expect(project.getSourceFile('/out/admin/app.tsx')).toBeDefined();
    });

    it('handles existing admin directory', async () => {
        project.getFileSystem().mkdirSync('/out/admin');
        const generator = new ReactAdminGenerator(parser, project);
        await generator.generate('/out');
        expect(project.getSourceFile('/out/admin/app.tsx')).toBeDefined();
    });

    it('skips generation when no admin resources are found', async () => {
        const emptyDoc: any = {
            openapi: '3.0.0',
            info: { title: 'Empty API', version: '1.0.0' },
            paths: {},
        };
        const emptyParser = new SwaggerParser(emptyDoc, {} as any);

        const generator = new ReactAdminGenerator(emptyParser, project);
        await generator.generate('/out');

        const fs = project.getFileSystem();
        expect(fs.directoryExistsSync('/out/admin')).toBe(false);
    });

    it('generates only list components and skips forms when resources are read-only', async () => {
        const readOnlyDoc: any = {
            openapi: '3.0.0',
            info: { title: 'Read Only API', version: '1.0.0' },
            paths: {
                '/reports': {
                    get: {
                        operationId: 'getReports',
                        responses: { '200': { description: 'OK' } },
                    },
                },
            },
        };
        const readOnlyParser = new SwaggerParser(readOnlyDoc, {} as any);

        const generator = new ReactAdminGenerator(readOnlyParser, project);
        await generator.generate('/out');

        expect(project.getSourceFile('/out/admin/reports/reports-list.tsx')).toBeDefined();
        // Should not generate form for read-only resource
        expect(project.getSourceFile('/out/admin/reports/reports-form.tsx')).toBeUndefined();
        // Should not generate validators if no resource is editable
        expect(project.getSourceFile('/out/admin/shared/validators.ts')).toBeUndefined();
    });
});

describe('ListComponentGenerator', () => {
    it('generates a React list component', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new ListComponentGenerator(project);
        const resource = { name: 'products', operations: [], isEditable: false } as unknown as Resource;
        const file = gen.generate(resource, '/out');
        expect(file.getText()).toContain('export const ProductsList');
    });

    it('uses operation method name if provided', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new ListComponentGenerator(project);
        const resource = {
            name: 'products',
            operations: [{ action: 'list', methodName: 'fetchProducts' }],
            isEditable: false,
        } as unknown as Resource;
        const file = gen.generate(resource, '/out');
        expect(file.getText()).toContain('useFetchProducts');
    });
});

describe('FormComponentGenerator', () => {
    it('generates a React form component', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new FormComponentGenerator(project);
        const resource = {
            name: 'products',
            operations: [],
            isEditable: true,
            formProperties: [],
        } as unknown as Resource;
        const file = gen.generate(resource, '/out');
        expect(file.getText()).toContain('export const ProductsForm');
    });

    it('uses operation method names if provided', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new FormComponentGenerator(project);
        const resource = {
            name: 'products',
            operations: [
                { action: 'getById', methodName: 'fetchProduct' },
                { action: 'create', methodName: 'makeProduct' },
                { action: 'update', methodName: 'editProduct' },
            ],
            isEditable: true,
            formProperties: [{ name: 'count', schema: { type: 'number' } }],
        } as unknown as Resource;
        const file = gen.generate(resource, '/out');
        expect(file.getText()).toContain('useFetchProduct');
        expect(file.getText()).toContain('useMakeProduct');
        expect(file.getText()).toContain('useEditProduct');
        expect(file.getText()).toContain('type="number"');
    });
});

describe('RoutingGenerator', () => {
    it('generates routes and app shell', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new RoutingGenerator(project);
        const resource = { name: 'products', operations: [], isEditable: true } as unknown as Resource;
        const routeFile = gen.generate(resource, '/out');
        expect(routeFile.getText()).toContain('export const productsRoutes: RouteObject[]');

        const masterFile = gen.generateMaster([resource], '/out');
        expect(masterFile.getText()).toContain('export const App = ()');
    });
});

describe('I18nGenerator', () => {
    it('generates an i18n hook scaffold', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new I18nGenerator(project);
        const file = gen.generate('/out');
        expect(file.getText()).toContain('export const useTranslation');
    });
});

describe('CustomValidatorsGenerator', () => {
    it('generates a shared validators file', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new CustomValidatorsGenerator(project);
        const file = gen.generate('/out');
        expect(file.getText()).toContain('export const isRequired');
    });
});

describe('StylingBuilder', () => {
    it('generates a css file', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new StylingBuilder(project);
        const file = gen.generateCss('my-component', '/out');
        expect(file.getText()).toContain('.my-component-container');
    });
});

describe('AdminTestGenerator', () => {
    it('generates a spec file for a form component', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new AdminTestGenerator(project);
        const file = gen.generate('MyForm', '/out');
        expect(file.getText()).toContain("describe('MyForm'");
        expect(file.getText()).toContain('renders create mode');
    });

    it('generates a spec file for a list component', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const gen = new AdminTestGenerator(project);
        const file = gen.generate('MyList', '/out');
        expect(file.getText()).toContain("describe('MyList'");
        expect(file.getText()).toContain('renders loading state');
    });
});

describe('FormRenderer', () => {
    it('extracts field properties', () => {
        const resource = {
            name: 'users',
            operations: [],
            isEditable: true,
            formProperties: [{ name: 'id', schema: { type: 'string' } }],
        };
        const fields = FormRenderer.extractFields(resource as any);
        expect(fields.length).toBeGreaterThan(0);
        expect(fields[0].name).toBe('id');
    });

    it('returns an empty array if no form properties exist', () => {
        const resource = { name: 'users', operations: [], isEditable: true };
        const fields = FormRenderer.extractFields(resource as any);
        expect(fields).toEqual([]);
    });
});

describe('ReactElementBuilder', () => {
    it('builds a functional component', () => {
        const result = ReactElementBuilder.buildFunctionalComponent(
            'MyComponent',
            ['import React from "react";'],
            '',
            '<span/>',
        );
        expect(result).toContain('export const MyComponent');
        expect(result).toContain('<span/>');
    });
    it('builds an input element', () => {
        const result = ReactElementBuilder.buildInput('myField', 'number');
        expect(result).toContain('name="myField"');
        expect(result).toContain('type="number"');
    });
});
