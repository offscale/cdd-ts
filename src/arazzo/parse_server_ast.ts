/**
 * Reverse-parses generated backend Server workflow routes (`workflows/engine.routes.ts`)
 * and Vitest E2E workflow suites (`workflows/workflows.e2e.spec.ts`) back into an Arazzo 1.1.0
 * specification using `ts-morph` AST analysis.
 *
 * @module arazzo/parse_server_ast
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
	type Expression,
	Project,
	type SourceFile,
	SyntaxKind,
} from "ts-morph";
import type {
	ArazzoSpec,
	ArazzoStepObject,
	ArazzoWorkflowObject,
} from "../core/types/index.js";
import { evaluateAstLiteral } from "../openapi/parse_ast_literal.js";
import { parseArazzoSdkAst } from "./parse_sdk_ast.js";
import { validateArazzoSpec } from "./parse_validator.js";

/**
 * Statically analyzes a Vitest E2E workflow `SourceFile` (`workflows.e2e.spec.ts`) into an `ArazzoSpec`.
 *
 * @param sourceFile - `ts-morph` `SourceFile` of the E2E test file.
 * @returns Reconstructed `ArazzoSpec`.
 */
export function parseArazzoServerE2eSourceFile(
	sourceFile: SourceFile,
): ArazzoSpec {
	let title = "Server E2E Workflows";
	const workflows: ArazzoWorkflowObject[] = [];

	const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
	for (const call of calls) {
		if (call.getExpression().getText() !== "describe") continue;
		const firstArg = (call.getArguments()[0] as Expression)
			.getText()
			.replace(/^['"]|['"]$/g, "");

		if (firstArg.startsWith("Arazzo E2E Workflows: ")) {
			title = firstArg.slice("Arazzo E2E Workflows: ".length);
			continue;
		}

		if (firstArg.startsWith("workflow: ")) {
			const wfId = firstArg.slice("workflow: ".length);
			const steps: ArazzoStepObject[] = [];

			const innerCalls = call.getDescendantsOfKind(SyntaxKind.CallExpression);
			for (const ic of innerCalls) {
				if (ic.getExpression().getText() !== "it") continue;
				const stepVar = ic
					.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
					.find((v) => v.getName() === "stepMeta");
				const stepInit = stepVar?.getInitializer();
				if (stepInit) {
					const stepObj = evaluateAstLiteral(
						stepInit,
					) as unknown as ArazzoStepObject;
					steps.push(stepObj);
				}
			}

			workflows.push({
				workflowId: wfId,
				steps,
			});
		}
	}

	if (workflows.length === 0) {
		throw new Error("No Arazzo E2E workflow blocks found in source file.");
	}

	const spec: ArazzoSpec = {
		arazzo: "1.1.0",
		info: {
			title,
			version: "1.0.0",
		},
		sourceDescriptions: [
			{
				name: "server",
				url: "./openapi.json",
				type: "openapi",
			},
		],
		workflows,
	};

	validateArazzoSpec(spec);
	return spec;
}

/**
 * Reverse-parses a Server/E2E workflow directory or `.e2e.spec.ts` file into an `ArazzoSpec`.
 *
 * @param inputPath - Path to server root directory, `workflows/` directory, or `.e2e.spec.ts` file.
 * @returns Reconstructed `ArazzoSpec`.
 */
export function parseArazzoServerAst(inputPath: string): ArazzoSpec {
	const stat = fs.statSync(inputPath);
	const baseDir = stat.isDirectory() ? inputPath : path.dirname(inputPath);
	const sdkIndex = fs.existsSync(path.join(baseDir, "workflows", "index.ts"))
		? path.join(baseDir, "workflows", "index.ts")
		: path.join(baseDir, "index.ts");

	if (stat.isDirectory() && fs.existsSync(sdkIndex)) {
		return parseArazzoSdkAst(sdkIndex);
	}

	const e2ePath = stat.isDirectory()
		? path.join(inputPath, "workflows", "workflows.e2e.spec.ts")
		: inputPath;

	const project = new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
	});
	const sf = project.createSourceFile(
		"workflows.e2e.spec.ts",
		fs.readFileSync(e2ePath, "utf-8"),
		{ overwrite: true },
	);

	return parseArazzoServerE2eSourceFile(sf);
}
