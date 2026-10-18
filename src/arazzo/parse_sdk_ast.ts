/**
 * Reverse-parses generated TypeScript SDK `WorkflowOrchestrator` ASTs (`workflows/index.ts`,
 * `workflows/models.ts`) back into an Arazzo 1.1.0 specification without executing code.
 *
 * @module arazzo/parse_sdk_ast
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { Project, type SourceFile } from "ts-morph";
import { parseGeneratedModelSource } from "../classes/parse.js";
import type {
	ArazzoComponentsObject,
	ArazzoInfoObject,
	ArazzoSourceDescriptionObject,
	ArazzoSpec,
	ArazzoWorkflowObject,
} from "../core/types/index.js";
import { evaluateAstLiteral } from "../openapi/parse_ast_literal.js";
import { validateArazzoSpec } from "./parse_validator.js";

/**
 * Parses a `workflows/index.ts` (and optional `workflows/models.ts`) `SourceFile` into an `ArazzoSpec`.
 *
 * @param indexSourceFile - `ts-morph` `SourceFile` for `workflows/index.ts`.
 * @param modelsSourceText - Optional TypeScript source text of `workflows/models.ts`.
 * @returns Reconstructed and validated `ArazzoSpec`.
 */
export function parseArazzoSdkSourceFile(
	indexSourceFile: SourceFile,
	modelsSourceText?: string,
): ArazzoSpec {
	const metaVar = indexSourceFile.getVariableDeclaration(
		"ARAZZO_SPEC_METADATA",
	);
	const metaInit = metaVar?.getInitializer();
	if (metaInit) {
		const parsed = evaluateAstLiteral(metaInit);
		validateArazzoSpec(parsed);
		return parsed;
	}

	const cls =
		indexSourceFile.getClass("WorkflowOrchestrator") ??
		indexSourceFile.getClasses()[0];
	if (!cls) {
		throw new Error(
			"No WorkflowOrchestrator class or ARAZZO_SPEC_METADATA found in source file.",
		);
	}

	const getStaticLiteral = <T>(propName: string): T | undefined => {
		const prop = cls.getStaticProperty(propName);
		const init =
			prop && "getInitializer" in prop ? prop.getInitializer() : undefined;
		return init ? (evaluateAstLiteral(init) as unknown as T) : undefined;
	};

	const arazzo = getStaticLiteral<string>("arazzo") ?? "1.1.0";
	const $self = getStaticLiteral<string>("$self");
	const info = getStaticLiteral<ArazzoInfoObject>("info") ?? {
		title: "Extracted Arazzo Workflows",
		version: "1.0.0",
	};
	const sourceDescriptions = getStaticLiteral<ArazzoSourceDescriptionObject[]>(
		"sourceDescriptions",
	) ?? [{ name: "default", url: "./openapi.json", type: "openapi" }];
	const components = getStaticLiteral<ArazzoComponentsObject>("components");

	const parsedModels = modelsSourceText
		? parseGeneratedModelSource(modelsSourceText)
		: {};

	const workflows: ArazzoWorkflowObject[] = [];
	for (const method of cls.getMethods()) {
		const wfDecl = method
			.getVariableDeclarations()
			.find((v) => v.getName() === "workflowDefinition");
		const wfInit = wfDecl?.getInitializer();
		if (wfInit) {
			const wfObj = evaluateAstLiteral(
				wfInit,
			) as unknown as ArazzoWorkflowObject;
			workflows.push(wfObj);
			continue;
		}

		const wfId = method.getName();
		const paramType = method.getParameters()[0]?.getTypeNode()?.getText();
		const inputsSchema =
			paramType && parsedModels[paramType]
				? parsedModels[paramType]
				: undefined;

		workflows.push({
			workflowId: wfId,
			...(inputsSchema !== undefined ? { inputs: inputsSchema } : {}),
			steps: [
				{
					stepId: "step1",
					operationId: wfId,
				},
			],
		});
	}

	const reconstructed: ArazzoSpec = {
		arazzo,
		...($self ? { $self } : {}),
		info,
		sourceDescriptions,
		workflows,
		...(components ? { components } : {}),
	};

	validateArazzoSpec(reconstructed);
	return reconstructed;
}

/**
 * Reverse-parses an SDK directory or TypeScript source file into a validated `ArazzoSpec`.
 *
 * @param inputPath - Path to `workflows/index.ts` or root SDK directory.
 * @returns Reconstructed `ArazzoSpec`.
 */
export function parseArazzoSdkAst(inputPath: string): ArazzoSpec {
	const stat = fs.statSync(inputPath);
	const indexFilePath = stat.isDirectory()
		? fs.existsSync(path.join(inputPath, "workflows", "index.ts"))
			? path.join(inputPath, "workflows", "index.ts")
			: path.join(inputPath, "index.ts")
		: inputPath;

	const dirOfIndex = path.dirname(indexFilePath);
	const modelsPath = path.join(dirOfIndex, "models.ts");
	const modelsText = fs.existsSync(modelsPath)
		? fs.readFileSync(modelsPath, "utf-8")
		: undefined;

	const project = new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
	});
	const sf = project.createSourceFile(
		"workflows/index.ts",
		fs.readFileSync(indexFilePath, "utf-8"),
		{ overwrite: true },
	);

	return parseArazzoSdkSourceFile(sf, modelsText);
}
