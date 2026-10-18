/**
 * Unified orchestrator facade for reverse-parsing generated TypeScript SDKs, CLIs,
 * or Server/E2E test suites into a validated Arazzo 1.1.0 specification (`to_arazzo`).
 *
 * @module arazzo/emit_arazzo
 */
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { ArazzoSpec } from "../core/types/index.js";
import { parseArazzoCliAst } from "./parse_cli_ast.js";
import { parseArazzoSdkAst } from "./parse_sdk_ast.js";
import { parseArazzoServerAst } from "./parse_server_ast.js";
import { readArazzoSnapshot } from "./parse_snapshot.js";
import { validateArazzoSpec } from "./parse_validator.js";

/**
 * Reconstructs a validated `ArazzoSpec` from a directory or TypeScript source file.
 * Checks for an Arazzo snapshot first (unless `ignoreSnapshot` is `true`), then falls back
 * to static `ts-morph` AST extraction across SDK, CLI, and Server/E2E layouts.
 *
 * @param inputPath - Path to directory or `.ts` / snapshot file.
 * @param ignoreSnapshot - When `true`, skips `arazzo.snapshot.{json,yaml}` and forces AST parsing.
 * @returns Validated `ArazzoSpec`.
 */
export function extractArazzoFromTypeScript(
	inputPath: string,
	ignoreSnapshot?: boolean,
): ArazzoSpec {
	if (!ignoreSnapshot) {
		const snap = readArazzoSnapshot(inputPath);
		if (snap) {
			return snap;
		}
	}

	const stat = fs.statSync(inputPath);
	if (stat.isFile()) {
		if (inputPath.endsWith(".e2e.spec.ts")) {
			return parseArazzoServerAst(inputPath);
		}
		if (path.basename(inputPath).includes("cli")) {
			return parseArazzoCliAst(inputPath);
		}
		return parseArazzoSdkAst(inputPath);
	}

	const wfIndex = path.join(inputPath, "workflows", "index.ts");
	const directIndex = path.join(inputPath, "index.ts");
	if (fs.existsSync(wfIndex) || fs.existsSync(directIndex)) {
		return parseArazzoSdkAst(inputPath);
	}

	const e2eFile = path.join(inputPath, "workflows", "workflows.e2e.spec.ts");
	if (fs.existsSync(e2eFile)) {
		return parseArazzoServerAst(e2eFile);
	}

	const cliFile = path.join(inputPath, "cli.ts");
	if (fs.existsSync(cliFile)) {
		return parseArazzoCliAst(cliFile);
	}

	throw new Error(
		`Could not locate Arazzo TypeScript artifacts in '${inputPath}'.`,
	);
}

/**
 * Serializes a validated `ArazzoSpec` to a formatted JSON or YAML file.
 *
 * @param spec - Validated `ArazzoSpec`.
 * @param outputPath - Destination file path.
 * @param format - Optional explicit format (`"json"` or `"yaml"`).
 */
export function writeFormattedArazzoSpec(
	spec: ArazzoSpec,
	outputPath: string,
	format?: "json" | "yaml",
): void {
	validateArazzoSpec(spec);
	const resolvedFormat =
		format ??
		(outputPath.endsWith(".yaml") || outputPath.endsWith(".yml")
			? "yaml"
			: "json");

	const content =
		resolvedFormat === "yaml"
			? yaml.dump(spec, { noRefs: true })
			: JSON.stringify(spec, null, 2);

	fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
	fs.writeFileSync(outputPath, content, "utf-8");
}
