import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { ArazzoParser } from "../../src/arazzo/parse.js";
import { ArazzoLoader } from "../../src/arazzo/parse_loader.js";
import {
	ArazzoValidationError,
	validateArazzoSpec,
} from "../../src/arazzo/parse_validator.js";
import type {
	ArazzoSpec,
	GeneratorConfig,
	SwaggerSpec,
} from "../../src/core/types/index.js";

const mockConfig: GeneratorConfig = {
	input: "",
	output: "",
	options: {
		framework: "vanilla",
		implementation: "fetch",
		enumStyle: "enum",
		dateType: "string",
	},
};

const sampleOpenApi: SwaggerSpec = {
	openapi: "3.1.0",
	info: { title: "Petstore", version: "1.0.0" },
	paths: {
		"/pet": {
			post: {
				operationId: "addPet",
				tags: ["Pet"],
				responses: { "200": { description: "ok" } },
			},
		},
		"/pet/{petId}": {
			get: {
				operationId: "getPetById",
				tags: ["Pet"],
				parameters: [
					{
						name: "petId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": { description: "ok" } },
			},
		},
	},
};

type NonEmptyIndexed<T> = T[] & { 0: T; 1: T };

function createValidSpec(): ArazzoSpec & {
	sourceDescriptions: NonEmptyIndexed<ArazzoSpec["sourceDescriptions"][number]>;
	workflows: NonEmptyIndexed<
		Omit<ArazzoSpec["workflows"][number], "steps"> & {
			steps: NonEmptyIndexed<ArazzoSpec["workflows"][number]["steps"][number]>;
		}
	>;
} {
	const spec: ArazzoSpec = {
		arazzo: "1.1.0",
		$self: "https://example.com/workflows/petstore.arazzo.yaml",
		info: {
			title: "Petstore Orchestration",
			summary: "Orchestrates pet lifecycle",
			description: "Full lifecycle workflow",
			version: "1.0.0",
		},
		sourceDescriptions: [
			{
				name: "petstore",
				url: "./petstore.openapi.json",
				type: "openapi",
			},
			{
				name: "events",
				url: "./events.asyncapi.yaml",
				type: "asyncapi",
			},
			{
				name: "externalFlows",
				url: "./external.arazzo.yaml",
				type: "arazzo",
			},
		],
		components: {
			inputs: {
				PetOrderInput: {
					type: "object",
					properties: {
						petName: { type: "string" },
						quantity: { type: "integer" },
					},
					required: ["petName"],
				},
			},
			parameters: {
				apiKeyHeader: {
					name: "X-Api-Key",
					in: "header",
					value: "$inputs.apiKey",
				},
			},
			successActions: {
				finishWorkflow: {
					name: "finishWorkflow",
					type: "end",
					criteria: [{ condition: "$statusCode == 200" }],
				},
			},
			failureActions: {
				retryTransient: {
					name: "retryTransient",
					type: "retry",
					retryAfter: 1,
					retryLimit: 3,
					criteria: [{ condition: "$statusCode == 503" }],
				},
			},
		},
		workflows: [
			{
				workflowId: "adoptPet",
				summary: "Adopt a pet",
				description: "Creates and fetches a pet",
				inputs: {
					$ref: "#/components/inputs/PetOrderInput",
				},
				parameters: [{ reference: "$components.parameters.apiKeyHeader" }],
				successActions: [
					{ reference: "$components.successActions.finishWorkflow" },
				],
				failureActions: [
					{ reference: "$components.failureActions.retryTransient" },
				],
				steps: [
					{
						stepId: "createPet",
						description: "Create pet record",
						operationId: "$sourceDescriptions.petstore.addPet",
						timeout: 5000,
						parameters: [
							{
								reference: "$components.parameters.apiKeyHeader",
								value: "override-key",
							},
							{
								name: "trace",
								in: "query",
								value: "1",
							},
						],
						requestBody: {
							contentType: "application/json",
							payload: { name: "$inputs.petName" },
							replacements: [
								{
									target: "/name",
									value: "$inputs.petName",
								},
							],
						},
						successCriteria: [
							{
								context: "$statusCode",
								condition: "^200$",
								type: "regex",
							},
							{
								context: "$response.body",
								condition: "$.id",
								type: { type: "jsonpath", version: "rfc9535" },
							},
						],
						onSuccess: [
							{
								name: "goToFetch",
								type: "goto",
								stepId: "fetchPet",
							},
						],
						onFailure: [
							{
								name: "jumpToSub",
								type: "goto",
								workflowId: "fallbackWorkflow",
							},
						],
						outputs: {
							createdId: "$response.body#/id",
							structuredId: {
								context: "$response.body",
								selector: "$.id",
								type: "jsonpath",
							},
						},
					},
					{
						stepId: "fetchPet",
						dependsOn: ["createPet"],
						operationPath:
							"{$sourceDescriptions.petstore.url}#/paths/~1pet~1{petId}/get",
						parameters: [
							{
								name: "petId",
								in: "path",
								value: "$steps.createPet.outputs.createdId",
							},
						],
					},
					{
						stepId: "notifyChannel",
						dependsOn: ["fetchPet"],
						channelPath: "/pet/adopted",
						action: "send",
						correlationId: "$steps.createPet.outputs.createdId",
					},
					{
						stepId: "awaitConfirmation",
						dependsOn: ["notifyChannel"],
						channelPath: "/pet/confirmed",
						action: "receive",
					},
					{
						stepId: "runSubWorkflow",
						dependsOn: ["awaitConfirmation"],
						workflowId: "fallbackWorkflow",
					},
					{
						stepId: "runExtWorkflow",
						dependsOn: ["runSubWorkflow"],
						workflowId:
							"$sourceDescriptions.externalFlows.workflows.auditAdopt",
					},
				],
				outputs: {
					adoptedPetId: "$steps.createPet.outputs.createdId",
				},
			},
			{
				workflowId: "fallbackWorkflow",
				dependsOn: ["adoptPet"],
				inputs: {
					$ref: "$components.inputs.PetOrderInput",
				},
				steps: [
					{
						stepId: "simpleStep",
						operationId: "addPet",
					},
				],
			},
		],
	};
	return spec as ReturnType<typeof createValidSpec>;
}

describe("Arazzo 1.1.0 Validator, Loader & Parser", () => {
	describe("validateArazzoSpec", () => {
		it("accepts a valid Arazzo 1.1.0 specification", () => {
			const spec = createValidSpec();
			expect(() => validateArazzoSpec(spec)).not.toThrow();
		});

		it("throws ArazzoValidationError for all structural and semantic violations", () => {
			expect(() => validateArazzoSpec(null)).toThrow(ArazzoValidationError);

			const badVer = createValidSpec();
			badVer.arazzo = "2.0.0";
			expect(() => validateArazzoSpec(badVer)).toThrow(
				/Unsupported Arazzo version/,
			);

			const badTitle = createValidSpec();
			badTitle.info.title = "  ";
			expect(() => validateArazzoSpec(badTitle)).toThrow(/non-empty 'title'/);

			const badInfoVer = createValidSpec();
			badInfoVer.info.version = "";
			expect(() => validateArazzoSpec(badInfoVer)).toThrow(
				/non-empty 'version'/,
			);

			const emptySources: ArazzoSpec = createValidSpec();
			emptySources.sourceDescriptions = [];
			expect(() => validateArazzoSpec(emptySources)).toThrow(
				/sourceDescriptions/,
			);

			const badSourceName = createValidSpec();
			badSourceName.sourceDescriptions[0].name = "invalid name!";
			expect(() => validateArazzoSpec(badSourceName)).toThrow(
				/Invalid sourceDescription name/,
			);

			const dupSourceName = createValidSpec();
			dupSourceName.sourceDescriptions[1].name = "petstore";
			expect(() => validateArazzoSpec(dupSourceName)).toThrow(
				/Duplicate sourceDescription name/,
			);

			const badSourceUrl = createValidSpec();
			badSourceUrl.sourceDescriptions[0].url = "";
			expect(() => validateArazzoSpec(badSourceUrl)).toThrow(/non-empty 'url'/);

			const badSourceType = createValidSpec();
			(
				badSourceType.sourceDescriptions[0] as unknown as { type: string }
			).type = "graphql";
			expect(() => validateArazzoSpec(badSourceType)).toThrow(
				/Invalid sourceDescription type/,
			);

			const emptyWfs: ArazzoSpec = createValidSpec();
			emptyWfs.workflows = [];
			expect(() => validateArazzoSpec(emptyWfs)).toThrow(
				/at least one Workflow/,
			);

			const dupWfId = createValidSpec();
			dupWfId.workflows[1].workflowId = "adoptPet";
			expect(() => validateArazzoSpec(dupWfId)).toThrow(/Duplicate workflowId/);

			const emptyWfId = createValidSpec();
			emptyWfId.workflows[0].workflowId = "";
			expect(() => validateArazzoSpec(emptyWfId)).toThrow(
				/non-empty 'workflowId'/,
			);

			const emptySteps = createValidSpec();
			(emptySteps.workflows[0] as ArazzoSpec["workflows"][number]).steps = [];
			expect(() => validateArazzoSpec(emptySteps)).toThrow(/at least one step/);

			const dupStepId = createValidSpec();
			dupStepId.workflows[0].steps[1].stepId = "createPet";
			expect(() => validateArazzoSpec(dupStepId)).toThrow(/Duplicate stepId/);

			const emptyStepId = createValidSpec();
			emptyStepId.workflows[0].steps[0].stepId = "";
			expect(() => validateArazzoSpec(emptyStepId)).toThrow(
				/non-empty 'stepId'/,
			);

			const multiTarget = createValidSpec();
			multiTarget.workflows[0].steps[0].operationPath = "#/paths/~1pet/post";
			expect(() => validateArazzoSpec(multiTarget)).toThrow(
				/mutually exclusively/,
			);

			const negTimeout = createValidSpec();
			negTimeout.workflows[0].steps[0].timeout = 0;
			expect(() => validateArazzoSpec(negTimeout)).toThrow(/positive number/);

			const badAction = createValidSpec();
			(
				badAction.workflows[0]?.steps[0] as unknown as { action: string }
			).action = "invalid";
			expect(() => validateArazzoSpec(badAction)).toThrow(
				/action MUST be 'send' or 'receive'/,
			);

			const badParamRef = createValidSpec();
			badParamRef.workflows[0].parameters = [
				{ reference: "$components.invalid.ref" },
			];
			expect(() => validateArazzoSpec(badParamRef)).toThrow(
				/Invalid parameter reusable reference/,
			);

			const unresolvedParamRef = createValidSpec();
			unresolvedParamRef.workflows[0].parameters = [
				{ reference: "$components.parameters.missing" },
			];
			expect(() => validateArazzoSpec(unresolvedParamRef)).toThrow(
				/Unresolved reusable parameter reference/,
			);

			const emptyParamName = createValidSpec();
			emptyParamName.workflows[0].parameters = [{ name: "", value: 1 }];
			expect(() => validateArazzoSpec(emptyParamName)).toThrow(
				/Parameter Object MUST have a non-empty 'name'/,
			);

			const badParamIn = createValidSpec();
			(badParamIn.workflows[0].parameters as unknown as Array<{
				name: string;
				in: string;
				value: number;
			}>) = [{ name: "p", in: "body", value: 1 }];
			expect(() => validateArazzoSpec(badParamIn)).toThrow(
				/Invalid parameter 'in' location/,
			);

			const missingParamVal = createValidSpec();
			(missingParamVal.workflows[0].parameters as unknown as Array<{
				name: string;
				value?: unknown;
			}>) = [{ name: "p", value: undefined }];
			expect(() => validateArazzoSpec(missingParamVal)).toThrow(
				/MUST define a 'value'/,
			);

			const emptyCriterion = createValidSpec();
			emptyCriterion.workflows[0].steps[0].successCriteria = [
				{ condition: "" },
			];
			expect(() => validateArazzoSpec(emptyCriterion)).toThrow(
				/non-empty string 'condition'/,
			);

			const badCritTypeStr = createValidSpec();
			(badCritTypeStr.workflows[0].steps[0]
				.successCriteria as unknown as Array<{
				condition: string;
				type: string;
			}>) = [{ condition: "$statusCode == 200", type: "unknown" }];
			expect(() => validateArazzoSpec(badCritTypeStr)).toThrow(
				/Invalid Criterion type/,
			);

			const badCritTypeObj = createValidSpec();
			(badCritTypeObj.workflows[0].steps[0]
				.successCriteria as unknown as Array<{
				condition: string;
				type: object;
			}>) = [{ condition: "$statusCode == 200", type: { type: "bad" } }];
			expect(() => validateArazzoSpec(badCritTypeObj)).toThrow(
				/Invalid Criterion ExpressionTypeObject/,
			);

			const badSuccessRef = createValidSpec();
			badSuccessRef.workflows[0].successActions = [
				{ reference: "$components.wrong.act" },
			];
			expect(() => validateArazzoSpec(badSuccessRef)).toThrow(
				/Invalid successAction reference/,
			);

			const missingSuccessRef = createValidSpec();
			missingSuccessRef.workflows[0].successActions = [
				{ reference: "$components.successActions.missing" },
			];
			expect(() => validateArazzoSpec(missingSuccessRef)).toThrow(
				/Unresolved reusable successAction/,
			);

			const emptySuccessName = createValidSpec();
			emptySuccessName.workflows[0].steps[0].onSuccess = [
				{ name: "", type: "end" },
			];
			expect(() => validateArazzoSpec(emptySuccessName)).toThrow(
				/Success Action MUST have a non-empty 'name'/,
			);

			const badSuccessType = createValidSpec();
			(badSuccessType.workflows[0].steps[0].onSuccess as unknown as Array<{
				name: string;
				type: string;
			}>) = [{ name: "a", type: "retry" }];
			expect(() => validateArazzoSpec(badSuccessType)).toThrow(
				/Invalid Success Action type/,
			);

			const badSuccessGoto = createValidSpec();
			badSuccessGoto.workflows[0].steps[0].onSuccess = [
				{ name: "a", type: "goto" },
			];
			expect(() => validateArazzoSpec(badSuccessGoto)).toThrow(
				/exactly one of 'stepId' or 'workflowId'/,
			);

			const unknownSuccessStep = createValidSpec();
			unknownSuccessStep.workflows[0].steps[0].onSuccess = [
				{ name: "a", type: "goto", stepId: "noSuchStep" },
			];
			expect(() => validateArazzoSpec(unknownSuccessStep)).toThrow(
				/references unknown stepId/,
			);

			const dupSuccessName = createValidSpec();
			dupSuccessName.workflows[0].steps[0].onSuccess = [
				{ name: "dup", type: "end" },
				{ name: "dup", type: "end" },
			];
			expect(() => validateArazzoSpec(dupSuccessName)).toThrow(
				/Duplicate onSuccess action name/,
			);

			const badFailureRef = createValidSpec();
			badFailureRef.workflows[0].failureActions = [
				{ reference: "$components.wrong.act" },
			];
			expect(() => validateArazzoSpec(badFailureRef)).toThrow(
				/Invalid failureAction reference/,
			);

			const missingFailureRef = createValidSpec();
			missingFailureRef.workflows[0].failureActions = [
				{ reference: "$components.failureActions.missing" },
			];
			expect(() => validateArazzoSpec(missingFailureRef)).toThrow(
				/Unresolved reusable failureAction/,
			);

			const emptyFailureName = createValidSpec();
			emptyFailureName.workflows[0].steps[0].onFailure = [
				{ name: "", type: "end" },
			];
			expect(() => validateArazzoSpec(emptyFailureName)).toThrow(
				/Failure Action MUST have a non-empty 'name'/,
			);

			const badFailureType = createValidSpec();
			(badFailureType.workflows[0].steps[0].onFailure as unknown as Array<{
				name: string;
				type: string;
			}>) = [{ name: "f", type: "abort" }];
			expect(() => validateArazzoSpec(badFailureType)).toThrow(
				/Invalid Failure Action type/,
			);

			const badFailureGoto = createValidSpec();
			badFailureGoto.workflows[0].steps[0].onFailure = [
				{ name: "f", type: "goto" },
			];
			expect(() => validateArazzoSpec(badFailureGoto)).toThrow(
				/exactly one of 'stepId' or 'workflowId'/,
			);

			const unknownFailureStep = createValidSpec();
			unknownFailureStep.workflows[0].steps[0].onFailure = [
				{ name: "f", type: "goto", stepId: "missingStep" },
			];
			expect(() => validateArazzoSpec(unknownFailureStep)).toThrow(
				/references unknown stepId/,
			);

			const negRetryAfter = createValidSpec();
			negRetryAfter.workflows[0].steps[0].onFailure = [
				{ name: "f", type: "retry", retryAfter: -1 },
			];
			expect(() => validateArazzoSpec(negRetryAfter)).toThrow(
				/retryAfter.*non-negative/,
			);

			const negRetryLimit = createValidSpec();
			negRetryLimit.workflows[0].steps[0].onFailure = [
				{ name: "f", type: "retry", retryLimit: -2 },
			];
			expect(() => validateArazzoSpec(negRetryLimit)).toThrow(
				/retryLimit.*non-negative/,
			);

			const dupFailureName = createValidSpec();
			dupFailureName.workflows[0].steps[0].onFailure = [
				{ name: "dupF", type: "end" },
				{ name: "dupF", type: "end" },
			];
			expect(() => validateArazzoSpec(dupFailureName)).toThrow(
				/Duplicate onFailure action name/,
			);

			const emptyOutExpr = createValidSpec();
			emptyOutExpr.workflows[0].steps[0].outputs = { bad: "  " };
			expect(() => validateArazzoSpec(emptyOutExpr)).toThrow(
				/output 'bad' expression MUST NOT be empty/,
			);

			const invalidOutObj = createValidSpec();
			(invalidOutObj.workflows[0].steps[0].outputs as unknown as Record<
				string,
				unknown
			>) = { bad: { notSelector: true } };
			expect(() => validateArazzoSpec(invalidOutObj)).toThrow(
				/MUST be a runtime expression string or SelectorObject/,
			);

			const cyclicSteps = createValidSpec();
			cyclicSteps.workflows[0].steps[0].dependsOn = ["fetchPet"];
			expect(() => validateArazzoSpec(cyclicSteps)).toThrow(
				/Cyclic step dependency/,
			);

			const cyclicWfs = createValidSpec();
			cyclicWfs.workflows[0].dependsOn = ["fallbackWorkflow"];
			expect(() => validateArazzoSpec(cyclicWfs)).toThrow(
				/Cyclic workflow dependency/,
			);
		});
	});

	describe("ArazzoLoader & ArazzoParser", () => {
		it("loads Arazzo + OpenAPI + AsyncAPI + nested Arazzo from disk and builds ArazzoIr", async () => {
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-arazzo-test-"));
			try {
				const openApiPath = path.join(tmpDir, "petstore.openapi.json");
				fs.writeFileSync(openApiPath, JSON.stringify(sampleOpenApi), "utf-8");

				const asyncApiPath = path.join(tmpDir, "events.asyncapi.yaml");
				fs.writeFileSync(
					asyncApiPath,
					`asyncapi: 2.6.0
info:
  title: Events
  version: 1.0.0
channels:
  /pet/adopted:
    address: pet.adopted
    description: Adopted channel
`,
					"utf-8",
				);

				const extArazzo: ArazzoSpec = {
					arazzo: "1.1.0",
					info: { title: "External", version: "1.0.0" },
					sourceDescriptions: [
						{ name: "petstore", url: "./petstore.openapi.json" },
					],
					workflows: [
						{
							workflowId: "auditAdopt",
							steps: [{ stepId: "s1", operationId: "addPet" }],
						},
					],
				};
				const extArazzoPath = path.join(tmpDir, "external.arazzo.yaml");
				fs.writeFileSync(extArazzoPath, JSON.stringify(extArazzo), "utf-8");

				const mainSpec = createValidSpec();
				delete mainSpec.$self;
				const mainPath = path.join(tmpDir, "main.arazzo.json");
				fs.writeFileSync(mainPath, JSON.stringify(mainSpec), "utf-8");
				expect(ArazzoLoader.readContentSync(mainPath)).toContain(
					"Petstore Orchestration",
				);

				const parser = await ArazzoParser.create(mainPath, mockConfig, {
					petstore: sampleOpenApi,
				});
				expect(parser.getSpec().info.title).toBe("Petstore Orchestration");
				expect(parser.openApiSources.has("petstore")).toBe(true);
				expect(parser.asyncApiSources.has("events")).toBe(true);
				expect(parser.arazzoSources.has("externalFlows")).toBe(true);
				expect(parser.inputSchemas.length).toBeGreaterThanOrEqual(2);

				const adoptWfIr = parser.ir.workflowsById.get("adoptPet");
				expect(adoptWfIr).toBeDefined();
				expect(adoptWfIr?.inputTypeName).toBe("AdoptPetInputs");
				expect(adoptWfIr?.outputTypeName).toBe("AdoptPetOutputs");
				expect(adoptWfIr?.resolvedSteps[0]?.serviceClassName).toBe(
					"PetService",
				);
				expect(adoptWfIr?.resolvedSteps[0]?.serviceMethodName).toBe("addPet");
				expect(adoptWfIr?.resolvedSteps[1]?.targetKind).toBe("operationPath");
				expect(adoptWfIr?.resolvedSteps[1]?.serviceMethodName).toBe(
					"getPetById",
				);
				expect(adoptWfIr?.resolvedSteps[2]?.targetKind).toBe("channelPath");
				expect(adoptWfIr?.resolvedSteps[2]?.serviceMethodName).toBe("send");
				expect(adoptWfIr?.resolvedSteps[3]?.serviceMethodName).toBe("receive");
				expect(adoptWfIr?.resolvedSteps[4]?.targetKind).toBe("workflowId");
				expect(adoptWfIr?.resolvedSteps[5]?.targetWorkflowId).toBe(
					"auditAdopt",
				);
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		});

		it("handles in-memory specs, boolean inputs, unindexed operationPaths, and cycle detection", () => {
			const errDefaultPath = new ArazzoValidationError("default path test");
			expect(errDefaultPath.path).toBe("#");

			const spec: ArazzoSpec = createValidSpec();
			delete spec.$self;
			delete spec.components;
			spec.sourceDescriptions = [
				{ name: "petstore", url: "./petstore.openapi.json" },
			];
			spec.workflows = [
				{
					workflowId: "minimalFlow",
					steps: [
						{
							stepId: "s1",
							operationId: "unknownOp",
							parameters: [{ name: "wfParam", value: "v" }],
						},
						{
							stepId: "s2",
							operationPath: "#",
						},
						{
							stepId: "s3",
							channelPath: "/ch",
						},
						{
							stepId: "s4",
							workflowId: "$sourceDescriptions.ext.shortWf",
						},
					],
				},
			];

			const minimalParser = new ArazzoParser(spec, mockConfig);
			expect(minimalParser.inputSchemas).toEqual([]);

			const specWithDupInput = createValidSpec();
			specWithDupInput.components = {
				...specWithDupInput.components,
				inputs: {
					...specWithDupInput.components?.inputs,
					AdoptPetInputs: { type: "object" },
				},
			};
			specWithDupInput.workflows[0].inputs = {
				$ref: "#/components/inputs/MissingInput",
			};
			const dupParser = new ArazzoParser(specWithDupInput, mockConfig);
			expect(dupParser.inputSchemas.length).toBeGreaterThan(0);

			expect(
				ArazzoLoader.extractAsyncApiChannels({
					channels: {
						ch1: { description: "d" },
						chNoDesc: { address: "ch.no.desc" },
						ch2: "invalid",
					},
				}),
			).toBeDefined();
			expect(ArazzoLoader.extractAsyncApiChannels({})).toBeDefined();
			expect(
				minimalParser.resolveInputSchemaRef({ $ref: "#/other/Ref" }),
			).toEqual({ $ref: "#/other/Ref" });

			const untypedBundle = ArazzoLoader.loadSync(
				{
					arazzo: "1.1.0",
					info: { title: "T", version: "1" },
					sourceDescriptions: [
						{ name: "s1", url: "https://example.com/a.json" },
						{ name: "s2", url: "https://example.com/b.json" },
						{ name: "s3", url: "https://example.com/c.json" },
					],
					workflows: [
						{
							workflowId: "w",
							steps: [
								{ stepId: "st", operationId: "unmatchedOp" },
								{ stepId: "st2", operationPath: "/paths/~1pet/post" },
							],
						},
					],
				},
				mockConfig,
				{
					s1: sampleOpenApi,
					s2: {
						arazzo: "1.1.0",
						info: { title: "Sub", version: "1" },
						sourceDescriptions: [{ name: "p", url: "./p.json" }],
						workflows: [
							{
								workflowId: "sw",
								steps: [{ stepId: "st", operationId: "op" }],
							},
						],
					},
					s3: { asyncapi: "2.6.0", channels: {} },
				},
			);
			const untypedParser = new ArazzoParser(untypedBundle, mockConfig);
			expect(untypedParser.openApiSources.has("s1")).toBe(true);
			expect(untypedBundle.arazzoSources.has("s2")).toBe(true);
			expect(untypedBundle.asyncApiSources.has("s3")).toBe(true);

			expect(minimalParser.resolveInputSchemaRef(true)).toBe(true);
			expect(minimalParser.resolveInputSchemaRef({ type: "string" })).toEqual({
				type: "string",
			});

			expect(() =>
				ArazzoLoader.parseSpecContent(`- item1\n- item2`, "bad.yaml"),
			).toThrow(/Invalid specification document/);
			expect(
				ArazzoLoader.resolveUri("relative.json", ":::invalid-base"),
			).toContain("relative.json");

			const selfUri = "https://example.com/workflows/petstore.arazzo.yaml";
			const cycleSpec = createValidSpec();
			expect(() =>
				ArazzoLoader.loadSync(
					cycleSpec,
					mockConfig,
					{ externalFlows: cycleSpec },
					new Set([
						"https://example.com/workflows/external.arazzo.yaml",
						selfUri,
					]),
				),
			).toThrow(/Cyclic Arazzo sourceDescription/);
		});
	});
});
