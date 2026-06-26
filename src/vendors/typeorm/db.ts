import path from "node:path";
import type { Project } from "ts-morph";

export function generateDatabaseConnection(
	project: Project,
	schemas: string[],
	outputDir: string,
) {
	const dbDir = path.join(outputDir, "db");

	// connection.ts
	const filePath = path.join(dbDir, "connection.ts");
	const sourceFile = project.createSourceFile(filePath, "", {
		overwrite: true,
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: "typeorm",
		namedImports: ["DataSource", "DataSourceOptions"],
	});

	for (const schema of schemas) {
		sourceFile.addImportDeclaration({
			moduleSpecifier: `../entities/${schema.toLowerCase()}.entity.js`,
			namedImports: [schema],
		});
	}

	const configInterface = sourceFile.addInterface({
		name: "DatabaseConfig",
		isExported: true,
	});
	configInterface.addJsDoc({
		description:
			"Configuration options for establishing the database connection.",
	});
	configInterface.addProperty({
		name: "databaseUrl",
		type: "string",
		hasQuestionToken: true,
		docs: [
			{
				description:
					"The connection URL for the target database (e.g., PostgreSQL).",
			},
		],
	});
	configInterface.addProperty({
		name: "ephemeral",
		type: "boolean",
		hasQuestionToken: true,
		docs: [
			{
				description:
					"If true, overrides databaseUrl to provision an in-memory ephemeral SQLite database.",
			},
		],
	});

	const entitiesList = `[${schemas.join(", ")}]`;

	sourceFile.addFunction({
		name: "createDatabaseConnection",
		isExported: true,
		isAsync: true,
		parameters: [{ name: "config", type: "DatabaseConfig" }],
		returnType: "Promise<DataSource | null>",
		docs: [
			{
				description:
					"Creates and initializes the TypeORM data source based on configuration.\n@param config The database configuration options.\n@returns The initialized DataSource, or null if no connection is configured.",
			},
		],
		statements: `
            if (!config.databaseUrl && !config.ephemeral) {
                return null;
            }

            let options: DataSourceOptions;

            if (config.ephemeral) {
                options = {
                    type: 'better-sqlite3',
                    database: ':memory:',
                    entities: ${entitiesList},
                    synchronize: true,
                    logging: false
                };
            } else {
                options = {
                    type: 'postgres',
                    url: config.databaseUrl,
                    entities: ${entitiesList},
                    synchronize: true, // Note: For production, use migrations instead of synchronize
                    logging: false
                };
            }

            const dataSource = new DataSource(options);
            await dataSource.initialize();
            return dataSource;
        `,
	});

	sourceFile.formatText();

	// connection.spec.ts
	const testPath = path.join(dbDir, "connection.spec.ts");
	const testFile = project.createSourceFile(testPath, "", { overwrite: true });

	testFile.addImportDeclaration({
		moduleSpecifier: "vitest",
		namedImports: ["describe", "it", "expect", "afterEach"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "typeorm",
		namedImports: ["DataSource"],
	});
	testFile.addImportDeclaration({
		moduleSpecifier: "./connection.js",
		namedImports: ["createDatabaseConnection"],
	});

	testFile.addStatements(`
describe('Database Connection Factory', () => {
    let activeDataSource: DataSource | null = null;

    afterEach(async () => {
        if (activeDataSource && activeDataSource.isInitialized) {
            await activeDataSource.destroy();
        }
    });

    it('should return null when no databaseUrl and no ephemeral flag', async () => {
        const result = await createDatabaseConnection({ });
        expect(result).toBeNull();
    });

    it('should provision an ephemeral in-memory SQLite DB when ephemeral is true', async () => {
        activeDataSource = await createDatabaseConnection({ ephemeral: true });
        expect(activeDataSource).toBeDefined();
        expect(activeDataSource?.isInitialized).toBe(true);
        expect(activeDataSource?.options.type).toBe('better-sqlite3');
        expect(activeDataSource?.options.database).toBe(':memory:');
    });

    it('should provision an ephemeral DB even if databaseUrl is provided when ephemeral is true', async () => {
        activeDataSource = await createDatabaseConnection({ databaseUrl: 'postgres://localhost/test', ephemeral: true });
        expect(activeDataSource).toBeDefined();
        expect(activeDataSource?.options.type).toBe('better-sqlite3');
    });
});
    `);

	testFile.formatText();
}
