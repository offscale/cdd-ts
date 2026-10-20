/**
 * Emits installable package (`package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`) and GitHub Actions (`ci.yml`) scaffolding for generated SDKs, CLIs, and servers.
 *
 * @module cli/scaffold
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { GeneratorConfig } from "../core/types/index.js";

const NEWLINE = String.fromCharCode(10);

/**
 * Emits `package.json`, `tsconfig.json`, and server `vitest.config.ts` / `README.md` scaffolding into `targetOutputRoot`.
 *
 * @param targetOutputRoot - Root directory for package files.
 * @param finalConfig - Resolved generator configuration.
 * @param targetScope - Generation target scope (`"to_sdk"`, `"to_sdk_cli"`, or `"to_server"`).
 */
export function emitPackageScaffolding(
	targetOutputRoot: string,
	finalConfig: Partial<GeneratorConfig>,
	targetScope?: "to_sdk" | "to_sdk_cli" | "to_server",
): void {
	const dependencies: Record<string, string> = {};
	const devDependencies: Record<string, string> = {};

	if (targetScope === "to_sdk_cli" || targetScope === "to_server") {
		Object.assign(dependencies, {
			"@modelcontextprotocol/sdk": "^1.29.0",
			zod: "^4.4.3",
			commander: "^14.0.0",
		});
	}
	if (targetScope === "to_server") {
		Object.assign(dependencies, {
			express: "^4.21.2",
			"@types/express": "^5.0.0",
		});
		Object.assign(devDependencies, {
			supertest: "^7.2.2",
			"@types/supertest": "^7.2.0",
			vitest: "^4.1.0",
			typescript: "^5.0.0",
			"ts-node": "^10.9.2",
		});
		if (finalConfig.options?.orm === "typeorm") {
			Object.assign(dependencies, {
				typeorm: "^1.0.0",
				"better-sqlite3": "^12.0.0",
				pg: "^8.22.0",
			});
			Object.assign(devDependencies, {
				"@faker-js/faker": "^10.5.0",
				"@types/better-sqlite3": "^7.6.10",
			});
		}
	}

	const scripts: Record<string, string> = { build: "tsc" };
	if (targetScope === "to_server" || finalConfig.options?.tests !== false) {
		scripts.test = "vitest run";
	}

	fs.writeFileSync(
		path.join(targetOutputRoot, "package.json"),
		JSON.stringify(
			{
				name:
					targetScope === "to_server" ? "generated-server" : "generated-client",
				version: "1.0.0",
				main: "dist/index.js",
				types: "dist/index.d.ts",
				scripts,
				dependencies,
				devDependencies:
					Object.keys(devDependencies).length > 0 ? devDependencies : undefined,
			},
			null,
			2,
		),
	);
	const tsconfig: {
		compilerOptions: Record<string, string | boolean>;
		include: string[];
	} = {
		compilerOptions: {
			target: "ES2022",
			module: "CommonJS",
			moduleResolution: "node",
			outDir: "dist",
			rootDir: "src",
			declaration: true,
			esModuleInterop: true,
			skipLibCheck: true,
		},
		include: ["src/**/*"],
	};
	if (targetScope === "to_server" && finalConfig.options?.orm === "typeorm") {
		tsconfig.compilerOptions.experimentalDecorators = true;
		tsconfig.compilerOptions.emitDecoratorMetadata = true;
	}
	fs.writeFileSync(
		path.join(targetOutputRoot, "tsconfig.json"),
		JSON.stringify(tsconfig, null, 2),
	);
	if (targetScope === "to_server") {
		fs.writeFileSync(
			path.join(targetOutputRoot, "vitest.config.ts"),
			[
				"import { defineConfig } from 'vitest/config';",
				"export default defineConfig({ test: { pool: 'forks', include: ['src/**/*.spec.ts', 'src/**/*.test.ts'] } });",
				"",
			].join(NEWLINE),
		);
		const readmeContent = [
			"# Generated Mock Server",
			"",
			"This is an automatically generated Contract-Driven Development (CDD) Mock Server.",
			"It supports multiple decoupled runtime modes to facilitate testing, sandbox development, and production scaffolding.",
			"",
			"## Server Modes",
			"",
			"You can run the server in the following operational modes:",
			"",
			"### 1. Stub Mode",
			"```bash",
			"npm run start",
			"```",
			"*(No `DATABASE_URL` configured and no `--ephemeral` flag)*",
			"The server runs using traditional scaffolds. Endpoints return empty bodies or explicitly throw `NotImplementedError`.",
			"",
			"### 2. Production Mode",
			"```bash",
			"DATABASE_URL=postgres://user:pass@localhost:5432/mydb npm run start",
			"```",
			"*(Provided `DATABASE_URL`, no `--ephemeral` flag)*",
			"The server uses actual ORM interactions against a real database connection. Data is persistent.",
			"",
			"### 3. Sandbox Mode",
			"```bash",
			"npm run start -- --ephemeral",
			"```",
			"The server ignores any external database configuration and provisions a fresh, throwaway in-memory database (e.g., SQLite `sqlite::memory:`). All ORM operations succeed, but data is ephemeral and isolated to the session.",
			"",
			"### 4. Full Mock Mode",
			"```bash",
			"npm run start -- --ephemeral --seed",
			"```",
			"The server provisions an ephemeral database and automatically populates it with a localized, topologically-sorted fake data graph. This exposes a rich, queryable dataset immediately upon startup without manual creation steps.",
			"",
		].join(NEWLINE);
		fs.writeFileSync(path.join(targetOutputRoot, "README.md"), readmeContent);
	}
}

/**
 * Emits `.github/workflows/ci.yml` for a generated package.
 *
 * @param targetOutputRoot - Root directory for the generated package.
 */
export function emitGithubActionsScaffolding(targetOutputRoot: string): void {
	const ghDir = path.join(targetOutputRoot, ".github", "workflows");
	fs.mkdirSync(ghDir, { recursive: true });
	fs.writeFileSync(
		path.join(ghDir, "ci.yml"),
		[
			"name: CI",
			"on: [push]",
			"jobs:",
			"  build:",
			"    runs-on: ubuntu-latest",
			"    steps:",
			"      - uses: actions/checkout@v6",
			"      - run: npm install",
			"      - run: npm run build",
			"      - run: npm test",
			"",
		].join(NEWLINE),
	);
}
