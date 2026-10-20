/**
 * Reads and writes `openapi.snapshot.json` and `openapi.snapshot.yaml` files.
 *
 * @module openapi/parse_snapshot
 */
import path from "node:path";
import yaml from "js-yaml";
import type { SwaggerSpec } from "../core/types/index.js";

/** Directory creation options for `SnapshotFileSystem.mkdirSync`. */
export interface SnapshotMkdirOptions {
	/** Whether parent directories should be created recursively. */
	recursive?: boolean | undefined;
}

/** File status entry returned by `SnapshotFileSystem.statSync`. */
export interface SnapshotFileStat {
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

/**
 * File system abstraction required for reading and writing OpenAPI snapshots.
 */
export interface SnapshotFileSystem {
	/**
	 * Optional existence check.
	 * @param filePath - Path to check.
	 * @returns `true` if the path exists.
	 */
	existsSync?(filePath: string): boolean;
	/**
	 * Creates a directory synchronously.
	 * @param dirPath - Directory path to create.
	 * @param options - Optional recursive creation options.
	 */
	mkdirSync(dirPath: string, options?: SnapshotMkdirOptions): void;
	/**
	 * Writes UTF-8 text to a file synchronously.
	 * @param filePath - Destination file path.
	 * @param data - Text content to write.
	 */
	writeFileSync(filePath: string, data: string): void;
	/**
	 * Reads a file synchronously using the given encoding.
	 * @param filePath - Source file path.
	 * @param encoding - Text encoding string.
	 * @returns File text content.
	 */
	readFileSync(filePath: string, encoding: BufferEncoding): string;
	/**
	 * Returns file or directory status synchronously.
	 * @param filePath - Path to inspect.
	 * @returns File status entry.
	 */
	statSync(filePath: string): SnapshotFileStat;
}

/** Supported snapshot serialization formats. */
export type SnapshotFormat = "json" | "yaml";

/** Result returned by snapshot reader functions. */
export type SnapshotReadResult = {
	/** Parsed OpenAPI/Swagger specification object. */
	spec: SwaggerSpec;
	/** Resolved file path of the snapshot. */
	sourcePath: string;
	/** Format of the snapshot (`"json"` or `"yaml"`). */
	format: SnapshotFormat;
};

const SNAPSHOT_JSON = "openapi.snapshot.json";

const SNAPSHOT_YAML = "openapi.snapshot.yaml";

const SNAPSHOT_YML = "openapi.snapshot.yml";

function fileExists(
	fileSystem: Pick<SnapshotFileSystem, "existsSync" | "statSync">,
	filePath: string,
): boolean {
	if (typeof fileSystem.existsSync === "function") {
		return fileSystem.existsSync(filePath);
	}

	try {
		fileSystem.statSync(filePath);

		return true;
	} catch {
		return false;
	}
}

/**
 * Parses a snapshot payload into a Swagger/OpenAPI spec object.
 */
function parseSnapshot(contents: string, format: SnapshotFormat): SwaggerSpec {
	if (format === "json") {
		const parsed: unknown = JSON.parse(contents);
		if (!parsed || typeof parsed !== "object") {
			throw new Error("Parsed JSON snapshot did not produce an object.");
		}
		return parsed as SwaggerSpec;
	}

	const parsed: unknown = yaml.load(contents);

	if (!parsed || typeof parsed !== "object") {
		throw new Error("Parsed YAML snapshot did not produce an object.");
	}

	return parsed as SwaggerSpec;
}

/**
 * Resolves an input path (file or directory) to a concrete snapshot file path and format.
 */
function resolveSnapshotFile(
	inputPath: string,
	fileSystem: Pick<
		SnapshotFileSystem,
		"existsSync" | "statSync" | "readFileSync"
	>,
): { filePath: string; format: SnapshotFormat } {
	const stat = fileSystem.statSync(inputPath);

	if (stat.isFile()) {
		const ext = path.extname(inputPath).toLowerCase();

		if (ext === ".json") return { filePath: inputPath, format: "json" };

		if (ext === ".yaml" || ext === ".yml")
			return { filePath: inputPath, format: "yaml" };

		throw new Error(`Unsupported snapshot file extension: ${ext}`);
	}

	if (!stat.isDirectory()) {
		throw new Error(
			`Input path is neither a file nor a directory: ${inputPath}`,
		);
	}

	const jsonPath = path.join(inputPath, SNAPSHOT_JSON);

	if (fileExists(fileSystem, jsonPath))
		return { filePath: jsonPath, format: "json" };

	const yamlPath = path.join(inputPath, SNAPSHOT_YAML);

	if (fileExists(fileSystem, yamlPath))
		return { filePath: yamlPath, format: "yaml" };

	const ymlPath = path.join(inputPath, SNAPSHOT_YML);

	if (fileExists(fileSystem, ymlPath))
		return { filePath: ymlPath, format: "yaml" };

	throw new Error(
		`No OpenAPI snapshot found in directory. Expected ${SNAPSHOT_JSON} or ${SNAPSHOT_YAML}. Path: ${inputPath}`,
	);
}

/**
 * Reads an OpenAPI snapshot from a file path or directory.
 * Accepts either a direct snapshot file or a directory containing snapshot files.
 *
 * @param inputPath - Path to a snapshot file or directory containing a snapshot.
 * @param fileSystem - File system adapter.
 * @returns The parsed `SnapshotReadResult`.
 * @throws {Error} When no valid snapshot file is found or parsing fails.
 */
export function readOpenApiSnapshot(
	inputPath: string,
	fileSystem: Pick<
		SnapshotFileSystem,
		"existsSync" | "statSync" | "readFileSync"
	>,
): SnapshotReadResult {
	const resolved = resolveSnapshotFile(inputPath, fileSystem);

	const contents = fileSystem.readFileSync(resolved.filePath, "utf-8");

	const spec = parseSnapshot(contents, resolved.format);

	return { spec, sourcePath: resolved.filePath, format: resolved.format };
}

/** Paths written by `writeOpenApiSnapshot`. */
export interface SnapshotWriteResult {
	/** Path to the written JSON snapshot file. */
	jsonPath: string;
	/** Path to the written YAML snapshot file. */
	yamlPath: string;
}

/**
 * Writes OpenAPI snapshot files (JSON and YAML) to an output directory.
 *
 * @param spec - OpenAPI/Swagger specification object to serialize.
 * @param outputDir - Target directory where snapshot files will be written.
 * @param fileSystem - File system adapter.
 * @returns Object containing the written `jsonPath` and `yamlPath`.
 */
export function writeOpenApiSnapshot(
	spec: SwaggerSpec,
	outputDir: string,
	fileSystem: SnapshotFileSystem,
): SnapshotWriteResult {
	if (!fileExists(fileSystem, outputDir)) {
		fileSystem.mkdirSync(outputDir, { recursive: true });
	}

	const jsonPath = path.join(outputDir, SNAPSHOT_JSON);

	const yamlPath = path.join(outputDir, SNAPSHOT_YAML);

	fileSystem.writeFileSync(jsonPath, JSON.stringify(spec, null, 2));

	fileSystem.writeFileSync(
		yamlPath,
		yaml.dump(spec, { noRefs: true, lineWidth: 120 }),
	);

	return { jsonPath, yamlPath };
}

/** Standard snapshot filenames by extension key. */
export interface SnapshotFilenamesMap {
	/** JSON snapshot filename. */
	json: string;
	/** YAML (`.yaml`) snapshot filename. */
	yaml: string;
	/** YAML (`.yml`) snapshot filename. */
	yml: string;
}

/** Standard snapshot filenames used by the generator. */
export const SNAPSHOT_FILENAMES: SnapshotFilenamesMap = {
	json: SNAPSHOT_JSON,
	yaml: SNAPSHOT_YAML,
	yml: SNAPSHOT_YML,
};
