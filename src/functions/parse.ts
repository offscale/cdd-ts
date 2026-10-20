/**
 * Public entry facade for AST scanning and OpenAPI specification reconstruction from TypeScript sources and projects.
 *
 * @module functions/parse
 */
import path from "node:path";
import type { SourceFile } from "ts-morph";
import { Project } from "ts-morph";
import {
	parseGeneratedModelSource,
	type ReverseSchemaMap,
} from "../classes/parse.js";
import { OAS_3_1_DIALECT } from "../core/constants.js";
import type {
	ExternalDocumentationObject,
	InfoObject,
	OpenApiValue,
	PathItem,
	ServerObject,
	SpecOperation,
	SwaggerDefinition,
	SwaggerSpec,
	TagObject,
} from "../core/types/index.js";
import {
	buildParameters,
	buildRequestBody,
	buildResponses,
	STANDARD_HTTP_METHODS,
	scanDecoratedControllers,
	scanExpressRoutes,
} from "./parsers/parse_server_routes.js";

/** Re-exports `AngularBestPracticeRuleId` from `./parsers/parse_angular_service.js`. */
/** Re-exports `AngularBestPracticesAuditResult` from `./parsers/parse_angular_service.js`. */
/** Re-exports `AngularBestPracticeViolation` from `./parsers/parse_angular_service.js`. */
/** Re-exports `AngularHttpCallMatch` from `./parsers/parse_angular_service.js`. */
/** Re-exports `AngularServiceMetadata` from `./parsers/parse_angular_service.js`. */
export type {
	AngularBestPracticeRuleId,
	AngularBestPracticesAuditResult,
	AngularBestPracticeViolation,
	AngularHttpCallMatch,
	AngularServiceMetadata,
} from "./parsers/parse_angular_service.js";
/** Re-exports `auditAngularSourceBestPractices` from `./parsers/parse_angular_service.js`. */
/** Re-exports `extractAngularHttpCall` from `./parsers/parse_angular_service.js`. */
/** Re-exports `extractAngularServiceMetadata` from `./parsers/parse_angular_service.js`. */
export {
	auditAngularSourceBestPractices,
	extractAngularHttpCall,
	extractAngularServiceMetadata,
} from "./parsers/parse_angular_service.js";
/** Re-exports `ExtractedOperationDocMeta` from `./parsers/parse_operation_jsdoc.js`. */
export type { ExtractedOperationDocMeta } from "./parsers/parse_operation_jsdoc.js";
/** Re-exports `extractDocMeta` from `./parsers/parse_operation_jsdoc.js`. */
export { extractDocMeta } from "./parsers/parse_operation_jsdoc.js";
/** Re-exports `PromiseHttpCallMatch` from `./parsers/parse_promise_service.js`. */
export type { PromiseHttpCallMatch } from "./parsers/parse_promise_service.js";
/** Re-exports `extractPromiseHttpCall` from `./parsers/parse_promise_service.js`. */
export { extractPromiseHttpCall } from "./parsers/parse_promise_service.js";
/** Re-exports `scanDecoratedControllers` from `./parsers/parse_server_routes.js`. */
/** Re-exports `scanExpressRoutes` from `./parsers/parse_server_routes.js`. */
export {
	scanDecoratedControllers,
	scanExpressRoutes,
} from "./parsers/parse_server_routes.js";

const DEFAULT_IGNORE_DIRS = new Set([
	"node_modules",
	"dist",
	"coverage",
	"docs",
	".git",
]);

const DEFAULT_INFO: InfoObject = {
	title: "Recovered OpenAPI",
	version: "0.0.0",
};

/** File or directory status entry returned by `CodeScanFileSystem.statSync`. */
export interface CodeScanFileStat {
	/**
	 * Returns `true` if the path is a file.
	 * @returns `true` when regular file.
	 */
	isFile(): boolean;
	/**
	 * Returns `true` if the path is a directory.
	 * @returns `true` when directory.
	 */
	isDirectory(): boolean;
}

/** File system requirements for AST scanning helpers. */
export interface CodeScanFileSystem {
	/**
	 * Returns file status information.
	 * @param filePath - Path to inspect.
	 * @returns File status entry.
	 */
	statSync(filePath: string): CodeScanFileStat;
	/**
	 * Reads the content of a file.
	 * @param filePath - Path to read.
	 * @param encodingOrOptions - Encoding string or options value.
	 * @returns File text content.
	 */
	readFileSync(filePath: string, encodingOrOptions: OpenApiValue): string;
	/**
	 * Reads the directory entries.
	 * @param dirPath - Directory path to list.
	 * @returns Array of entry names.
	 */
	readdirSync(dirPath: string): string[];
}

/** Supported locations for parameters discovered in scanned code. */
export type CodeScanParamLocation =
	| "path"
	| "query"
	| "header"
	| "cookie"
	| "querystring";

/** Describes a parameter reconstructed from an AST scan. */
export interface CodeScanParam {
	/** The name of the parameter. */
	name: string;
	/** The location of the parameter. */
	in: CodeScanParamLocation;
	/** Whether the parameter is required. */
	required?: boolean;
	/** The description of the parameter. */
	description?: string;
	/** The schema of the parameter. */
	schema?: SwaggerDefinition | boolean;
	/** The content type of the parameter. */
	contentType?: string;
	/** The encoding of the parameter. */
	encoding?: Record<string, OpenApiValue>;
	/** An example value for the parameter. */
	example?: OpenApiValue;
}

/** Describes a reconstructed request body. */
export interface CodeScanRequestBody {
	/** Whether the request body is required. */
	required?: boolean;
	/** The supported content types. */
	contentTypes: string[];
	/** The schema of the request body. */
	schema?: SwaggerDefinition | boolean;
	/** Example values for the request body. */
	examples?: Record<string, OpenApiValue>;
}

/** Describes a reconstructed response. */
export interface CodeScanResponse {
	/** The HTTP status code of the response. */
	status: string;
	/** The summary of the response. */
	summary?: string;
	/** The description of the response. */
	description?: string;
	/** The supported content types. */
	contentTypes: string[];
	/** The schema of the response. */
	schema?: SwaggerDefinition | boolean;
	/** Example values for the response. */
	examples?: Record<string, OpenApiValue>;
}

/** Describes a reconstructed API operation discovered in source code. */
export interface CodeScanOperation {
	/** The operation ID. */
	operationId: string;
	/** The HTTP method. */
	method: string;
	/** The API path. */
	path: string;
	/** The file path where the operation was found. */
	filePath: string;
	/** The parameters of the operation. */
	params: CodeScanParam[];
	/** The request body of the operation. */
	requestBody?: CodeScanRequestBody;
	/** The responses of the operation. */
	responses: CodeScanResponse[];
	/** The summary of the operation. */
	summary?: string;
	/** The description of the operation. */
	description?: string;
	/** Whether the operation is deprecated. */
	deprecated?: boolean;
	/** The tags of the operation. */
	tags?: string[];
	/** The tag objects of the operation. */
	tagObjects?: TagObject[];
	/** External documentation for the operation. */
	externalDocs?: ExternalDocumentationObject;
	/** Servers specific to the operation. */
	servers?: ServerObject[];
	/** Security requirements for the operation. */
	security?: Record<string, string[]>[];
	/** Extension properties. */
	extensions?: Record<string, OpenApiValue>;
}

/** Intermediate representation produced by the AST scanner. */
export interface CodeScanIr {
	/** The discovered API operations. */
	operations: CodeScanOperation[];
	/** The discovered OpenAPI schemas. */
	schemas: Record<string, SwaggerDefinition | boolean>;
	/** The paths to the scanned source files. */
	sources: string[];
}

/** Options for controlling the AST-based scan. */
export interface CodeScanOptions {
	/** Extra directory names to ignore when scanning a directory. */
	ignoreDirs?: string[];
	/** Toggle extracting exported TypeScript types into OpenAPI schemas. */
	includeSchemas?: boolean;
}

/**
 * Scans a TypeScript source string and produces an intermediate representation of API operations.
 * @param sourceText The TypeScript source text to scan.
 * @param filePath Virtual path used for diagnostics and operation metadata.
 * @param options Scanner options.
 * @returns The scanned `CodeScanIr` intermediate representation.
 * @throws {Error} When no route handlers are found in `sourceText`.
 */
export function scanTypeScriptSource(
	sourceText: string,
	filePath = "source.ts",
	options: CodeScanOptions = {},
): CodeScanIr {
	const project = createScanProject();

	const sourceFile = project.createSourceFile(filePath, sourceText, {
		overwrite: true,
	});

	const operations = scanSourceFile(sourceFile);

	if (operations.length === 0) {
		throw new Error(`No route handlers found in: ${filePath}`);
	}

	const schemas =
		options.includeSchemas === false
			? {}
			: extractSchemasFromSource(sourceText, filePath);

	return {
		operations,
		schemas,
		sources: [filePath],
	};
}

/**
 * Scans a file or directory of TypeScript sources and produces an intermediate representation.
 * @param inputPath A file path or directory containing TypeScript sources.
 * @param fileSystem File system implementation for reading files.
 * @param options Scanner options.
 * @returns The scanned `CodeScanIr` intermediate representation.
 * @throws {Error} When `inputPath` is invalid or no TypeScript route handlers are found.
 */
export function scanTypeScriptProject(
	inputPath: string,
	fileSystem: CodeScanFileSystem,
	options: CodeScanOptions = {},
): CodeScanIr {
	const resolved = path.resolve(inputPath);

	const stat = fileSystem.statSync(resolved);

	const filePaths: string[] = [];

	if (stat.isFile()) {
		if (!isSourceFilePath(resolved)) {
			throw new Error(
				`Expected a TypeScript source file (*.ts). Received: ${resolved}`,
			);
		}

		filePaths.push(resolved);
	} else {
		const ignoreDirs = new Set([
			...DEFAULT_IGNORE_DIRS,
			...(options.ignoreDirs ?? []),
		]);

		collectSourceFiles(resolved, fileSystem, filePaths, ignoreDirs);
	}

	if (filePaths.length === 0) {
		throw new Error(`No TypeScript source files found under: ${resolved}`);
	}

	const project = createScanProject();

	const operations: CodeScanOperation[] = [];

	const schemas: ReverseSchemaMap = {};

	const sources: string[] = [];

	for (const filePath of filePaths) {
		const contents = fileSystem.readFileSync(filePath, "utf-8");

		sources.push(filePath);

		const sourceFile = project.createSourceFile(filePath, contents, {
			overwrite: true,
		});

		operations.push(...scanSourceFile(sourceFile));

		if (options.includeSchemas !== false) {
			const extracted = extractSchemasFromSource(contents, filePath);

			if (Object.keys(extracted).length > 0) {
				Object.assign(schemas, extracted);
			}
		}
	}

	if (operations.length === 0) {
		throw new Error(`No route handlers found under: ${resolved}`);
	}

	return {
		operations,
		schemas: options.includeSchemas === false ? {} : schemas,
		sources,
	};
}

/**
 * Builds an OpenAPI 3.2 specification from a scanned intermediate representation.
 * @param ir The intermediate representation from the AST scanner.
 * @param infoOverrides Optional OpenAPI info overrides.
 * @returns Reconstructed `SwaggerSpec` object.
 */
export function buildOpenApiSpecFromScan(
	ir: CodeScanIr,
	infoOverrides: Partial<InfoObject> = {},
): SwaggerSpec {
	const info: InfoObject = { ...DEFAULT_INFO, ...infoOverrides };

	const paths: Record<string, PathItem> = {};

	const standardMethods = STANDARD_HTTP_METHODS;

	const tagNames: string[] = [];

	const tagSet = new Set<string>();

	const tagObjects = new Map<string, TagObject>();

	const trackTagName = (name: string) => {
		if (tagSet.has(name)) return;

		tagSet.add(name);

		tagNames.push(name);
	};

	const mergeTagObject = (tag: TagObject) => {
		const name = tag.name.trim();
		const normalized = { ...tag, name };
		const existing = tagObjects.get(name);
		tagObjects.set(
			name,
			existing ? { ...normalized, ...existing } : normalized,
		);
	};

	for (const op of ir.operations) {
		const parameters = buildParameters(op.params);

		const requestBody = buildRequestBody(op.requestBody);

		const responses = buildResponses(op.responses);

		const methodKey = op.method.toLowerCase();

		const pathItem: PathItem = paths[op.path] ?? {};

		const operation = {
			operationId: op.operationId,
			...(op.summary ? { summary: op.summary } : {}),
			...(op.description ? { description: op.description } : {}),
			...(op.deprecated ? { deprecated: op.deprecated } : {}),
			...(op.tags && op.tags.length > 0 ? { tags: op.tags } : {}),
			...(op.externalDocs ? { externalDocs: op.externalDocs } : {}),
			...(op.servers && op.servers.length > 0 ? { servers: op.servers } : {}),
			...(op.security && op.security.length > 0
				? { security: op.security }
				: {}),
			...(op.extensions ? op.extensions : {}),
			...(parameters.length > 0 ? { parameters } : {}),
			...(requestBody ? { requestBody } : {}),
			responses,
		};

		if (standardMethods.has(methodKey)) {
			pathItem[methodKey] = operation;
		} else {
			const additional =
				(pathItem.additionalOperations as Record<string, OpenApiValue>) ?? {};

			additional[op.method] = operation;

			pathItem.additionalOperations = additional as Record<
				string,
				SpecOperation
			>;
		}

		paths[op.path] = pathItem;

		if (op.tagObjects && op.tagObjects.length > 0) {
			op.tagObjects.forEach((tag) => {
				trackTagName(tag.name);

				mergeTagObject(tag);
			});
		}

		if (op.tags && op.tags.length > 0) {
			op.tags.forEach(trackTagName);
		}
	}

	const spec: SwaggerSpec = {
		openapi: "3.2.0",
		info,
		paths,
		jsonSchemaDialect: OAS_3_1_DIALECT,
	};

	if (tagNames.length > 0) {
		spec.tags = tagNames.map((name) => tagObjects.get(name) ?? { name });
	}

	if (Object.keys(ir.schemas).length > 0) {
		spec.components = { ...spec.components, schemas: ir.schemas };
	}

	return spec;
}

function createScanProject(): Project {
	return new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
		compilerOptions: {
			experimentalDecorators: true,
		},
	});
}

function isSourceFilePath(filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, "/");

	return (
		normalized.endsWith(".ts") &&
		!normalized.endsWith(".d.ts") &&
		!normalized.endsWith(".spec.ts") &&
		!normalized.endsWith(".test.ts")
	);
}

function collectSourceFiles(
	dirPath: string,
	fileSystem: CodeScanFileSystem,
	output: string[],
	ignoreDirs: Set<string>,
): void {
	const entries = fileSystem.readdirSync(dirPath);

	for (const entry of entries) {
		const fullPath = path.join(dirPath, entry);

		const stat = fileSystem.statSync(fullPath);

		if (stat.isDirectory()) {
			if (ignoreDirs.has(entry)) {
				continue;
			}

			collectSourceFiles(fullPath, fileSystem, output, ignoreDirs);

			continue;
		}

		if (stat.isFile() && isSourceFilePath(fullPath)) {
			output.push(fullPath);
		}
	}
}

function extractSchemasFromSource(
	sourceText: string,
	filePath: string,
): ReverseSchemaMap {
	const schemas = parseGeneratedModelSource(sourceText, filePath);

	return Object.keys(schemas).length > 0 ? schemas : {};
}

function scanSourceFile(sourceFile: SourceFile): CodeScanOperation[] {
	const operations: CodeScanOperation[] = [];

	operations.push(...scanExpressRoutes(sourceFile));

	operations.push(...scanDecoratedControllers(sourceFile));

	return operations;
}
