import path from "node:path";
import type { Project } from "ts-morph";

export function generateDao(
	project: Project,
	schemaName: string,
	outputDir: string,
) {
	const daoDir = path.join(outputDir, "dao");
	generateInterface(project, schemaName, daoDir);
	generateStub(project, schemaName, daoDir);
	generateConcrete(project, schemaName, daoDir);
	generateDaoTests(project, schemaName, daoDir);
}

function generateInterface(
	project: Project,
	schemaName: string,
	daoDir: string,
) {
	const filePath = path.join(daoDir, `I${schemaName}Dao.ts`);
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: `../entities/${schemaName.toLowerCase()}.entity.js`,
		namedImports: [schemaName],
	});

	const iface = sourceFile.addInterface({
		name: `I${schemaName}Dao`,
		isExported: true,
	});
	iface.addJsDoc({
		description: `Data Access Object interface for ${schemaName}.`,
	});

	iface.addMethod({
		name: "find",
		returnType: `Promise<${schemaName}[]>`,
		docs: [{ description: `Retrieves all ${schemaName} records.` }],
	});

	iface.addMethod({
		name: "create",
		parameters: [{ name: "data", type: `Partial<${schemaName}>` }],
		returnType: `Promise<${schemaName}>`,
		docs: [{ description: `Creates a new ${schemaName} record.` }],
	});

	sourceFile.formatText();
}

function generateStub(project: Project, schemaName: string, daoDir: string) {
	const filePath = path.join(daoDir, `${schemaName.toLowerCase()}.stub.dao.ts`);
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: `../entities/${schemaName.toLowerCase()}.entity.js`,
		namedImports: [schemaName],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: `./I${schemaName}Dao.js`,
		namedImports: [`I${schemaName}Dao`],
	});

	const cls = sourceFile.addClass({
		name: `${schemaName}StubDao`,
		isExported: true,
		implements: [`I${schemaName}Dao`],
	});
	cls.addJsDoc({
		description: `Stub Data Access Object for ${schemaName}. Returns empty or default values.`,
	});

	cls.addMethod({
		name: "find",
		isAsync: true,
		returnType: `Promise<${schemaName}[]>`,
		docs: [{ description: `Retrieves all ${schemaName} records.` }],
		statements: `return [];`,
	});

	cls.addMethod({
		name: "create",
		isAsync: true,
		parameters: [{ name: "data", type: `Partial<${schemaName}>` }],
		returnType: `Promise<${schemaName}>`,
		docs: [{ description: `Creates a new ${schemaName} record.` }],
		statements: `throw new Error("NotImplementedError");`,
	});

	sourceFile.formatText();
}

function generateConcrete(
	project: Project,
	schemaName: string,
	daoDir: string,
) {
	const filePath = path.join(
		daoDir,
		`${schemaName.toLowerCase()}.concrete.dao.ts`,
	);
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "typeorm",
		namedImports: ["Repository", "DataSource"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: `../entities/${schemaName.toLowerCase()}.entity.js`,
		namedImports: [schemaName],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: `./I${schemaName}Dao.js`,
		namedImports: [`I${schemaName}Dao`],
	});

	const cls = sourceFile.addClass({
		name: `${schemaName}ConcreteDao`,
		isExported: true,
		implements: [`I${schemaName}Dao`],
	});
	cls.addJsDoc({
		description: `Concrete Data Access Object for ${schemaName} using TypeORM.`,
	});

	cls.addProperty({
		name: "repository",
		type: `Repository<${schemaName}>`,
		docs: [{ description: `The TypeORM repository for ${schemaName}.` }],
	});

	const ctor = cls.addConstructor({
		parameters: [{ name: "dataSource", type: "DataSource" }],
	});
	ctor.addStatements(
		`this.repository = dataSource.getRepository(${schemaName});`,
	);
	ctor.addJsDoc({
		description: `Initializes the concrete DAO with a database connection.\n@param dataSource The TypeORM data source.`,
	});

	cls.addMethod({
		name: "find",
		isAsync: true,
		returnType: `Promise<${schemaName}[]>`,
		docs: [{ description: `Retrieves all ${schemaName} records.` }],
		statements: `return await this.repository.find();`,
	});

	cls.addMethod({
		name: "create",
		isAsync: true,
		parameters: [{ name: "data", type: `Partial<${schemaName}>` }],
		returnType: `Promise<${schemaName}>`,
		docs: [{ description: `Creates a new ${schemaName} record.` }],
		statements: `
        const entity = this.repository.create(data);
        return await this.repository.save(entity);`,
	});

	sourceFile.formatText();
}

function generateDaoTests(
	project: Project,
	schemaName: string,
	daoDir: string,
) {
	const filePath = path.join(daoDir, `${schemaName.toLowerCase()}.dao.spec.ts`);
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "beforeAll", "afterAll"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "typeorm",
		namedImports: ["DataSource"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: `../entities/${schemaName.toLowerCase()}.entity.js`,
		namedImports: [schemaName],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: `./${schemaName.toLowerCase()}.stub.dao.js`,
		namedImports: [`${schemaName}StubDao`],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: `./${schemaName.toLowerCase()}.concrete.dao.js`,
		namedImports: [`${schemaName}ConcreteDao`],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: `../mocks/${schemaName.toLowerCase()}.mock.js`,
		namedImports: [`fake${schemaName}`],
	});

	sourceFile.addStatements(`
	describe('${schemaName} DAOs', () => {
	describe('Stub DAO', () => {
	it('should return empty list for find', async () => {
	    const dao = new ${schemaName}StubDao();
	    const res = await dao.find();
	    expect(res).toEqual([]);
	});
	it('should throw error for create', async () => {
	    const dao = new ${schemaName}StubDao();
	    await expect(dao.create({})).rejects.toThrow('NotImplementedError');
	});
	});

	describe('Concrete DAO', () => {
	let dataSource: DataSource;
	let dao: ${schemaName}ConcreteDao;

	beforeAll(async () => {
	    dataSource = new DataSource({
	        type: 'sqlite',
	        database: ':memory:',
	        entities: [${schemaName}],
	        synchronize: true,
	        logging: false
	    });
	    await dataSource.initialize();
	    dao = new ${schemaName}ConcreteDao(dataSource);
	});

	afterAll(async () => {
	    await dataSource.destroy();
	});

	it('should perform find and create', async () => {
	    let res = await dao.find();
	    expect(res).toEqual([]);

	    const created = await dao.create(fake${schemaName}() as any);
	    expect(created).toBeDefined();

	    res = await dao.find();
	    expect(res.length).toBeGreaterThan(0);
	});
	});
	});
    `);

	sourceFile.formatText();
}

export function generateDaoFactory(
	project: Project,
	schemas: string[],
	outputDir: string,
) {
	const daoDir = path.join(outputDir, "dao");
	const filePath = path.join(daoDir, `factory.ts`);
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "typeorm",
		namedImports: ["DataSource"],
	});

	for (const schema of schemas) {
		sourceFile.addImportDeclaration({
			moduleSpecifier: `./I${schema}Dao.js`,
			namedImports: [`I${schema}Dao`],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: `./${schema.toLowerCase()}.stub.dao.js`,
			namedImports: [`${schema}StubDao`],
		});
		sourceFile.addImportDeclaration({
			moduleSpecifier: `./${schema.toLowerCase()}.concrete.dao.js`,
			namedImports: [`${schema}ConcreteDao`],
		});
	}

	const factoryCls = sourceFile.addClass({
		name: "DaoFactory",
		isExported: true,
	});
	factoryCls.addJsDoc({
		description: "Factory class for instantiating DAOs based on environment.",
	});

	for (const schema of schemas) {
		factoryCls.addMethod({
			name: `get${schema}Dao`,
			parameters: [
				{ name: "ephemeral", type: "boolean", hasQuestionToken: true },
				{ name: "dataSource", type: "DataSource", hasQuestionToken: true },
			],
			returnType: `I${schema}Dao`,
			docs: [
				{
					description: `Returns the appropriate DAO for ${schema}.\n@param ephemeral Whether to use ephemeral/stub.\n@param dataSource The TypeORM data source.`,
				},
			],
			statements: `
                if (!dataSource && !ephemeral) {
                    return new ${schema}StubDao();
                }
                if (dataSource) {
                    return new ${schema}ConcreteDao(dataSource);
                }
                return new ${schema}StubDao();
            `,
		});
	}

	sourceFile.formatText();

	// Factory Test
	const testPath = path.join(daoDir, `factory.spec.ts`);
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });

	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "typeorm",
		namedImports: ["DataSource"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: `./factory.js`,
		namedImports: ["DaoFactory"],
	});
	for (const schema of schemas) {
		testFile.addImportDeclaration({
			moduleSpecifier: `./${schema.toLowerCase()}.stub.dao.js`,
			namedImports: [`${schema}StubDao`],
		});
		testFile.addImportDeclaration({
			moduleSpecifier: `./${schema.toLowerCase()}.concrete.dao.js`,
			namedImports: [`${schema}ConcreteDao`],
		});
	}

	testFile.addStatements(`
describe('DaoFactory', () => {
    it('should return stub DAO when no dataSource is provided', () => {
        const factory = new DaoFactory();
        ${schemas.map((s) => `expect(factory.get${s}Dao()).toBeInstanceOf(${s}StubDao);`).join("\n        ")}
    });

    it('should return concrete DAO when dataSource is provided', () => {
        const factory = new DaoFactory();
        const mockDataSource = { getRepository: () => ({}) } as unknown as DataSource;
        ${schemas.map((s) => `expect(factory.get${s}Dao(false, mockDataSource)).toBeInstanceOf(${s}ConcreteDao);`).join("\n        ")}
    });
});
    `);

	testFile.formatText();
}
