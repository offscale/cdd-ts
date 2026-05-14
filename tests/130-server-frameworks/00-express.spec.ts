import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ExpressServerGenerator } from '../../src/vendors/express/express-server.generator.js';

describe('ExpressServerGenerator', () => {
    it('should generate routes, route tests, and E2E tests for TypeORM configuration', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new ExpressServerGenerator();

        generator.generateEntityRoutes(project, 'User', '/out/entities', 'typeorm', {
            options: { tests: true },
        } as any);

        // Check router file generation
        const routeFile = project.getSourceFileOrThrow('/out/entities/user.routes.ts');
        const routeText = routeFile.getFullText();
        expect(routeText).toContain('export function createUserRouter(dataSource: DataSource): Router {');
        expect(routeText).toContain('const repository = dataSource.getRepository(User);');

        // Check route unit test file generation
        const routeTestFile = project.getSourceFileOrThrow('/out/entities/user.routes.spec.ts');
        const routeTestText = routeTestFile.getFullText();
        expect(routeTestText).toContain("describe('User Routes (Unit)', () => {");
        expect(routeTestText).toContain('expect(mockRepository.find).toHaveBeenCalled();');

        // Check E2E test file generation
        const e2eTestFile = project.getSourceFileOrThrow('/out/entities/user.e2e.spec.ts');
        const e2eTestText = e2eTestFile.getFullText();
        expect(e2eTestText).toContain("describe('User E2E (Routes + Storage)', () => {");
        expect(e2eTestText).toContain("type: 'sqlite',");
        expect(e2eTestText).toContain('entities: [User],');
    });

    it('should generate dummy routes, route tests, and E2E tests without ORM configuration', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new ExpressServerGenerator();

        generator.generateEntityRoutes(project, 'User', '/out/entities', undefined, {
            options: { tests: true },
        } as any);

        // Check router file generation
        const routeFile = project.getSourceFileOrThrow('/out/entities/user.routes.ts');
        const routeText = routeFile.getFullText();
        expect(routeText).toContain('export function createUserRouter(): Router {');
        expect(routeText).toContain('res.json([]);');

        // Check route unit test file generation
        const routeTestFile = project.getSourceFileOrThrow('/out/entities/user.routes.spec.ts');
        const routeTestText = routeTestFile.getFullText();
        expect(routeTestText).toContain("describe('User Routes (Unit)', () => {");
        expect(routeTestText).not.toContain('mockRepository');

        // Check E2E test file generation
        const e2eTestFile = project.getSourceFileOrThrow('/out/entities/user.e2e.spec.ts');
        const e2eTestText = e2eTestFile.getFullText();
        expect(e2eTestText).toContain("describe('User E2E (Routes)', () => {");
        expect(e2eTestText).not.toContain('DataSource');
    });

    it('should respect config.options.tests being false', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new ExpressServerGenerator();
        const config: any = { options: { tests: false } };

        generator.generateEntityRoutes(project, 'User', '/out/entities', undefined, config);

        // route file generated
        expect(project.getSourceFile('/out/entities/user.routes.ts')).toBeDefined();

        // test files omitted
        expect(project.getSourceFile('/out/entities/user.routes.spec.ts')).toBeUndefined();
        expect(project.getSourceFile('/out/entities/user.e2e.spec.ts')).toBeUndefined();
    });

    it('should default to no tests if config is omitted', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new ExpressServerGenerator();

        generator.generateEntityRoutes(project, 'User', '/out/entities', undefined);

        // route file generated
        expect(project.getSourceFile('/out/entities/user.routes.ts')).toBeDefined();

        // test files omitted
        expect(project.getSourceFile('/out/entities/user.routes.spec.ts')).toBeUndefined();
        expect(project.getSourceFile('/out/entities/user.e2e.spec.ts')).toBeUndefined();
    });
});
