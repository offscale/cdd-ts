/**
 * Reverse-parses generated Commander CLI workflow runner TypeScript files (`cli.ts`)
 * back into an Arazzo 1.1.0 specification using `ts-morph` AST analysis.
 *
 * @module arazzo/parse_cli_ast
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
	type CallExpression,
	Project,
	type SourceFile,
	SyntaxKind,
} from "ts-morph";
import type {
	ArazzoSourceDescriptionObject,
	ArazzoSpec,
	ArazzoWorkflowObject,
	OpenApiValue,
	SwaggerDefinition,
} from "../core/types/index.js";
import { parseArazzoSdkAst } from "./parse_sdk_ast.js";
import { validateArazzoSpec } from "./parse_validator.js";

/**
 * Extracts a string literal argument at `index` from a `CallExpression`.
 *
 * @param call - `ts-morph` CallExpression.
 * @param index - Argument index.
 * @returns Unquoted string or `undefined`.
 */
function getStringArg(call: CallExpression, index: number): string | undefined {
	const arg = call.getArguments()[index];
	return arg ? arg.getText().trim().slice(1, -1) : undefined;
}

/**
 * Statically analyzes a Commander `cli.ts` `SourceFile` to reconstruct an `ArazzoSpec`.
 *
 * @param sourceFile - `ts-morph` `SourceFile` of the CLI file.
 * @returns Reconstructed `ArazzoSpec`.
 */
export function parseArazzoCliSourceFile(sourceFile: SourceFile): ArazzoSpec {
	let title = "CLI Workflows";
	let description: string | undefined;
	let version = "1.0.0";
	const sourceDescriptions: ArazzoSourceDescriptionObject[] = [];
	const workflowsByVar = new Map<string, ArazzoWorkflowObject>();

	const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

	for (const call of calls) {
		const expr = call.getExpression();
		if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue;
		const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
		const methodName = propAccess.getName();
		const targetText = propAccess.getExpression().getText();

		if (methodName === "name" && targetText.startsWith("program")) {
			title = getStringArg(call, 0) as string;
		} else if (
			methodName === "description" &&
			(targetText === "program" || targetText.startsWith("program.name("))
		) {
			description = getStringArg(call, 0);
		} else if (methodName === "version" && targetText.startsWith("program.")) {
			version = getStringArg(call, 0) as string;
		} else if (methodName === "option" && targetText === "program") {
			const flag = getStringArg(call, 0) as string;
			const srcMatch = /^--source-([A-Za-z0-9_-]+)-url/.exec(flag);
			if (srcMatch?.[1]) {
				const url = getStringArg(call, 2) as string;
				sourceDescriptions.push({
					name: srcMatch[1],
					url,
					type: "openapi",
				});
			}
		} else if (methodName === "command" && targetText === "workflowCmd") {
			const wfId = getStringArg(call, 0) as string;
			const varDecl = call.getFirstAncestorByKind(
				SyntaxKind.VariableDeclaration,
			);
			const varName = varDecl?.getName() ?? wfId;
			workflowsByVar.set(varName, {
				workflowId: wfId,
				steps: [{ stepId: "execute", operationId: wfId }],
			});
		} else if (methodName === "description") {
			const wfObj = workflowsByVar.get(targetText);
			const summaryVal = getStringArg(call, 0);
			if (wfObj && summaryVal) {
				wfObj.summary = summaryVal;
			}
		} else if (methodName === "option") {
			const wfObj = workflowsByVar.get(targetText);
			if (wfObj) {
				const flag = getStringArg(call, 0) as string;
				const propMatch = /^--([A-Za-z0-9_-]+)/.exec(flag);
				const propName = (propMatch?.[1] ?? flag) as string;
				const propDesc = getStringArg(call, 1);
				const schema = (wfObj.inputs ?? {
					type: "object",
					properties: {},
				}) as SwaggerDefinition;
				schema.properties ??= {};
				schema.properties[propName] = {
					type: "string",
					...(propDesc ? { description: propDesc } : {}),
				} as unknown as SwaggerDefinition;
				wfObj.inputs = schema;
			}
		}
	}

	if (sourceDescriptions.length === 0) {
		sourceDescriptions.push({
			name: "default",
			url: "./openapi.json",
			type: "openapi",
		});
	}

	const workflows = Array.from(workflowsByVar.values());
	if (workflows.length === 0) {
		workflows.push({
			workflowId: "defaultWorkflow",
			steps: [{ stepId: "step1", operationId: "defaultOp" }],
		});
	}

	const spec: ArazzoSpec = {
		arazzo: "1.1.0",
		info: {
			title,
			...(description ? { description } : {}),
			version,
		} as ArazzoSpec["info"] & Record<string, OpenApiValue>,
		sourceDescriptions,
		workflows,
	};

	validateArazzoSpec(spec);
	return spec;
}

/**
 * Reverse-parses a CLI file or directory containing `cli.ts` (and optional sibling `workflows/index.ts`) into an `ArazzoSpec`.
 *
 * @param inputPath - File or directory path.
 * @returns Reconstructed `ArazzoSpec`.
 */
export function parseArazzoCliAst(inputPath: string): ArazzoSpec {
	const stat = fs.statSync(inputPath);
	const baseDir = stat.isDirectory() ? inputPath : path.dirname(inputPath);
	const sdkIndex = path.join(baseDir, "workflows", "index.ts");

	if (fs.existsSync(sdkIndex)) {
		return parseArazzoSdkAst(sdkIndex);
	}

	const cliPath = stat.isDirectory()
		? path.join(inputPath, "cli.ts")
		: inputPath;

	const project = new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
	});
	const sf = project.createSourceFile(
		"cli.ts",
		fs.readFileSync(cliPath, "utf-8"),
		{ overwrite: true },
	);

	return parseArazzoCliSourceFile(sf);
}
