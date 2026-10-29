/**
 * Serialization helpers for writing OpenAPI specifications and documentation JSON to files or stdout, and loading `package.json` version metadata.
 *
 * @module cli/spec_writer
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import type { OpenApiValue } from "../core/types/index.js";

/**
 * Loads the CLI version string from `package.json` with a fallback to `"1.0.0"`.
 *
 * @param metaUrl - `import.meta.url` of the caller module.
 * @returns Package version string.
 */
export function loadPackageVersion(metaUrl: string): string {
	try {
		const packageJsonPath = new URL("../../package.json", metaUrl);
		const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
			version?: string;
		};
		return parsed.version || "1.0.0";
	} catch {
		return "1.0.0";
	}
}

const NEWLINE = String.fromCharCode(10);

/**
 * Serializes an OpenAPI specification to JSON or YAML and writes it to a file or `process.stdout`.
 *
 * @param spec - OpenAPI specification value to serialize.
 * @param format - Target output format (`"json"` or `"yaml"`).
 * @param outputPath - Optional file path to write to; if omitted, writes to `process.stdout`.
 */
export function writeFormattedSpec(
	spec: OpenApiValue,
	format: "json" | "yaml",
	outputPath?: string,
): void {
	const effectiveFormat = outputPath?.toLowerCase().endsWith(".json")
		? "json"
		: format;
	const serialized =
		effectiveFormat === "json"
			? JSON.stringify(spec, null, 2)
			: yaml.dump(spec, { noRefs: true });

	const formatted = `${serialized.trimEnd()}${NEWLINE}`;
	if (outputPath) {
		fs.writeFileSync(outputPath, formatted, "utf8");
	} else {
		process.stdout.write(formatted);
	}
}

/**
 * Serializes a JSON documentation object and writes it to a file (or `<outputPath>/docs.json` when `outputPath` is a directory) or `process.stdout`.
 *
 * @param docs - Documentation payload to serialize.
 * @param outputPath - Optional file or directory path to write to; if omitted, writes to `process.stdout`.
 */
export function writeDocsJsonOutput(
	docs: OpenApiValue,
	outputPath?: string,
): void {
	const outputStr = `${JSON.stringify(docs, null, 2)}${NEWLINE}`;
	if (outputPath) {
		const isExistingDir =
			fs.existsSync(outputPath) &&
			typeof fs.statSync === "function" &&
			fs.statSync(outputPath).isDirectory();
		const isJavyDir =
			Boolean((globalThis as { __FsData?: unknown }).__FsData) &&
			!outputPath.endsWith(".json");
		if (isJavyDir) {
			fs.mkdirSync(outputPath, { recursive: true });
		}
		const targetPath =
			isExistingDir || isJavyDir
				? path.join(outputPath, "docs.json")
				: outputPath;
		fs.writeFileSync(targetPath, outputStr, "utf8");
	} else {
		process.stdout.write(outputStr);
	}
}
