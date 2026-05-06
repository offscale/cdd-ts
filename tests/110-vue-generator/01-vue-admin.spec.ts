import { describe, expect, it, vi } from 'vitest';
import { runGeneratorWithConfig } from '../shared/helpers.js';
import { coverageSpec, polymorphismSpec } from '../shared/specs.js';

import { VueAdminGenerator } from '../../src/vendors/vue/admin/admin.generator.js';
import { SwaggerParser } from '../../src/openapi/parse.js';

describe('Vue Admin Generation', () => {
    it('should generate a full admin UI from coverageSpec and handle existing directories', async () => {
        const project = await runGeneratorWithConfig(coverageSpec, {
            framework: 'vue',
            admin: true,
            generateServices: true,
        });

        // Call a second time to cover directoryExistsSync(dir) branch
        const parser = new SwaggerParser(coverageSpec as any, {});
        const adminGen = new VueAdminGenerator(parser, project);
        await adminGen.generate('/generated');

        // 1. Check generated main admin files
        const routingFile = project.getSourceFile('/generated/admin/router.ts');
        expect(routingFile).toBeDefined();
        const routesText = routingFile!.getText();
        expect(routesText).toContain('export const router =');
        expect(routesText).toContain("redirect: '/users'");

        const listComponent = project.getSourceFile('/generated/admin/users/UsersList.vue');
        expect(listComponent).toBeDefined();
        const listText = listComponent!.getText();
        expect(listText).toContain('useUsers');
        expect(listText).toContain('getUsers(');

        const formComponent = project.getSourceFile('/generated/admin/users/UsersForm.vue');
        expect(formComponent).toBeDefined();
        const formText = formComponent!.getText();
        expect(formText).toContain('useUsers');

        const i18nFile = project.getSourceFile('/generated/admin/shared/i18n.ts');
        expect(i18nFile).toBeDefined();
        const i18nText = i18nFile!.getText();
        expect(i18nText).toContain("'admin.save': 'Save'");

        const validatorsFile = project.getSourceFile('/generated/admin/shared/validators.ts');
        expect(validatorsFile).toBeDefined();

        const testFile = project.getSourceFile('/generated/admin/users/users-list.component.spec.ts');
        expect(testFile).toBeDefined();
    });

    it('should correctly generate a dynamic polymorphic form', async () => {
        const project = await runGeneratorWithConfig(polymorphismSpec, {
            framework: 'vue',
            admin: true,
            generateServices: true,
        });

        const formComponent = project.getSourceFile('/generated/admin/pets/PetsForm.vue');
        expect(formComponent).toBeDefined();
        const formText = formComponent!.getText();

        // Vue form generator is simpler and does not expand polymorphic options.
        // It should just generate a text input for the base properties (e.g., petType).
        expect(formText).toContain('v-model="formData.petType"');
    });

    it('should skip generation and warn if no valid admin resources are found', async () => {
        const emptySpec = { openapi: '3.0.0', info: { title: 'Empty API', version: '1.0.0' }, paths: {} };
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const project = await runGeneratorWithConfig(emptySpec, {
            framework: 'vue',
            admin: true,
            generateServices: true,
        });

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No resources suitable for admin UI generation'));
        expect(project.getSourceFile('/generated/admin/router.ts')).toBeUndefined();

        warnSpy.mockRestore();
    });

    it('should generate a form that gracefully handles unresolvable allOf refs', async () => {
        const specWithBadRef = {
            ...polymorphismSpec,
            paths: {
                ...polymorphismSpec.paths,
                '/bad-pets': {
                    post: {
                        tags: ['BadPets'],
                        requestBody: {
                            content: { 'application/json': { schema: { $ref: '#/components/schemas/BadPet' } } },
                        },
                        responses: { '200': { description: 'ok' } },
                    },
                },
            },
            components: {
                ...polymorphismSpec.components,
                schemas: {
                    ...polymorphismSpec.components.schemas,
                    BadPet: {
                        type: 'object',
                        oneOf: [{ $ref: '#/components/schemas/BadCat' }],
                        discriminator: { propertyName: 'petType' },
                        properties: { petType: { type: 'string' } },
                        required: ['petType'],
                    },
                    BadCat: {
                        type: 'object',
                        allOf: [
                            { $ref: '#/components/schemas/BasePet' }, // This one is good
                            { $ref: '#/components/schemas/NonExistentSchema' }, // This one is bad
                        ],
                        properties: { petType: { type: 'string', enum: ['badcat'] } },
                    },
                },
            },
        };

        const project = await runGeneratorWithConfig(specWithBadRef, {
            framework: 'vue',
            admin: true,
            generateServices: true,
        });

        const formComponent = project.getSourceFile('/generated/admin/badPets/BadPetsForm.vue');
        expect(formComponent).toBeDefined();
        const html = formComponent!.getText();

        expect(html).toContain('v-model="formData.petType"');
    });
});
