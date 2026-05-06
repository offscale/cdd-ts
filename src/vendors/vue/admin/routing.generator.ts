import { Project } from 'ts-morph';
import * as path from 'node:path';
import { Resource } from '@src/core/types/index.js';
import { pascalCase } from '@src/functions/utils.js';

/**
 * Generates routing files for the Vue Admin Interface.
 */
export class RoutingGenerator {
    /**
     * Initializes a new RoutingGenerator.
     * @param project The ts-morph project for writing source files.
     */
    constructor(private project: Project) {}

    /**
     * Generates a resource-specific route definition file.
     * @param resource The resource to generate routes for.
     * @param adminDir The root admin directory.
     */
    public generate(resource: Resource, adminDir: string): void {
        const resourceDir = path.posix.join(adminDir, resource.name);
        const filePath = path.posix.join(resourceDir, 'routes.ts');
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addImportDeclarations([{ moduleSpecifier: 'vue-router', namedImports: ['RouteRecordRaw'] }]);

        const routes: string[] = [];

        if (resource.operations.some(op => op.action === 'list')) {
            sourceFile.addImportDeclaration({
                moduleSpecifier: `./${pascalCase(resource.name)}List.vue`,
                defaultImport: 'List',
            });
            routes.push(`{ path: '/${resource.name}', component: List, name: '${resource.name}List' }`);
        }

        if (resource.isEditable) {
            sourceFile.addImportDeclaration({
                moduleSpecifier: `./${pascalCase(resource.name)}Form.vue`,
                defaultImport: 'Form',
            });
            routes.push(`{ path: '/${resource.name}/new', component: Form, name: '${resource.name}Create' }`);
            routes.push(
                `{ path: '/${resource.name}/:id/edit', component: Form, name: '${resource.name}Edit', props: true }`,
            );
        }

        sourceFile.addStatements(`export const routes: RouteRecordRaw[] = [\n    ${routes.join(',\n    ')}\n];\n`);
        sourceFile.formatText();
    }

    /**
     * Generates the master App.vue shell and the root router definition.
     * @param resources The list of all resources.
     * @param adminDir The root admin directory.
     */
    public generateMaster(resources: Resource[], adminDir: string): void {
        const appFilePath = path.posix.join(adminDir, 'App.vue');

        const links = resources
            .filter(r => r.operations.some(op => op.action === 'list'))
            .map(r => `        <router-link to="/${r.name}" class="nav-link">${r.name}</router-link>`)
            .join('\n');

        const appTemplate = `
<template>
  <div class="admin-app">
    <nav class="sidebar">
      <div class="sidebar-header">
        <h2>Admin Panel</h2>
      </div>
      <div class="sidebar-nav">
${links}
      </div>
    </nav>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-app {
  display: flex;
  min-height: 100vh;
  font-family: sans-serif;
}
.sidebar {
  width: 250px;
  background: #f8f9fa;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
}
.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid #ddd;
}
.sidebar-header h2 {
  margin: 0;
  font-size: 1.25rem;
}
.sidebar-nav {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.nav-link {
  text-decoration: none;
  color: #333;
  padding: 0.5rem;
  border-radius: 4px;
}
.nav-link:hover, .nav-link.router-link-active {
  background: #e9ecef;
  color: #000;
}
.content {
  flex: 1;
  padding: 2rem;
  background: #fff;
}
</style>
`.trim();

        // Using createSourceFile directly with the Vue content works to write the file content.
        this.project.createSourceFile(appFilePath, appTemplate, { overwrite: true });

        const routerFilePath = path.posix.join(adminDir, 'router.ts');
        const routerFile = this.project.createSourceFile(routerFilePath, '', { overwrite: true });

        routerFile.addImportDeclarations([
            { moduleSpecifier: 'vue-router', namedImports: ['createRouter', 'createWebHistory', 'RouteRecordRaw'] },
        ]);

        const routeImports: string[] = [];
        const routeSpreads: string[] = [];

        resources.forEach(r => {
            if (r.operations.some(op => op.action === 'list') || r.isEditable) {
                routeImports.push(`import { routes as ${r.name}Routes } from './${r.name}/routes.js';`);
                routeSpreads.push(`...${r.name}Routes`);
            }
        });

        const routerStatements = `
${routeImports.join('\n')}

export const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/${resources[0].name}' },
    ${routeSpreads.join(',\n    ')}
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});
`.trim();

        routerFile.addStatements(routerStatements);
        routerFile.formatText();
    }
}
