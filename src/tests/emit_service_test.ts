/**
 * Shared base class for emitting Promise-based service unit tests (Fetch, Axios, Node).
 *
 * @module tests/emit_service_test
 */
import * as path from "node:path";
import type {
	ImportDeclarationStructure,
	OptionalKind,
	Project,
} from "ts-morph";
import type {
	GeneratorConfig,
	PathInfo,
	SwaggerDefinition,
} from "../core/types/index.js";
import { camelCase, pascalCase } from "../functions/utils.js";
import { MockDataGenerator } from "../mocks/generate_mock_data.js";
import type { SwaggerParser } from "../openapi/parse.js";

/**
 * Base class for Promise-based HTTP client service test generators (Fetch, Axios, Node).
 */
export abstract class PromiseServiceTestGenerator {
	/** Shared mock payload generator instance. */
	protected readonly mockDataGenerator: MockDataGenerator;

	/**
	 * Creates a new `PromiseServiceTestGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The target `ts-morph` project.
	 * @param config - The generator configuration options.
	 */
	constructor(
		protected readonly parser: SwaggerParser,
		protected readonly project: Project,
		protected readonly config: GeneratorConfig,
	) {
		this.mockDataGenerator = new MockDataGenerator(parser);
	}

	/**
	 * Returns additional transport-specific imports (e.g. `axios` or `http`/`https`) for the generated test file.
	 *
	 * @returns Array of `ts-morph` import declaration structures.
	 */
	protected getAdditionalImports(): OptionalKind<ImportDeclarationStructure>[] {
		return [];
	}

	/**
	 * Resolves whether the target framework is Vanilla JS (`.client.ts`) or standard service (`.service.ts`).
	 *
	 * @returns `true` if Vanilla JS client naming should be used.
	 */
	protected isVanillaClient(): boolean {
		const fw = (this.config.options.framework || "").toLowerCase();
		return fw === "vanilla js" || fw === "vanilla" || fw === "vanillajs";
	}

	/**
	 * Quotes a raw string literal if it is not already quoted or JSON-formatted.
	 *
	 * @param val - The raw string value produced by `MockDataGenerator`.
	 * @returns A valid TypeScript literal string expression.
	 */
	protected formatMockLiteral(val: string): string {
		if (
			!val.startsWith("'") &&
			!val.startsWith('"') &&
			!val.startsWith("{") &&
			!val.startsWith("[") &&
			val !== "true" &&
			val !== "false" &&
			val !== "null" &&
			Number.isNaN(Number(val))
		) {
			return `'${val}'`;
		}
		return val;
	}

	/**
	 * Builds the list of mock argument expressions for an operation's required parameters and request body.
	 *
	 * @param op - The operation `PathInfo`.
	 * @returns Array of formatted argument expression strings.
	 */
	protected buildOperationMockArgs(op: PathInfo): string[] {
		const params: string[] = [];

		if (op.parameters && op.parameters.length > 0) {
			const requiredParams = op.parameters.filter(
				(p) => !("in" in p) || p.required,
			);
			for (const p of requiredParams) {
				const rawVal = this.mockDataGenerator.generate(
					((p.schema as SwaggerDefinition)?.name as string) || p.name,
				);
				params.push(this.formatMockLiteral(String(rawVal)));
			}
		}

		if (op.requestBody) {
			if (op.requestBody.content) {
				const contentTypes = Object.keys(op.requestBody.content);
				if (contentTypes.length > 0) {
					const firstMedia = op.requestBody.content[contentTypes[0]!];
					const schema = firstMedia?.schema;
					const rawVal = this.mockDataGenerator.generate(
						((schema as SwaggerDefinition)?.name as string) || "Unknown",
					);
					params.push(this.formatMockLiteral(String(rawVal)));
				} else {
					params.push("{}");
				}
			} else {
				params.push("{}");
			}
		}

		return params;
	}

	/**
	 * Generates transport-specific mock setup lines inside each `it(...)` block before calling the service method.
	 *
	 * @param op - The operation being tested.
	 * @param serviceName - The generated service class name.
	 * @returns Array of TypeScript statement lines.
	 */
	protected abstract getTransportMockSetupLines(
		op: PathInfo,
		serviceName: string,
	): string[];

	/**
	 * Generates transport-specific assertion lines inside each `it(...)` block after calling the service method.
	 *
	 * @param op - The operation being tested.
	 * @returns Array of TypeScript statement lines.
	 */
	protected abstract getTransportMockAssertionLines(op: PathInfo): string[];

	/**
	 * Generates a unit test file (`*.service.spec.ts` or `*.client.spec.ts`) for the given controller.
	 *
	 * @param controllerName - The canonical controller name.
	 * @param operations - The list of operations belonging to the controller.
	 * @param servicesDir - The directory where service files are located.
	 */
	public generateServiceTestFile(
		controllerName: string,
		operations: PathInfo[],
		servicesDir: string,
	): void {
		const isVanilla = this.isVanillaClient();

		const serviceName = isVanilla
			? `${pascalCase(controllerName)}Client`
			: `${pascalCase(controllerName)}Service`;
		const fileName = isVanilla
			? `${camelCase(controllerName)}.client.spec.ts`
			: `${camelCase(controllerName)}.service.spec.ts`;
		const importPath = isVanilla
			? `./${camelCase(controllerName)}.client.js`
			: `./${camelCase(controllerName)}.service.js`;
		const filePath = path.join(servicesDir, fileName);

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});
		const isComposable =
			this.config.options?.composableTests === true ||
			this.config.options?.tests === true;

		sourceFile.addImportDeclarations([
			{
				moduleSpecifier: "vitest",
				namedImports: [
					"describe",
					"it",
					"expect",
					"vi",
					"beforeEach",
					"afterEach",
				],
			},
			...this.getAdditionalImports(),
			{
				moduleSpecifier: importPath,
				namedImports: [serviceName],
			},
		]);

		const testLines: string[] = [];

		if (isComposable) {
			testLines.push(
				`export const test${serviceName} = () => describe('${serviceName}', () => {`,
			);
		} else {
			testLines.push(`describe('${serviceName}', () => {`);
		}

		testLines.push(`    let service: ${serviceName};`);
		testLines.push(``);
		testLines.push(`    beforeEach(() => {`);
		testLines.push(
			`        service = new ${serviceName}('http://localhost:8080/v2');`,
		);
		testLines.push(`    });`);
		testLines.push(``);
		testLines.push(`    afterEach(() => {`);
		testLines.push(`        vi.restoreAllMocks();`);
		testLines.push(`    });`);
		testLines.push(``);

		for (const op of operations) {
			const methodName =
				op.methodName ||
				camelCase(
					op.operationId ||
						`${op.method}_${op.path.replace(/[^a-zA-Z0-9]/g, "_")}`,
				);
			testLines.push(`    describe('${methodName}', () => {`);
			testLines.push(
				`        it('should make a ${op.method.toUpperCase()} request to ${op.path}', async () => {`,
			);

			for (const setupLine of this.getTransportMockSetupLines(
				op,
				serviceName,
			)) {
				testLines.push(`            ${setupLine}`);
			}

			const paramString = this.buildOperationMockArgs(op).join(", ");

			testLines.push(
				`            const result = await service.${methodName}(${paramString});`,
			);
			for (const assertLine of this.getTransportMockAssertionLines(op)) {
				testLines.push(`            ${assertLine}`);
			}
			testLines.push(`        });`);
			testLines.push(`    });`);
			testLines.push(``);
		}

		testLines.push(`});`);

		if (isComposable) {
			testLines.push("");
			testLines.push(`test${serviceName}();`);
		}

		sourceFile.addStatements(testLines.join(String.fromCharCode(10)));
		sourceFile.formatText();
	}
}
