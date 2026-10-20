import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
	extractArazzoFromTypeScript,
	writeFormattedArazzoSpec,
} from "../../src/arazzo/emit_arazzo.js";
import { executeArazzoWorkflowRuntime } from "../../src/arazzo/emit_sdk.js";
import {
	parseArazzoCliAst,
	parseArazzoCliSourceFile,
} from "../../src/arazzo/parse_cli_ast.js";
import {
	parseArazzoSdkAst,
	parseArazzoSdkSourceFile,
} from "../../src/arazzo/parse_sdk_ast.js";
import {
	parseArazzoServerAst,
	parseArazzoServerE2eSourceFile,
} from "../../src/arazzo/parse_server_ast.js";
import {
	readArazzoSnapshot,
	writeArazzoSnapshot,
} from "../../src/arazzo/parse_snapshot.js";
import { generateFromArazzoSync } from "../../src/cli/commands/from_arazzo.js";
import { generateToArazzo } from "../../src/cli/commands/to_arazzo.js";
import { run, syncDir } from "../../src/cli.js";
import type { ArazzoSpec } from "../../src/core/types/index.js";
import { expectZeroTypeScriptDiagnostics } from "../shared/helpers.js";

const sampleSpec: ArazzoSpec = {
	arazzo: "1.1.0",
	$self: "https://example.com/arazzo.json",
	info: {
		title: "Petstore Workflows",
		summary: "Summary text",
		description: "Description text",
		version: "1.0.0",
	},
	sourceDescriptions: [
		{ name: "petstore", url: "./petstore.json", type: "openapi" },
	],
	components: {
		inputs: {
			CreatePetInput: {
				type: "object",
				description: "Input for creating a pet",
				properties: {
					petName: { type: "string", description: "Pet name" },
					age: { type: "integer" },
				},
				required: ["petName"],
			},
			FlagInput: true,
			FalseInput: false,
			PrimitiveInput: { type: "string" },
		},
		parameters: {
			sharedHeader: {
				name: "X-Shared",
				in: "header",
				value: "shared-val",
			},
		},
		successActions: {
			endAction: { name: "endAction", type: "end" },
		},
		failureActions: {
			retryAction: {
				name: "retryAction",
				type: "retry",
				retryLimit: 2,
				retryAfter: 0,
			},
		},
	},
	workflows: [
		{
			workflowId: "AdoptPetFlow",
			summary: "Adopt a pet workflow",
			description: "Detailed adopt flow",
			dependsOn: ["InitFlow", "$sourceDescriptions.ext.workflows.remoteInit"],
			inputs: {
				$ref: "#/components/inputs/CreatePetInput",
			},
			parameters: [
				{ reference: "$components.parameters.sharedHeader" },
				{ name: "qParam", in: "query", value: "$inputs.petName" },
			],
			steps: [
				{
					stepId: "createPet",
					description: "Create a pet",
					operationId: "addPet",
					timeout: 1000,
					parameters: [{ name: "petId", in: "path", value: "10" }],
					requestBody: {
						contentType: "application/json",
						payload: { name: "placeholder" },
						replacements: [{ target: "/name", value: "$inputs.petName" }],
					},
					successCriteria: [{ condition: "$statusCode == 200" }],
					outputs: {
						petId: "$response.body#/id",
						selId: {
							context: "$response.body",
							selector: "$.id",
							type: "jsonpath",
						},
					},
				},
				{
					stepId: "notifyAsync",
					dependsOn: ["createPet"],
					channelPath: "/pets/created",
					action: "send",
					correlationId: "$steps.createPet.outputs.petId",
				},
				{
					stepId: "callSubWf",
					dependsOn: ["notifyAsync"],
					workflowId: "InitFlow",
				},
				{
					stepId: "callExtWf",
					dependsOn: ["callSubWf"],
					workflowId: "$sourceDescriptions.ext.workflows.remoteAudit",
				},
			],
			outputs: {
				finalPetId: "$steps.createPet.outputs.petId",
				structuredOut: {
					context: "$steps.createPet.outputs",
					selector: "$.petId",
				},
			},
		},
		{
			workflowId: "InitFlow",
			steps: [
				{
					stepId: "ping",
					operationPath: "{$sourceDescriptions.petstore.url}#/paths/~1ping/get",
				},
			],
		},
	],
};

describe("Arazzo 1.1.0 Forward & Reverse Round-Trip Suite", () => {
	describe("executeArazzoWorkflowRuntime", () => {
		it("executes workflows with dependencies, operations, channels, sub-workflows, and hooks", async () => {
			const events: string[] = [];
			const out = await executeArazzoWorkflowRuntime(
				sampleSpec,
				"AdoptPetFlow",
				{ petName: "Buddy" },
				{
					executeOperation: async (params) => ({
						statusCode: 200,
						headers: {},
						body: { id: "pet-77", received: params.requestBody },
						url: "https://api.example.com/pet",
						method: "POST",
					}),
					executeChannel: async (params) => ({
						headers: { "x-corr": params.correlationId },
						payload: { ack: true },
					}),
					executeExternalWorkflow: async (params) => ({
						extWf: params.workflowId,
					}),
				},
				{
					onStepStart: (wfId, step) =>
						events.push(`start:${wfId}:${step.stepId}`),
					onStepSuccess: (wfId, step) =>
						events.push(`ok:${wfId}:${step.stepId}`),
				},
			);

			expect(out.finalPetId).toBe("pet-77");
			expect(events).toContain("start:InitFlow:ping");
			expect(events).toContain("ok:AdoptPetFlow:createPet");

			// Also test default fallback adapters when adapter is empty
			const defaultOut = await executeArazzoWorkflowRuntime(
				sampleSpec,
				"AdoptPetFlow",
				{ petName: "Max" },
				{},
				undefined,
				{ InitFlow: { outputs: { preDone: true } } },
			);
			expect(defaultOut).toBeDefined();

			// Also test workflow-level successActions & failureActions & cookie/workflow params
			const wfLevelSpec: ArazzoSpec = {
				arazzo: "1.1.0",
				info: { title: "WfLevel", version: "1.0.0" },
				sourceDescriptions: [{ name: "api", url: "./api.json" }],
				workflows: [
					{
						workflowId: "wfWithActions",
						parameters: [
							{ name: "cookieParam", in: "cookie", value: "c1" },
							{ name: "nullParam", in: "header", value: null },
							{ name: "wfOnlyParam", value: "w1" },
						],
						successActions: [{ name: "wfEnd", type: "end" }],
						failureActions: [{ name: "wfRetryDefaultLimit", type: "retry" }],
						steps: [
							{
								stepId: "s1",
								channelPath: "/ch",
							},
						],
					},
				],
			};
			let chanCalls = 0;
			const wfLevelOut = await executeArazzoWorkflowRuntime(
				wfLevelSpec,
				"wfWithActions",
				{},
				{
					executeChannel: async () => {
						chanCalls++;
						if (chanCalls === 1) throw new Error("first chan fail");
						return { headers: {}, payload: {} };
					},
				},
			);
			expect(wfLevelOut).toEqual({});

			await expect(
				executeArazzoWorkflowRuntime(sampleSpec, "NonExistent"),
			).rejects.toThrow(/not found/);
		});

		it("handles onSuccess goto step/workflow/end and onFailure retry/goto/end", async () => {
			let attempts = 0;
			const retryIds: number[] = [];
			const failedSteps: string[] = [];

			const branchingSpec: ArazzoSpec = {
				arazzo: "1.1.0",
				info: { title: "Branching", version: "1.0.0" },
				sourceDescriptions: [{ name: "api", url: "./api.json" }],
				workflows: [
					{
						workflowId: "retryAndGotoStep",
						steps: [
							{
								stepId: "flakyStep",
								operationId: "op1",
								successCriteria: [{ condition: "$statusCode == 200" }],
								onFailure: [
									{
										name: "retryStep",
										type: "retry",
										retryLimit: 2,
										retryAfter: 0,
									},
								],
								onSuccess: [
									{
										name: "skipMiddle",
										type: "goto",
										stepId: "finalStep",
									},
								],
							},
							{
								stepId: "skippedStep",
								operationId: "opSkip",
							},
							{
								stepId: "finalStep",
								operationId: "opFinal",
								onSuccess: [{ name: "endEarly", type: "end" }],
							},
						],
						outputs: { done: "yes" },
					},
					{
						workflowId: "gotoWorkflowOnSuccess",
						steps: [
							{
								stepId: "s1",
								operationId: "op1",
								onSuccess: [
									{
										name: "jumpWf",
										type: "goto",
										workflowId: "targetWf",
									},
								],
							},
						],
					},
					{
						workflowId: "gotoStepAndWfOnFailure",
						steps: [
							{
								stepId: "failToStep",
								operationId: "failOp",
								onFailure: [
									{
										name: "recoverStep",
										type: "goto",
										stepId: "failToWf",
									},
								],
							},
							{
								stepId: "failToWf",
								operationId: "failOp2",
								onFailure: [
									{
										name: "recoverWf",
										type: "goto",
										workflowId: "targetWf",
									},
								],
							},
						],
					},
					{
						workflowId: "retrySpecificStep",
						steps: [
							{
								stepId: "s1",
								operationId: "op1",
								onFailure: [
									{
										name: "retryTarget",
										type: "retry",
										stepId: "s1",
										retryLimit: 1,
									},
								],
							},
						],
					},
					{
						workflowId: "targetWf",
						steps: [{ stepId: "t1", operationId: "tOp" }],
						outputs: { reachedTarget: "true" },
					},
				],
			};

			const res1 = await executeArazzoWorkflowRuntime(
				branchingSpec,
				"retryAndGotoStep",
				{},
				{
					executeOperation: async () => {
						attempts++;
						return {
							statusCode: attempts < 2 ? 503 : 200,
							headers: {},
							body: {},
						};
					},
				},
				{
					onStepFailure: (_wf, step) => failedSteps.push(step.stepId),
					onRetry: (_wf, _step, attempt) => retryIds.push(attempt),
				},
			);
			expect(res1.done).toBe("yes");
			expect(retryIds).toEqual([1]);
			expect(failedSteps).toContain("flakyStep");

			const res2 = await executeArazzoWorkflowRuntime(
				branchingSpec,
				"gotoWorkflowOnSuccess",
			);
			expect(res2.reachedTarget).toBe("true");

			const res3 = await executeArazzoWorkflowRuntime(
				branchingSpec,
				"gotoStepAndWfOnFailure",
				{},
				{
					executeOperation: async (p) => {
						if (p.operationId?.startsWith("failOp")) {
							throw new Error("boom");
						}
						return { statusCode: 200, headers: {}, body: {} };
					},
				},
			);
			expect(res3.reachedTarget).toBe("true");

			let s1Count = 0;
			await executeArazzoWorkflowRuntime(
				branchingSpec,
				"retrySpecificStep",
				{},
				{
					executeOperation: async () => {
						s1Count++;
						if (s1Count === 1) throw "string error";
						return { statusCode: 200, headers: {}, body: {} };
					},
				},
			);
			expect(s1Count).toBe(2);

			// Exhaust retry limit
			await expect(
				executeArazzoWorkflowRuntime(
					branchingSpec,
					"retrySpecificStep",
					{},
					{
						executeOperation: async () => {
							throw new Error("always fails");
						},
					},
				),
			).rejects.toThrow("always fails");

			await expect(
				executeArazzoWorkflowRuntime(
					branchingSpec,
					"retrySpecificStep",
					{},
					{
						executeOperation: async () => {
							throw "always fails string";
						},
					},
				),
			).rejects.toThrow("always fails string");

			// Unhandled failure action
			await expect(
				executeArazzoWorkflowRuntime(
					branchingSpec,
					"targetWf",
					{},
					{
						executeOperation: async () => {
							throw "unhandled string failure";
						},
					},
				),
			).rejects.toThrow("unhandled string failure");
		});
	});

	describe("SDK, CLI & Server Emitters and Reverse AST Parsers", () => {
		it("round-trips SDK, CLI, and Server artifacts both with and without snapshots", () => {
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-arazzo-rt-"));
			try {
				const specPath = path.join(tmpDir, "spec.arazzo.json");
				writeFormattedArazzoSpec(sampleSpec, specPath);
				const yamlSpecPath = path.join(tmpDir, "spec.arazzo.yaml");
				writeFormattedArazzoSpec(sampleSpec, yamlSpecPath);

				expect(
					readArazzoSnapshot(path.join(tmpDir, "nonexistent")),
				).toBeUndefined();

				// 1. SDK generation & round-trip
				const sdkDir = path.join(tmpDir, "sdk-out");
				generateFromArazzoSync(specPath, sdkDir, "sdk", true);
				expect(fs.existsSync(path.join(sdkDir, "workflows", "index.ts"))).toBe(
					true,
				);
				expect(
					fs.existsSync(path.join(sdkDir, "workflows", "workflows.spec.ts")),
				).toBe(true);

				const fromSnap = extractArazzoFromTypeScript(sdkDir, false);
				expect(fromSnap.info.title).toBe("Petstore Workflows");

				const fromSdkAst = extractArazzoFromTypeScript(sdkDir, true);
				expect(fromSdkAst.workflows.length).toBe(2);

				// Direct file AST parse
				const fromSdkFile = extractArazzoFromTypeScript(
					path.join(sdkDir, "workflows", "index.ts"),
					true,
				);
				expect(fromSdkFile.arazzo).toBe("1.1.0");

				// 2. CLI generation & round-trip
				const cliDir = path.join(tmpDir, "cli-out");
				generateFromArazzoSync(sampleSpec, cliDir, "cli", false);
				expect(fs.existsSync(path.join(cliDir, "cli.ts"))).toBe(true);

				const fromCliWithSdk = parseArazzoCliAst(cliDir);
				expect(fromCliWithSdk.info.title).toBe("Petstore Workflows");

				// Remove workflows/index.ts to test pure Commander CLI AST reverse parser
				fs.rmSync(path.join(cliDir, "workflows"), {
					recursive: true,
					force: true,
				});
				const fromPureCliDir = extractArazzoFromTypeScript(cliDir, true);
				expect(fromPureCliDir.workflows.length).toBe(2);
				const fromPureCliFile = extractArazzoFromTypeScript(
					path.join(cliDir, "cli.ts"),
					true,
				);
				expect(fromPureCliFile.workflows.length).toBe(2);

				// 3. Server & E2E generation & round-trip
				const srvDir = path.join(tmpDir, "server-out");
				generateFromArazzoSync(specPath, srvDir, "server", false);
				expect(
					fs.existsSync(path.join(srvDir, "workflows", "engine.routes.ts")),
				).toBe(true);
				expect(
					fs.existsSync(
						path.join(srvDir, "workflows", "workflows.e2e.spec.ts"),
					),
				).toBe(true);

				const fromSrvDir = parseArazzoServerAst(srvDir);
				expect(fromSrvDir.info.title).toBe("Petstore Workflows");

				// Remove workflows/index.ts to test pure E2E spec AST reverse parser
				fs.unlinkSync(path.join(srvDir, "workflows", "index.ts"));
				const fromPureE2eDir = extractArazzoFromTypeScript(srvDir, true);
				expect(fromPureE2eDir.workflows.length).toBe(2);
				const fromPureE2eFile = extractArazzoFromTypeScript(
					path.join(srvDir, "workflows", "workflows.e2e.spec.ts"),
					true,
				);
				expect(fromPureE2eFile.workflows.length).toBe(2);

				const emptyDir = path.join(tmpDir, "empty-dir");
				fs.mkdirSync(emptyDir);
				expect(() => extractArazzoFromTypeScript(emptyDir, true)).toThrow(
					/Could not locate Arazzo TypeScript artifacts/,
				);

				// Snapshot direct file read
				writeArazzoSnapshot(sampleSpec, emptyDir);
				expect(
					readArazzoSnapshot(path.join(emptyDir, "arazzo.snapshot.yaml"))
						?.arazzo,
				).toBe("1.1.0");
				fs.unlinkSync(path.join(emptyDir, "arazzo.snapshot.json"));
				expect(readArazzoSnapshot(emptyDir)?.arazzo).toBe("1.1.0");
				fs.unlinkSync(path.join(emptyDir, "arazzo.snapshot.yaml"));
				expect(readArazzoSnapshot(emptyDir)).toBeUndefined();

				// Also test extractArazzoFromTypeScript with ignoreSnapshot=false when no snapshot exists
				const bareDir = path.join(tmpDir, "bare-sdk");
				fs.mkdirSync(bareDir);
				fs.copyFileSync(
					path.join(sdkDir, "workflows", "index.ts"),
					path.join(bareDir, "index.ts"),
				);
				expect(extractArazzoFromTypeScript(bareDir).arazzo).toBe("1.1.0");
				expect(parseArazzoSdkAst(bareDir).arazzo).toBe("1.1.0");
				expect(
					readArazzoSnapshot(path.join(bareDir, "index.ts")),
				).toBeUndefined();

				// Also test parseArazzoCliAst on directory without workflows/index.ts
				expect(parseArazzoCliAst(cliDir).workflows.length).toBe(2);

				// Also test parseArazzoServerAst on directory without workflows/index.ts
				expect(parseArazzoServerAst(srvDir).workflows.length).toBe(2);

				// Also test generating CLI and SDK from minimal spec (no description, no $self, no components, no inputs, no outputs)
				const minSpec: ArazzoSpec = {
					arazzo: "1.1.0",
					info: { title: "MinTitle", version: "1.0.0" },
					sourceDescriptions: [{ name: "api", url: "./api.json" }],
					workflows: [
						{
							workflowId: "minWf",
							steps: [{ stepId: "s1", operationId: "op1" }],
						},
						{
							workflowId: "wfObjInputNoReq",
							inputs: {
								type: "object",
								properties: { optField: { type: "string" } },
							},
							steps: [{ stepId: "s2", operationId: "op2" }],
						},
						{
							workflowId: "wfBoolInput",
							inputs: true,
							steps: [{ stepId: "s3", operationId: "op3" }],
						},
					],
				};
				const minCliDir = path.join(tmpDir, "min-cli");
				generateFromArazzoSync(minSpec, minCliDir, "cli", false);
				expect(fs.existsSync(path.join(minCliDir, "cli.ts"))).toBe(true);

				const noInputSpec: ArazzoSpec = {
					arazzo: "1.1.0",
					info: { title: "NoInputs", version: "1.0.0" },
					sourceDescriptions: [{ name: "api", url: "./api.json" }],
					workflows: [
						{
							workflowId: "noInWf",
							steps: [{ stepId: "s1", operationId: "op1" }],
						},
					],
				};
				const noInDir = path.join(tmpDir, "no-in-sdk");
				generateFromArazzoSync(noInputSpec, noInDir, "sdk", false);
				expect(fs.existsSync(path.join(noInDir, "workflows", "index.ts"))).toBe(
					true,
				);
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		});

		it("handles handcrafted SDK, CLI, and E2E ASTs without ARAZZO_SPEC_METADATA", () => {
			const project = new Project({ useInMemoryFileSystem: true });

			const handcraftedSdk = project.createSourceFile(
				"handcrafted-sdk.ts",
				`
				export class CustomOrchestrator {
					static readonly arazzo = "1.1.0";
					static readonly $self = "https://example.com/self.json";
					static readonly info = { title: "Handcrafted", version: "2.0.0" };
					static readonly sourceDescriptions = [{ name: "main", url: "./openapi.json", type: "openapi" }];
					static readonly components = { parameters: {} };
					async createUser(inputs: CreateUserInput) {
						return inputs;
					}
					async simpleStep() {
						const workflowDefinition = {
							workflowId: "simpleStep",
							steps: [{ stepId: "s1", operationId: "op1" }]
						};
						return workflowDefinition;
					}
				}
				`,
			);
			const parsedSdk = parseArazzoSdkSourceFile(
				handcraftedSdk,
				"export interface CreateUserInput { username: string; }",
			);
			expect(parsedSdk.info.title).toBe("Handcrafted");
			expect(parsedSdk.workflows.length).toBe(2);

			const minimalHandcraftedSdk = project.createSourceFile(
				"min-sdk.ts",
				`
				export class MinOrchestrator {
					async ping() {}
				}
				`,
			);
			expect(parseArazzoSdkSourceFile(minimalHandcraftedSdk).arazzo).toBe(
				"1.1.0",
			);

			const emptyFile = project.createSourceFile("empty.ts", "const x = 1;");
			expect(() => parseArazzoSdkSourceFile(emptyFile)).toThrow(
				/No WorkflowOrchestrator class/,
			);
			expect(() => parseArazzoServerE2eSourceFile(emptyFile)).toThrow(
				/No Arazzo E2E workflow blocks/,
			);

			const minimalCli = project.createSourceFile(
				"min-cli.ts",
				`
				import { Command } from 'commander';
				const program = new Command();
				program.name('my-cli');
				const workflowCmd = program.command('workflow');
				workflowCmd.command('bareWf');
				const wf2 = workflowCmd.command('wf2');
				wf2.description('wf2 summary');
				wf2.option('plainFlag');
				otherCmd.description('ignored');
				otherCmd.option('--ignored');
				program.option('--other');
				foo();
				`,
			);
			expect(parseArazzoCliSourceFile(minimalCli).workflows.length).toBe(2);

			const emptyCli = project.createSourceFile("empty-cli.ts", "const a = 1;");
			expect(parseArazzoCliSourceFile(emptyCli).workflows.length).toBe(1);

			const otherE2e = project.createSourceFile(
				"other.e2e.spec.ts",
				`
				describe("unrelated suite", () => {});
				describe("workflow: myFlow", () => {
					it("step s1: test", () => {
						const stepMeta = { stepId: "s1", operationId: "op1" };
					});
				});
				`,
			);
			expect(parseArazzoServerE2eSourceFile(otherE2e).workflows.length).toBe(1);
			expectZeroTypeScriptDiagnostics(project);
		});
	});

	describe("CLI Commands (from_arazzo, to_arazzo, serve_json_rpc, sync)", () => {
		it("runs from_arazzo, to_arazzo, sync --truth arazzo, and JSON-RPC Arazzo methods", async () => {
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-arazzo-cli-"));
			try {
				const specFile = path.join(tmpDir, "input.arazzo.json");
				writeFormattedArazzoSpec(sampleSpec, specFile, "json");

				const sdkOut = path.join(tmpDir, "cli-sdk-out");
				await run([
					"node",
					"cli.js",
					"from_arazzo",
					"to_sdk",
					"-i",
					specFile,
					"-o",
					sdkOut,
				]);
				expect(fs.existsSync(path.join(sdkOut, "workflows", "index.ts"))).toBe(
					true,
				);

				await expect(
					run(["node", "cli.js", "from_arazzo", "to_sdk"]),
				).rejects.toThrow(/Please specify an input Arazzo specification/);

				const extractedYaml = path.join(tmpDir, "extracted.arazzo.yaml");
				await run([
					"node",
					"cli.js",
					"to_arazzo",
					"-i",
					sdkOut,
					"-o",
					extractedYaml,
					"-f",
					"yaml",
					"--ignore-snapshot",
				]);
				expect(fs.existsSync(extractedYaml)).toBe(true);

				const syncedJson = path.join(tmpDir, "synced.arazzo.json");
				await syncDir({
					input: sdkOut,
					truth: "arazzo",
					output: syncedJson,
				});
				expect(fs.existsSync(syncedJson)).toBe(true);

				const toArazzoRes = generateToArazzo({
					input: sdkOut,
					output: path.join(tmpDir, "direct.json"),
				});
				expect(toArazzoRes.arazzo).toBe("1.1.0");
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		});
	});
});
