/**
 * Reverse-parses generated SDK service classes and assembles OpenAPI paths, operations, parameters, and responses.
 *
 * @module openapi/emitters/assemble_paths
 */
import path from "node:path";
import type { ReverseSchemaMap } from "../../classes/parse.js";
import { OAS_3_1_DIALECT } from "../../core/constants.js";
import type {
	ExternalDocumentationObject,
	InfoObject,
	OpenApiValue,
	PathItem,
	ServerObject,
	SpecOperation,
	SwaggerSpec,
} from "../../core/types/index.js";
import {
	extractAngularHttpCall,
	extractAngularServiceMetadata,
} from "../../functions/parsers/parse_angular_service.js";
import { extractPromiseHttpCall } from "../../functions/parsers/parse_promise_service.js";
import {
	assembleOperationParametersAndRequestBody,
	extractOperationParamsAndBody,
} from "./assemble_operation_params.js";
import {
	assembleOperationResponses,
	buildReverseOperationFromMethod,
} from "./assemble_operation_responses.js";

/** Reverse param location */
export type ReverseParamLocation =
	| "path"
	| "query"
	| "header"
	| "cookie"
	| "formData"
	| "querystring"
	| "body";

/** Reverse Param */
export interface ReverseParam {
	/** doc */
	name: string;
	/** doc */
	in: ReverseParamLocation;
	/** doc */
	required?: boolean;
	/** doc */
	description?: string;
	/** doc */
	example?: OpenApiValue;
	/** doc */
	contentType?: string;
	/** doc */
	serialization?: "json";
	/** doc */
	encoding?: Record<string, OpenApiValue>;
	/** doc */
	contentEncoderConfig?: Record<string, OpenApiValue>;
	/** doc */
	contentEncoding?: string;
	/** doc */
	style?: string;
	/** doc */
	explode?: boolean;
	/** doc */
	allowReserved?: boolean;
	/** doc */
	allowEmptyValue?: boolean;
	/** doc */
	contentMediaType?: string;
	/** doc */
	typeHint?: string;
}

/** Reverse Operation */
export interface ReverseOperation {
	/** doc */
	methodName: string;
	/** doc */
	operationId?: string;
	/** doc */
	httpMethod: string;
	/** doc */
	path: string;
	/** doc */
	params: ReverseParam[];
	/** doc */
	requestMediaTypes: string[];
	/** doc */
	responseMediaTypes: string[];
	/** doc */
	requestEncoding?: ReverseRequestEncoding;
	/** doc */
	responseTypeHint?: string;
	/** doc */
	responseIsArray?: boolean;
	/** doc */
	responseHints?: ReverseResponseHint[];
	/** doc */
	paramExamples?: Record<string, OpenApiValue>;
	/** doc */
	requestExamples?: Record<string, OpenApiValue>;
	/** doc */
	responseExamples?: Record<string, Record<string, OpenApiValue>>;
	/** doc */
	security?: Record<string, string[]>[];
	/** doc */
	extensions?: Record<string, OpenApiValue>;
	/** doc */
	tags?: string[];
	/** doc */
	servers?: ServerObject[];
	/** doc */
	summary?: string;
	/** doc */
	description?: string;
	/** doc */
	deprecated?: boolean;
	/** doc */
	externalDocs?: ExternalDocumentationObject;
}

/** Reverse Service */
export interface ReverseService {
	/** doc */
	serviceName: string;
	/** doc */
	filePath: string;
	/** doc */
	operations: ReverseOperation[];
}

/** Reverse Request Encoding */
export interface ReverseRequestEncoding {
	/** doc */
	urlencoded?: Record<string, OpenApiValue>;
	/** doc */
	multipart?: ReverseMultipartConfig;
}

/** Reverse Multipart Config */
export interface ReverseMultipartConfig {
	/** doc */
	mediaType?: string;
	/** doc */
	encoding?: Record<string, OpenApiValue>;
	/** doc */
	prefixEncoding?: OpenApiValue[];
	/** doc */
	itemEncoding?: Record<string, OpenApiValue>;
}

/** Reverse Response Hint */
export interface ReverseResponseHint {
	/** doc */
	status: string;
	/** doc */
	mediaTypes?: string[];
	/** doc */
	summary?: string;
	/** doc */
	description?: string;
}

/** File status entry returned by `ReverseServiceFileSystem.statSync`. */
export interface ReverseServiceFileStat {
	/**
	 * Returns `true` if the path is a regular file.
	 * @returns `true` if file.
	 */
	isFile(): boolean;
	/**
	 * Returns `true` if the path is a directory.
	 * @returns `true` if directory.
	 */
	isDirectory(): boolean;
}

/** File system adapter for `parseGeneratedServices`. */
export interface ReverseServiceFileSystem {
	/**
	 * Synchronously inspects file or directory status.
	 * @param filePath - Path to inspect.
	 * @returns File status metadata.
	 */
	statSync(filePath: string): ReverseServiceFileStat;
	/**
	 * Synchronously reads a UTF-8 file.
	 * @param filePath - Path to read.
	 * @param encoding - Text encoding string.
	 * @returns File contents string.
	 */
	readFileSync(filePath: string, encoding: BufferEncoding): string;
	/**
	 * Synchronously lists directory entries.
	 * @param dirPath - Directory path to list.
	 * @returns Entry names in directory.
	 */
	readdirSync(dirPath: string): readonly (string | Buffer)[];
}

/**
 * Parses a generated TypeScript service source file into `ReverseService` definitions.
 *
 * @param sourceText - TypeScript source text of the `.service.ts` file.
 * @param filePath - File path of the service file.
 * @returns Array of parsed `ReverseService` definitions.
 */
export function parseGeneratedServiceSource(
	sourceText: string,
	filePath: string,
): ReverseService[] {
	const services: ReverseService[] = [];
	const nl = String.fromCharCode(10);
	const classRegex = new RegExp(
		`export class (\\w+) \\{([\\s\\S]*?)(?=${nl}export class |$)`,
		"g",
	);
	let classMatch: RegExpExecArray | null = classRegex.exec(sourceText);

	while (classMatch !== null) {
		const serviceName = classMatch[1] as string;
		const classBody = classMatch[2] as string;
		const angularMeta = extractAngularServiceMetadata(classBody);
		const httpProp = angularMeta.httpClientProperty;

		const operations: ReverseOperation[] = [];
		const methodRegex = new RegExp(
			`(?:/\\*\\*((?:(?!\\*/)[\\s\\S])*?)\\*/\\s*)?(?:(?:public|private|protected|async)\\s+)*(\\w+)\\s*\\(([^)]*)\\)(?:\\s*:\\s*((?:Observable|Promise)<[^${nl}]*>|[^${nl}{]+))?\\s*\\{([\\s\\S]*?)${nl}\\s*\\}(?!\\s*[;,)])`,
			"g",
		);
		let methodMatch: RegExpExecArray | null = methodRegex.exec(classBody);

		while (methodMatch !== null) {
			const docBlock = methodMatch[1] || "";
			const methodName = methodMatch[2] as string;
			const argsStrRaw = methodMatch[3] as string;
			const returnTypeFull = methodMatch[4] ? methodMatch[4].trim() : undefined;
			const methodBody = methodMatch[5] as string;
			methodMatch = methodRegex.exec(classBody);

			if (methodName === "helper") continue;

			const callMatch =
				extractAngularHttpCall(methodBody, returnTypeFull, httpProp) ??
				extractPromiseHttpCall(methodBody, returnTypeFull);

			if (!callMatch) {
				continue;
			}

			const { urlPath, params } = extractOperationParamsAndBody(
				methodBody,
				argsStrRaw,
				httpProp,
			);

			const opBlock = buildReverseOperationFromMethod(
				methodName,
				callMatch.httpMethod,
				urlPath,
				params,
				docBlock,
				methodBody,
				callMatch.returnTypeHint,
				httpProp,
			);

			operations.push(opBlock);
		}

		if (operations.length > 0) {
			services.push({ serviceName, filePath, operations });
		}
		classMatch = classRegex.exec(sourceText);
	}

	return services;
}

/**
 * Parses all generated `.service.ts` and `.client.ts` files from a file path or directory.
 *
 * @param inputPath - Path to a `.service.ts` / `.client.ts` file or directory containing service/client files.
 * @param fileSystem - File system adapter.
 * @returns Array of reconstructed `ReverseService` objects.
 * @throws {Error} When no service files or operations are found.
 */
export function parseGeneratedServices(
	inputPath: string,
	fileSystem: ReverseServiceFileSystem,
): ReverseService[] {
	const stat = fileSystem.statSync(inputPath);
	const files: string[] = [];
	const isServiceOrClientFile = (name: string): boolean =>
		(name.endsWith(".service.ts") || name.endsWith(".client.ts")) &&
		!name.endsWith(".spec.ts") &&
		!name.endsWith(".d.ts");

	if (stat.isFile()) {
		if (!isServiceOrClientFile(inputPath))
			throw new Error("Expected a generated service file.");
		files.push(inputPath);
	} else {
		const traverse = (dir: string) => {
			fileSystem.readdirSync(dir).forEach((entry) => {
				const f = String(entry);
				const p = path.join(dir, f);
				if (fileSystem.statSync(p).isDirectory()) traverse(p);
				else if (isServiceOrClientFile(f)) files.push(p);
			});
		};
		traverse(inputPath);
	}

	if (files.length === 0) throw new Error("No generated service files found.");

	const services: ReverseService[] = [];
	for (const f of files) {
		const src = fileSystem.readFileSync(f, "utf-8");
		services.push(...parseGeneratedServiceSource(src, f));
	}

	if (services.length === 0)
		throw new Error("No operations could be reconstructed.");

	return services;
}

/**
 * Reconstructs an OpenAPI 3.2 `SwaggerSpec` from parsed `ReverseService` definitions and model schemas.
 *
 * @param services - Array of reconstructed `ReverseService` objects.
 * @param infoOverrides - Optional OpenAPI `info` field overrides.
 * @param schemas - Map of reconstructed model schemas.
 * @returns Reconstructed `SwaggerSpec` object.
 */
export function buildOpenApiSpecFromServices(
	services: ReverseService[],
	infoOverrides: Partial<InfoObject> = {},
	schemas: ReverseSchemaMap = {},
): SwaggerSpec {
	const paths: Record<string, PathItem> = {};
	const spec: SwaggerSpec = {
		openapi: "3.2.0",
		jsonSchemaDialect: OAS_3_1_DIALECT,
		info: { title: "Recovered", version: "1.0.0", ...infoOverrides },
		paths,
	};

	const tags = new Set<string>();

	services.forEach((service) => {
		service.operations.forEach((op) => {
			const pathItem = paths[op.path] || {};
			paths[op.path] = pathItem;

			const specOp: SpecOperation = {
				operationId: op.operationId || op.methodName,
				responses: {},
			};

			if (op.summary) specOp.summary = op.summary;
			if (op.description) specOp.description = op.description;
			if (op.deprecated) specOp.deprecated = op.deprecated;

			if (op.tags && op.tags.length > 0) {
				specOp.tags = op.tags;
				op.tags.forEach((t: string) => {
					tags.add(t);
				});
			}

			if (op.externalDocs) specOp.externalDocs = op.externalDocs;
			if (op.servers) specOp.servers = op.servers;
			if (op.security) specOp.security = op.security;
			if (op.extensions) Object.assign(specOp, op.extensions);

			assembleOperationParametersAndRequestBody(specOp, op, schemas);
			assembleOperationResponses(specOp, op, schemas);

			const methodLabel = op.httpMethod.toLowerCase();
			const standardMethods = [
				"get",
				"post",
				"put",
				"patch",
				"delete",
				"options",
				"head",
				"trace",
				"query",
			];

			if (standardMethods.includes(methodLabel)) {
				(pathItem as Record<string, OpenApiValue>)[methodLabel] = specOp;
			} else {
				pathItem.additionalOperations = pathItem.additionalOperations || {};
				(pathItem.additionalOperations as Record<string, SpecOperation>)[
					op.httpMethod
				] = specOp;
			}
		});
	});

	if (tags.size > 0) {
		spec.tags = Array.from(tags).map((t) => ({ name: t }));
	}

	if (Object.keys(schemas).length > 0) {
		spec.components = spec.components || {};
		spec.components.schemas = schemas;
	}

	return spec;
}
