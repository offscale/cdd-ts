/**
 * Reconstructs OpenAPI/JSON Schema definitions from generated TypeScript model interfaces, enums, and type aliases.
 *
 * @module classes/parse
 */
import path from "node:path";
import { Project, type SourceFile } from "ts-morph";
import type { SwaggerDefinition } from "../core/types/index.js";
import { schemaFromEnum, schemaFromTypeAlias } from "./parse_enums_unions.js";
import { schemaFromInterface, schemaFromTypeNode } from "./parse_interfaces.js";
import { inferDiscriminators } from "./postprocess_schemas.js";

/** Re-exports `schemaFromTypeNode` from `./parse_interfaces.js`. */
export { schemaFromTypeNode };

/** Map of schema names to reconstructed schema definitions. */
export type ReverseSchemaMap = Record<string, SwaggerDefinition | boolean>;

/** File or directory status entry returned by `ReverseModelFileSystem.statSync`. */
export interface ReverseModelFileStat {
	/**
	 * Returns `true` when the path refers to a regular file.
	 * @returns `true` if file.
	 */
	isFile(): boolean;
	/**
	 * Returns `true` when the path refers to a directory.
	 * @returns `true` if directory.
	 */
	isDirectory(): boolean;
}

/** File system requirements for reverse model parsing helpers. */
export interface ReverseModelFileSystem {
	/**
	 * Synchronous `fs.statSync` equivalent.
	 * @param filePath - Path to inspect.
	 * @returns File status metadata.
	 */
	statSync(filePath: string): ReverseModelFileStat;
	/**
	 * Synchronous `fs.readFileSync` equivalent.
	 * @param filePath - Path to read.
	 * @param encoding - Text encoding (e.g. `"utf8"`).
	 * @returns File contents string.
	 */
	readFileSync(filePath: string, encoding: BufferEncoding): string;
	/**
	 * Synchronous `fs.readdirSync` equivalent.
	 * @param dirPath - Directory path to list.
	 * @returns Array of entry names in the directory.
	 */
	readdirSync(dirPath: string): readonly (string | Buffer)[];
}

const MODEL_FILE_SUFFIX = ".ts";
const MODEL_SPEC_SUFFIX = ".spec.ts";
const MODEL_DECL_SUFFIX = ".d.ts";

/**
 * Parses a generated model source file and returns reconstructed schema definitions.
 *
 * @param sourceText - TypeScript source text of the model file.
 * @param filePath - Virtual file path for AST creation.
 * @returns Map of model names to reconstructed `SwaggerDefinition` or boolean schemas.
 */
export function parseGeneratedModelSource(
	sourceText: string,
	filePath = "models/index.ts",
): ReverseSchemaMap {
	const project = new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
	});

	const sourceFile = project.createSourceFile(filePath, sourceText, {
		overwrite: true,
	});

	const schemas = parseModelSourceFile(sourceFile);
	inferDiscriminators(schemas);
	return schemas;
}

/**
 * Parses generated model files from a file path or directory, returning reconstructed schemas.
 *
 * @param inputPath - Path to a single `.ts` model file or directory of model files.
 * @param fileSystem - File system adapter providing `statSync`, `readFileSync`, and `readdirSync`.
 * @returns Map of model names to reconstructed `SwaggerDefinition` or boolean schemas.
 * @throws {Error} When the input path is invalid or contains no exported model declarations.
 */
export function parseGeneratedModels(
	inputPath: string,
	fileSystem: ReverseModelFileSystem,
): ReverseSchemaMap {
	const stat = fileSystem.statSync(inputPath);
	const modelFiles: string[] = [];

	if (stat.isFile()) {
		if (!isModelFilePath(inputPath)) {
			throw new Error(
				`Expected a generated model file (*.ts). Received: ${inputPath}`,
			);
		}
		modelFiles.push(inputPath);
	} else if (stat.isDirectory()) {
		collectModelFiles(inputPath, fileSystem, modelFiles);
	} else {
		throw new Error(
			`Input path is neither a file nor a directory: ${inputPath}`,
		);
	}

	if (modelFiles.length === 0) {
		throw new Error(`No generated model files found under: ${inputPath}`);
	}

	const project = new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
	});

	const schemas: ReverseSchemaMap = {};

	for (const filePath of modelFiles) {
		const contents = fileSystem.readFileSync(filePath, "utf-8");
		const sourceFile = project.createSourceFile(filePath, contents, {
			overwrite: true,
		});
		Object.assign(schemas, parseModelSourceFile(sourceFile));
	}

	if (Object.keys(schemas).length === 0) {
		throw new Error(
			`No exported models could be reconstructed from: ${inputPath}`,
		);
	}

	inferDiscriminators(schemas);
	return schemas;
}

function parseModelSourceFile(sourceFile: SourceFile): ReverseSchemaMap {
	const schemas: ReverseSchemaMap = {};

	sourceFile.getEnums().forEach((enumDecl) => {
		if (!enumDecl.isExported()) return;
		schemas[enumDecl.getName()] = schemaFromEnum(enumDecl);
	});

	sourceFile.getTypeAliases().forEach((aliasDecl) => {
		if (!aliasDecl.isExported()) return;
		schemas[aliasDecl.getName()] = schemaFromTypeAlias(aliasDecl);
	});

	sourceFile.getInterfaces().forEach((interfaceDecl) => {
		if (!interfaceDecl.isExported()) return;
		schemas[interfaceDecl.getName()] = schemaFromInterface(interfaceDecl);
	});

	return schemas;
}

function isModelFilePath(filePath: string): boolean {
	const normalized = filePath.split(String.fromCharCode(92)).join("/");
	return (
		normalized.endsWith(MODEL_FILE_SUFFIX) &&
		!normalized.endsWith(MODEL_SPEC_SUFFIX) &&
		!normalized.endsWith(MODEL_DECL_SUFFIX)
	);
}

function collectModelFiles(
	dirPath: string,
	fileSystem: ReverseModelFileSystem,
	output: string[],
): void {
	const entries = fileSystem.readdirSync(dirPath);

	for (const rawEntry of entries) {
		const entry = String(rawEntry);
		const fullPath = path.join(dirPath, entry);
		const stat = fileSystem.statSync(fullPath);

		if (stat.isDirectory()) {
			if (entry === "models") {
				collectAllModelFiles(fullPath, fileSystem, output);
			} else {
				collectModelFiles(fullPath, fileSystem, output);
			}
			continue;
		}

		if (
			stat.isFile() &&
			isModelFilePath(fullPath) &&
			fullPath.includes(`${path.sep}models${path.sep}`)
		) {
			output.push(fullPath);
		}
	}
}

function collectAllModelFiles(
	dirPath: string,
	fileSystem: ReverseModelFileSystem,
	output: string[],
): void {
	const entries = fileSystem.readdirSync(dirPath);

	for (const rawEntry of entries) {
		const entry = String(rawEntry);
		const fullPath = path.join(dirPath, entry);
		const stat = fileSystem.statSync(fullPath);

		if (stat.isDirectory()) {
			collectAllModelFiles(fullPath, fileSystem, output);
			continue;
		}

		if (stat.isFile() && isModelFilePath(fullPath)) {
			output.push(fullPath);
		}
	}
}
