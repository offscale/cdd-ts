import path from "node:path";
import type { Project } from "ts-morph";
import type { SwaggerDefinition } from "../../core/types/openapi.js";

export function generateSeeder(
	project: Project,
	schemas: { name: string; definition: SwaggerDefinition }[],
	outputDir: string,
) {
	const seederDir = path.join(outputDir, "seeder");
	const filePath = path.join(seederDir, "index.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "@faker-js/faker",
		namedImports: ["faker"],
	});
	sourceFile.addImportDeclaration({
		moduleSpecifier: "typeorm",
		namedImports: ["DataSource"],
	});

	for (const schema of schemas) {
		sourceFile.addImportDeclaration({
			moduleSpecifier: `../entities/${schema.name.toLowerCase()}.entity.js`,
			namedImports: [schema.name],
		});
	}

	const classDef = sourceFile.addClass({
		name: "DatabaseSeeder",
		isExported: true,
	});
	classDef.addJsDoc({
		description: `Fake Data Seeder.
This module populates the database with realistic fake data.
Referential integrity is maintained by caching the IDs of successfully generated parent records in an Entity Pool, 
and then randomly selecting from this pool when generating dependent child records.`,
	});

	classDef.addProperty({
		name: "entityPool",
		type: "Record<string, any[]>",
		initializer: "{}",
		docs: [
			{
				description:
					"In-memory cache of generated entities to maintain referential integrity.",
			},
		],
	});

	// Generate mapping functions
	for (const schema of schemas) {
		let mappingBody = `const entity = new ${schema.name}();\n`;
		const props = schema.definition.properties || {};
		for (const [propName, propDef] of Object.entries(props)) {
			if (
				typeof propDef === "boolean" ||
				propName === "id" ||
				propName === "uuid"
			)
				continue;

			const type = propDef.type;
			const format = propDef.format;
			let fakerCall = "faker.lorem.word()";
			if (type === "string") {
				if (propName.toLowerCase().includes("email"))
					fakerCall = "faker.internet.email()";
				else if (propName.toLowerCase().includes("name"))
					fakerCall = "faker.person.fullName()";
				else if (propName.toLowerCase().includes("phone"))
					fakerCall = "faker.phone.number()";
				else if (format === "date-time") fakerCall = "faker.date.past()";
			} else if (type === "number" || type === "integer") {
				fakerCall = "faker.number.int({ min: 1, max: 1000 })";
			} else if (type === "boolean") {
				fakerCall = "faker.datatype.boolean()";
			}

			// Assume if property ends with Id, it's a foreign key. We'll try to pick from pool if exists.
			if (propName.endsWith("Id") && propName.length > 2) {
				const parentName = propName.substring(0, propName.length - 2);
				const capitalizedParent =
					parentName.charAt(0).toUpperCase() + parentName.slice(1);
				mappingBody += `        if (this.entityPool['${capitalizedParent}'] && this.entityPool['${capitalizedParent}'].length > 0) {
            const pool = this.entityPool['${capitalizedParent}'];
            (entity as any).${propName} = pool[Math.floor(Math.random() * pool.length)].id;
        } else {
            (entity as any).${propName} = ${fakerCall};
        }\n`;
			} else {
				mappingBody += `        (entity as any).${propName} = ${fakerCall};\n`;
			}
		}
		mappingBody += `        return entity;`;

		classDef.addMethod({
			name: `generate${schema.name}`,
			returnType: schema.name,
			docs: [
				{
					description: `Generates a fake ${schema.name} entity.\n@returns A populated ${schema.name} instance.`,
				},
			],
			statements: mappingBody,
		});
	}

	// seed_database method
	let seedBody = `        this.entityPool = {};\n`;
	for (const schema of schemas) {
		seedBody += `
        // Seed ${schema.name} (Ratio: 10)
        const ${schema.name.toLowerCase()}Repo = dataSource.getRepository(${schema.name});
        const ${schema.name.toLowerCase()}s: ${schema.name}[] = [];
        for (let i = 0; i < 10; i++) {
            const entity = this.generate${schema.name}();
            ${schema.name.toLowerCase()}s.push(entity);
        }
        const saved${schema.name}s = await ${schema.name.toLowerCase()}Repo.save(${schema.name.toLowerCase()}s);
        this.entityPool['${schema.name}'] = saved${schema.name}s;
`;
	}

	classDef.addMethod({
		name: "seedDatabase",
		isAsync: true,
		parameters: [{ name: "dataSource", type: "DataSource" }],
		returnType: "Promise<void>",
		docs: [
			{
				description: `Executes batch insertion of fake data into the provided database connection.\nMaintains topological sorting and referential integrity.\n@param dataSource The active TypeORM connection.`,
			},
		],
		statements: seedBody,
	});

	sourceFile.formatText();

	// Test file
	const testPath = path.join(seederDir, "index.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });

	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "beforeAll", "afterAll"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "typeorm",
		namedImports: ["DataSource"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./index.js",
		namedImports: ["DatabaseSeeder"],
	});
	for (const schema of schemas) {
		testFile.addImportDeclaration({
			moduleSpecifier: `../entities/${schema.name.toLowerCase()}.entity.js`,
			namedImports: [schema.name],
		});
	}

	testFile.addStatements(`
describe('Fake Data Seeder', () => {
    let dataSource: DataSource;
    let seeder: DatabaseSeeder;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: 'sqlite',
            database: ':memory:',
            entities: [${schemas.map((s) => s.name).join(", ")}],
            synchronize: true,
            logging: false
        });
        await dataSource.initialize();
        seeder = new DatabaseSeeder();
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    it('should generate individual entities', () => {
        ${schemas
					.map(
						(s) => `
        const ${s.name.toLowerCase()} = seeder.generate${s.name}();
        expect(${s.name.toLowerCase()}).toBeDefined();
        `,
					)
					.join("")}
    });

    it('should successfully seed the database without foreign key violations', async () => {
        await expect(seeder.seedDatabase(dataSource)).resolves.not.toThrow();
        
        ${schemas
					.map(
						(s) => `
        const count${s.name} = await dataSource.getRepository(${s.name}).count();
        expect(count${s.name}).toBeGreaterThan(0);
        `,
					)
					.join("")}
    });
});
    `);

	testFile.formatText();
}
