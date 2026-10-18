/**
 * Reads and writes `arazzo.snapshot.json` and `arazzo.snapshot.yaml` files.
 *
 * @module arazzo/parse_snapshot
 */
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { ArazzoSpec } from "../core/types/index.js";
import { validateArazzoSpec } from "./parse_validator.js";

/** Standard JSON snapshot filename for Arazzo specifications. */
export const ARAZZO_SNAPSHOT_JSON = "arazzo.snapshot.json";
/** Standard YAML (`.yaml`) snapshot filename for Arazzo specifications. */
export const ARAZZO_SNAPSHOT_YAML = "arazzo.snapshot.yaml";
/** Standard YAML (`.yml`) snapshot filename for Arazzo specifications. */
export const ARAZZO_SNAPSHOT_YML = "arazzo.snapshot.yml";

/**
 * Minimal filesystem interface for writing and reading Arazzo snapshots (supports both Node `fs` and `ts-morph` in-memory FS).
 */
export interface ArazzoSnapshotFileSystem {
	/**
	 * Synchronously writes a UTF-8 file.
	 *
	 * @param filePath - Destination file path.
	 * @param data - UTF-8 string content to write.
	 */
	writeFileSync(filePath: string, data: string): void;
	/**
	 * Synchronously checks whether a file exists.
	 *
	 * @param filePath - File path to inspect.
	 * @returns `true` if the file exists.
	 */
	fileExistsSync?(filePath: string): boolean;
	/**
	 * Synchronously reads a UTF-8 file.
	 *
	 * @param filePath - File path to read.
	 * @param encoding - Optional text encoding.
	 * @returns File content string.
	 */
	readFileSync?(filePath: string, encoding?: string): string;
}

/**
 * Writes both `arazzo.snapshot.json` and `arazzo.snapshot.yaml` into `outputDir`.
 *
 * @param spec - Validated `ArazzoSpec` to persist.
 * @param outputDir - Target directory path.
 * @param customFs - Optional custom filesystem adapter.
 */
export function writeArazzoSnapshot(
	spec: ArazzoSpec,
	outputDir: string,
	customFs?: ArazzoSnapshotFileSystem,
): void {
	const jsonPath = path.join(outputDir, ARAZZO_SNAPSHOT_JSON);
	const yamlPath = path.join(outputDir, ARAZZO_SNAPSHOT_YAML);
	const jsonText = JSON.stringify(spec, null, 2);
	const yamlText = yaml.dump(spec, { noRefs: true });

	if (customFs) {
		customFs.writeFileSync(jsonPath, jsonText);
		customFs.writeFileSync(yamlPath, yamlText);
		return;
	}

	fs.mkdirSync(outputDir, { recursive: true });
	fs.writeFileSync(jsonPath, jsonText, "utf-8");
	fs.writeFileSync(yamlPath, yamlText, "utf-8");
}

/**
 * Attempts to read a persisted Arazzo snapshot (`arazzo.snapshot.json`, `.yaml`, or `.yml`) from `inputPath`.
 *
 * @param inputPath - Directory path or direct snapshot file path.
 * @returns Validated `ArazzoSpec` if a snapshot exists, otherwise `undefined`.
 */
export function readArazzoSnapshot(inputPath: string): ArazzoSpec | undefined {
	if (!fs.existsSync(inputPath)) return undefined;

	const stat = fs.statSync(inputPath);
	const candidates = stat.isDirectory()
		? [
				path.join(inputPath, ARAZZO_SNAPSHOT_JSON),
				path.join(inputPath, ARAZZO_SNAPSHOT_YAML),
				path.join(inputPath, ARAZZO_SNAPSHOT_YML),
			]
		: [inputPath];

	const validNames = new Set([
		ARAZZO_SNAPSHOT_JSON,
		ARAZZO_SNAPSHOT_YAML,
		ARAZZO_SNAPSHOT_YML,
	]);

	for (const candidate of candidates) {
		if (!fs.existsSync(candidate)) continue;
		if (!validNames.has(path.basename(candidate))) continue;

		const raw = fs.readFileSync(candidate, "utf-8");
		const parsed: unknown = candidate.endsWith(".json")
			? JSON.parse(raw)
			: yaml.load(raw);
		validateArazzoSpec(parsed);
		return parsed;
	}

	return undefined;
}
