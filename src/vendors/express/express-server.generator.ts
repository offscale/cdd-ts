import { Project } from 'ts-morph';
import path from 'node:path';
import { IServerFrameworkGenerator } from '../../core/server/index.js';

/**
 * Express framework generator implementation.
 * Generates Express.js routers and tests.
 */
export class ExpressServerGenerator implements IServerFrameworkGenerator {
    /**
     * Generates Express routes and corresponding tests for a given entity.
     * @param project The ts-morph project.
     * @param schemaName The name of the schema/entity.
     * @param outputDir The directory to save the route in.
     * @param orm The ORM being used, if any.
     */
    public generateEntityRoutes(project: Project, schemaName: string, outputDir: string, orm?: string): void {
        this.generateEntityRoute(project, schemaName, outputDir, orm);
        this.generateRouteTest(project, schemaName, outputDir, orm);
        this.generateE2ETest(project, schemaName, outputDir, orm);
    }

    private generateEntityRoute(project: Project, schemaName: string, outputDir: string, orm?: string): void {
        const fileName = schemaName.toLowerCase();
        const filePath = path.join(outputDir, `${fileName}.routes.ts`);
        const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addImportDeclaration({
            moduleSpecifier: 'express',
            namedImports: ['Router', 'Request', 'Response', 'NextFunction'],
        });

        if (orm === 'typeorm') {
            sourceFile.addImportDeclaration({
                moduleSpecifier: 'typeorm',
                namedImports: ['DataSource'],
            });

            sourceFile.addImportDeclaration({
                moduleSpecifier: `./${fileName}.entity.js`,
                namedImports: [schemaName],
            });

            sourceFile.addStatements(`
/**
 * Creates an Express Router for the ${schemaName} entity.
 * @param dataSource The active TypeORM DataSource.
 * @returns An Express Router instance.
 */
export function create${schemaName}Router(dataSource: DataSource): Router {
    const router = Router();
    const repository = dataSource.getRepository(${schemaName});

    /**
     * GET /
     * Retrieves all ${schemaName} entities.
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const entities = await repository.find();
            res.json(entities);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /
     * Creates a new ${schemaName} entity.
     */
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            // TODO: Validate req.body against the ${schemaName} schema before saving to prevent Mass Assignment
            const entity = repository.create(req.body);
            const saved = await repository.save(entity);
            res.status(201).json(saved);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
            `);
        } else {
            sourceFile.addStatements(`
/**
 * Creates an Express Router for the ${schemaName} entity.
 * @returns An Express Router instance.
 */
export function create${schemaName}Router(): Router {
    const router = Router();

    /**
     * GET /
     * Retrieves all ${schemaName} entities.
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.json([]);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
            `);
        }

        sourceFile.formatText();
    }

    private generateRouteTest(project: Project, schemaName: string, outputDir: string, orm?: string): void {
        const fileName = schemaName.toLowerCase();
        const filePath = path.join(outputDir, `${fileName}.routes.spec.ts`);
        const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.addStatements(`import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { create${schemaName}Router } from './${fileName}.routes.js';\n`);

        if (orm === 'typeorm') {
            sourceFile.addStatements(`import { DataSource } from 'typeorm';

describe('${schemaName} Routes (Unit)', () => {
    let app: express.Application;
    let mockRepository: any;
    let mockDataSource: any;

    beforeEach(() => {
        mockRepository = {
            find: vi.fn().mockResolvedValue([{ id: 1 }]),
            create: vi.fn().mockImplementation((data: any) => data),
            save: vi.fn().mockImplementation(async (data: any) => ({ id: 1, ...data }))
        };

        mockDataSource = {
            getRepository: vi.fn().mockReturnValue(mockRepository)
        } as unknown as DataSource;

        app = express();
        app.use(express.json());
        app.use('/${fileName}', create${schemaName}Router(mockDataSource));
    });

    it('GET /${fileName} should return entities', async () => {
        const res = await request(app).get('/${fileName}');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ id: 1 }]);
        expect(mockRepository.find).toHaveBeenCalled();
    });

    it('POST /${fileName} should create an entity', async () => {
        const res = await request(app).post('/${fileName}').send({ someData: 'test' });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ id: 1, someData: 'test' });
        expect(mockRepository.save).toHaveBeenCalled();
    });
});
            `);
        } else {
            sourceFile.addStatements(`
describe('${schemaName} Routes (Unit)', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/${fileName}', create${schemaName}Router());
    });

    it('GET /${fileName} should return entities', async () => {
        const res = await request(app).get('/${fileName}');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});
            `);
        }

        sourceFile.formatText();
    }

    private generateE2ETest(project: Project, schemaName: string, outputDir: string, orm?: string): void {
        const fileName = schemaName.toLowerCase();
        const filePath = path.join(outputDir, `${fileName}.e2e.spec.ts`);
        const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

        if (orm === 'typeorm') {
            sourceFile.addStatements(`
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DataSource } from 'typeorm';
import { ${schemaName} } from './${fileName}.entity.js';
import { create${schemaName}Router } from './${fileName}.routes.js';

describe('${schemaName} E2E (Routes + Storage)', () => {
    let app: express.Application;
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: 'sqlite',
            database: ':memory:',
            entities: [${schemaName}],
            synchronize: true,
            logging: false
        });
        await dataSource.initialize();

        app = express();
        app.use(express.json());
        app.use('/${fileName}', create${schemaName}Router(dataSource));
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('should perform CRUD operations on ${schemaName}', async () => {
        let res = await request(app).get('/${fileName}');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);

        res = await request(app).post('/${fileName}').send({});
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');

        res = await request(app).get('/${fileName}');
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
    });
});
            `);
        } else {
            sourceFile.addStatements(`
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { create${schemaName}Router } from './${fileName}.routes.js';

describe('${schemaName} E2E (Routes)', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/${fileName}', create${schemaName}Router());
    });

    it('should perform GET on ${schemaName}', async () => {
        const res = await request(app).get('/${fileName}');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});
            `);
        }

        sourceFile.formatText();
    }
}
