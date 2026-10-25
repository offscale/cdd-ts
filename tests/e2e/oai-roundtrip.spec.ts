import * as fs from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { generateFromOpenApi } from "@src/cli/commands/from_openapi.js";
import { generateToOpenApi } from "@src/cli/commands/to_openapi.js";
import type { GeneratorConfig, SwaggerSpec } from "@src/core/types/index.js";
import { generateFromConfigSync } from "@src/index.js";
import { parseGeneratedServices } from "@src/openapi/emitters/assemble_paths.js";
import yaml from "js-yaml";
import { Project } from "ts-morph";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OAI_V30_PASS_FIXTURES } from "../fixtures/oai-v3.0-pass.fixture.js";

const OAI_FIXTURES = [
	"api-with-examples.yaml",
	"callback-example.yaml",
	"link-example.yaml",
	"petstore-expanded.yaml",
	"petstore.yaml",
	"uspto.yaml",
] as const;

describe("E2E: OAI v3.0 Roundtrip & Live Parameter Serialization", () => {
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-oai-roundtrip-"));

	function resolveFixturePath(fileName: string): string {
		const fixtureFile = path.join(tmpRoot, fileName);
		if (!fs.existsSync(fixtureFile)) {
			fs.writeFileSync(
				fixtureFile,
				OAI_V30_PASS_FIXTURES[fileName] as string,
				"utf-8",
			);
		}
		return fixtureFile;
	}

	afterAll(() => {
		fs.rmSync(tmpRoot, { recursive: true, force: true });
	});

	for (const framework of ["vanilla", "angular"] as const) {
		describe(`Bidirectional Roundtrip (${framework})`, () => {
			for (const fixtureName of OAI_FIXTURES) {
				it(`roundtrips ${fixtureName} via from_openapi to_sdk -> to_openapi (snapshot & service/client AST)`, async () => {
					const fixturePath = resolveFixturePath(fixtureName);
					const originalSpec = yaml.load(
						fs.readFileSync(fixturePath, "utf-8"),
					) as SwaggerSpec;
					const outDir = path.join(
						tmpRoot,
						`${framework}-${fixtureName.replace(".yaml", "")}`,
					);
					const outSnapJson = path.join(outDir, "roundtrip-snap.json");
					const outNoSnapJson = path.join(outDir, "roundtrip-nosnap.json");

					await generateFromOpenApi(
						{
							input: fixturePath,
							output: outDir,
							framework,
							installablePackage: true,
							githubActions: false,
						},
						"to_sdk",
					);

					const expectedSuffix =
						framework === "vanilla" ? ".client.ts" : ".service.ts";
					const helperServiceFiles = new Set([
						"callback.service.ts",
						"link.service.ts",
						"response-header-parser.service.ts",
					]);
					const servicesDir = path.join(outDir, "src", "services");
					const generatedFiles = fs
						.readdirSync(servicesDir)
						.filter(
							(f) => f.endsWith(expectedSuffix) && !helperServiceFiles.has(f),
						);
					expect(generatedFiles.length).toBeGreaterThan(0);

					// 1. Roundtrip with snapshot present in <outDir>/src/openapi.snapshot.json
					await generateToOpenApi({
						input: outDir,
						output: outSnapJson,
						format: "yaml",
					});
					const snapRoundtripped = JSON.parse(
						fs.readFileSync(outSnapJson, "utf-8"),
					) as SwaggerSpec;
					expect(snapRoundtripped.info.title).toBe(originalSpec.info.title);
					expect(Object.keys(snapRoundtripped.paths ?? {}).sort()).toEqual(
						Object.keys(originalSpec.paths ?? {}).sort(),
					);

					// 2. Direct single-file parseGeneratedServices check
					const firstServiceFile = path.join(
						servicesDir,
						generatedFiles[0] as string,
					);
					const singleFileServices = parseGeneratedServices(
						firstServiceFile,
						fs,
					);
					expect(singleFileServices.length).toBeGreaterThan(0);

					// 3. Roundtrip without snapshot (exercises parseGeneratedServices on *.client.ts / *.service.ts)
					fs.rmSync(path.join(outDir, "src", "openapi.snapshot.json"), {
						force: true,
					});
					await generateToOpenApi({
						input: outDir,
						output: outNoSnapJson,
						format: "yaml",
					});
					const noSnapRoundtripped = JSON.parse(
						fs.readFileSync(outNoSnapJson, "utf-8"),
					) as SwaggerSpec;
					expect(noSnapRoundtripped.info.title).toBe(originalSpec.info.title);
					expect(Object.keys(noSnapRoundtripped.paths ?? {}).sort()).toEqual(
						Object.keys(originalSpec.paths ?? {}).sort(),
					);
				}, 30000);
			}
		});
	}

	describe("Live OpenAPI 3.0 & 3.2 Request Parameter Serialization", () => {
		let server: http.Server;
		let baseUrl = "";
		const recordedRequests: Array<{
			method: string;
			pathname: string;
			query: Record<string, string | string[]>;
			headers: http.IncomingHttpHeaders;
			body: string;
		}> = [];

		beforeAll(async () => {
			server = http.createServer((req, res) => {
				const chunks: Buffer[] = [];
				req.on("data", (chunk: Buffer) => chunks.push(chunk));
				req.on("end", () => {
					const rawBody = Buffer.concat(chunks).toString("utf-8");
					const parsedUrl = new URL(req.url ?? "/", "http://127.0.0.1");
					const query: Record<string, string | string[]> = {};
					parsedUrl.searchParams.forEach((value, key) => {
						const existing = query[key];
						if (existing === undefined) {
							query[key] = value;
						} else if (Array.isArray(existing)) {
							existing.push(value);
						} else {
							query[key] = [existing, value];
						}
					});
					recordedRequests.push({
						method: req.method ?? "GET",
						pathname: parsedUrl.pathname,
						query,
						headers: req.headers,
						body: rawBody,
					});
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							ok: true,
							subscriptionId: "sub-123",
						}),
					);
				});
			});
			await new Promise<void>((resolve) => {
				server.listen(0, "127.0.0.1", () => resolve());
			});
			const addr = server.address() as AddressInfo;
			baseUrl = `http://127.0.0.1:${addr.port}`;
		});

		afterAll(async () => {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		});

		it("serializes path, query, header, json body, and form-urlencoded body cleanly in generated Vanilla (Fetch) clients for OpenAPI 3.0 and 3.2", async () => {
			const spec: SwaggerSpec = {
				openapi: "3.2.0",
				info: { title: "Live Param Test", version: "1.0.0" },
				paths: {
					"/items/{itemId}": {
						post: {
							operationId: "updateItem",
							parameters: [
								{
									name: "itemId",
									in: "path",
									required: true,
									schema: { type: "string" },
								},
								{
									name: "callbackUrl",
									in: "query",
									required: true,
									schema: { type: "string" },
								},
								{
									name: "X-Trace-Id",
									in: "header",
									required: true,
									schema: { type: "string" },
								},
							],
							requestBody: {
								required: true,
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: { name: { type: "string" } },
										},
									},
								},
							},
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "object",
												properties: { ok: { type: "boolean" } },
											},
										},
									},
								},
							},
						},
					},
					"/{dataset}/{version}/records": {
						post: {
							operationId: "performSearch",
							parameters: [
								{
									name: "version",
									in: "path",
									required: true,
									schema: { type: "string" },
								},
								{
									name: "dataset",
									in: "path",
									required: true,
									schema: { type: "string" },
								},
							],
							requestBody: {
								required: true,
								content: {
									"application/x-www-form-urlencoded": {
										schema: {
											type: "object",
											properties: {
												criteria: { type: "string" },
												start: { type: "integer" },
												rows: { type: "integer" },
											},
											required: ["criteria"],
										},
									},
								},
							},
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "object",
												properties: { ok: { type: "boolean" } },
											},
										},
									},
								},
							},
						},
					},
				},
			};

			const outDir = path.join(tmpRoot, "live-vanilla");
			const config: GeneratorConfig = {
				input: "dummy",
				output: outDir,
				options: {
					framework: "vanilla",
					implementation: "fetch",
					generateServices: true,
				},
			};
			const project = new Project({ useInMemoryFileSystem: true });
			generateFromConfigSync(config, project, { spec });

			const loadModule = (
				relPath: string,
				injected: Record<string, unknown>,
			) => {
				const sf = project.getSourceFileOrThrow(path.join(outDir, relPath));
				const stripped = sf
					.getText()
					.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "");
				const js = ts.transpile(stripped, {
					target: ts.ScriptTarget.ES2020,
					module: ts.ModuleKind.CommonJS,
				});
				const modExports: Record<string, unknown> = {};
				const fn = new Function("exports", ...Object.keys(injected), js);
				fn(modExports, ...Object.values(injected));
				return modExports;
			};

			const contentEncoderMod = loadModule("utils/content-encoder.ts", {});
			const paramSerializerMod = loadModule("utils/parameter-serializer.ts", {
				ContentEncoder: contentEncoderMod.ContentEncoder,
			});
			const serversMod = loadModule("servers.ts", {});
			const serverUrlMod = loadModule("utils/server-url.ts", {
				API_SERVERS: serversMod.API_SERVERS,
			});
			const authSessionMod = loadModule("utils/auth-session.ts", {});
			const itemsClientMod = loadModule("services/items.client.ts", {
				ParameterSerializer: paramSerializerMod.ParameterSerializer,
				getServerUrl: serverUrlMod.getServerUrl,
				resolveServerUrl: serverUrlMod.resolveServerUrl,
				SdkAuthClient: authSessionMod.SdkAuthClient,
			});
			const datasetClientMod = loadModule("services/dataset.client.ts", {
				ParameterSerializer: paramSerializerMod.ParameterSerializer,
				getServerUrl: serverUrlMod.getServerUrl,
				resolveServerUrl: serverUrlMod.resolveServerUrl,
				SdkAuthClient: authSessionMod.SdkAuthClient,
			});

			const ItemsClientCtor = itemsClientMod.ItemsClient as new (
				basePath?: string,
			) => {
				updateItem: (
					itemId: string,
					callbackUrl: string,
					xTraceId: string,
					body: { name: string },
				) => Promise<{ ok: boolean }>;
			};
			const DatasetClientCtor = datasetClientMod.DatasetClient as new (
				basePath?: string,
			) => {
				performSearch: (
					version: string,
					dataset: string,
					body: { criteria: string; start?: number; rows?: number },
				) => Promise<{ ok: boolean }>;
			};

			recordedRequests.length = 0;
			const itemsClient = new ItemsClientCtor(baseUrl);
			const res1 = await itemsClient.updateItem(
				"item-42",
				"https://tonys-server.com/hook",
				"trace-abc",
				{ name: "Widget" },
			);
			expect(res1.ok).toBe(true);
			expect(recordedRequests[0]).toMatchObject({
				method: "POST",
				pathname: "/items/item-42",
				query: { callbackUrl: "https://tonys-server.com/hook" },
				body: JSON.stringify({ name: "Widget" }),
			});
			expect(recordedRequests[0]?.headers["x-trace-id"]).toBe("trace-abc");
			expect(recordedRequests[0]?.headers["content-type"]).toContain(
				"application/json",
			);

			const datasetClient = new DatasetClientCtor(baseUrl);
			const res2 = await datasetClient.performSearch("v1", "oa_citations", {
				criteria: "*:*",
				start: 0,
				rows: 100,
			});
			expect(res2.ok).toBe(true);
			expect(recordedRequests[1]).toMatchObject({
				method: "POST",
				pathname: "/oa_citations/v1/records",
				body: "criteria=*%3A*&start=0&rows=100",
			});
			expect(recordedRequests[1]?.headers["content-type"]).toContain(
				"application/x-www-form-urlencoded",
			);

			// Exercise Angular generated services against the same live HTTP server
			const angularOutDir = path.join(tmpRoot, "live-angular");
			const angularConfig: GeneratorConfig = {
				input: "dummy",
				output: angularOutDir,
				options: {
					framework: "angular",
					generateServices: true,
				},
			};
			const angularProject = new Project({ useInMemoryFileSystem: true });
			generateFromConfigSync(angularConfig, angularProject, { spec });

			const loadAngularModule = (
				relPath: string,
				injected: Record<string, unknown>,
			) => {
				const sf = angularProject.getSourceFileOrThrow(
					path.join(angularOutDir, relPath),
				);
				const stripped = sf
					.getText()
					.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "")
					.replace(/@Service\(\)/g, "");
				const js = ts.transpile(stripped, {
					target: ts.ScriptTarget.ES2020,
					module: ts.ModuleKind.CommonJS,
				});
				const modExports: Record<string, unknown> = {};
				const fn = new Function("exports", ...Object.keys(injected), js);
				fn(modExports, ...Object.values(injected));
				return modExports;
			};

			class MockHttpHeaders {
				private map = new Map<string, string>();
				constructor(init?: Record<string, string>) {
					if (init) {
						for (const [k, v] of Object.entries(init)) {
							this.map.set(k, v);
						}
					}
				}
				has(key: string): boolean {
					return this.map.has(key);
				}
				set(key: string, value: string): MockHttpHeaders {
					const next = new MockHttpHeaders();
					this.map.forEach((v, k) => {
						next.map.set(k, v);
					});
					next.map.set(key, value);
					return next;
				}
				toObject(): Record<string, string> {
					return Object.fromEntries(this.map.entries());
				}
			}

			class MockHttpParams {
				private pairs: Array<{ key: string; value: string }> = [];
				append(key: string, value: string): MockHttpParams {
					const next = new MockHttpParams();
					next.pairs = [...this.pairs, { key, value }];
					return next;
				}
				toString(): string {
					return this.pairs.map((p) => `${p.key}=${p.value}`).join("&");
				}
			}

			class MockHttpContext {
				set(): this {
					return this;
				}
			}

			const liveHttpClient = {
				post: (
					url: string,
					body: unknown,
					opts?: {
						params?: MockHttpParams;
						headers?: MockHttpHeaders;
					},
				) => {
					const qs = opts?.params?.toString();
					const fullUrl = qs ? `${url}?${qs}` : url;
					const hdrs = opts?.headers?.toObject() ?? {};
					const payload =
						body instanceof MockHttpParams
							? body.toString()
							: typeof body === "string"
								? body
								: JSON.stringify(body);
					return fetch(fullUrl, {
						method: "POST",
						headers: hdrs,
						body: payload,
					}).then((r) => r.json());
				},
			};

			const angContentEncoder = loadAngularModule(
				"utils/content-encoder.ts",
				{},
			);
			const angParamSerializer = loadAngularModule(
				"utils/parameter-serializer.ts",
				{
					ContentEncoder: angContentEncoder.ContentEncoder,
				},
			);
			const angHttpParamsBuilder = loadAngularModule(
				"utils/http-params-builder.ts",
				{
					HttpParams: MockHttpParams,
					ParameterSerializer: angParamSerializer.ParameterSerializer,
				},
			);
			const angServers = loadAngularModule("servers.ts", {});
			const angServerUrl = loadAngularModule("utils/server-url.ts", {
				API_SERVERS: angServers.API_SERVERS,
			});

			const injectStub = (token: unknown) => {
				if (token === "HttpClient") return liveHttpClient;
				if (token === "BASE_PATH") return baseUrl;
				return undefined;
			};

			const angItemsMod = loadAngularModule("services/items.service.ts", {
				inject: injectStub,
				HttpClient: "HttpClient",
				BASE_PATH_DEFAULT: "BASE_PATH",
				SERVER_VARIABLES_DEFAULT: "SERVER_VARS",
				CLIENT_CONTEXT_TOKEN_DEFAULT: "CTX_TOKEN",
				HttpHeaders: MockHttpHeaders,
				HttpParams: MockHttpParams,
				HttpContext: MockHttpContext,
				ParameterSerializer: angParamSerializer.ParameterSerializer,
				ApiParameterCodec: angHttpParamsBuilder.ApiParameterCodec,
				getServerUrl: angServerUrl.getServerUrl,
				resolveServerUrl: angServerUrl.resolveServerUrl,
			});
			const angDatasetMod = loadAngularModule("services/dataset.service.ts", {
				inject: injectStub,
				HttpClient: "HttpClient",
				BASE_PATH_DEFAULT: "BASE_PATH",
				SERVER_VARIABLES_DEFAULT: "SERVER_VARS",
				CLIENT_CONTEXT_TOKEN_DEFAULT: "CTX_TOKEN",
				HttpHeaders: MockHttpHeaders,
				HttpParams: MockHttpParams,
				HttpContext: MockHttpContext,
				ParameterSerializer: angParamSerializer.ParameterSerializer,
				ApiParameterCodec: angHttpParamsBuilder.ApiParameterCodec,
				getServerUrl: angServerUrl.getServerUrl,
				resolveServerUrl: angServerUrl.resolveServerUrl,
			});

			const ItemsServiceCtor = angItemsMod.ItemsService as new () => {
				updateItem: (
					itemId: string,
					callbackUrl: string,
					xTraceId: string,
					body: { name: string },
				) => Promise<{ ok: boolean }>;
			};
			const DatasetServiceCtor = angDatasetMod.DatasetService as new () => {
				performSearch: (
					version: string,
					dataset: string,
					body: { criteria: string; start?: number; rows?: number },
				) => Promise<{ ok: boolean }>;
			};

			const angItemsService = new ItemsServiceCtor();
			const angRes1 = await angItemsService.updateItem(
				"item-99",
				"https://tonys-server.com/angular-hook",
				"trace-ng",
				{ name: "AngularWidget" },
			);
			expect(angRes1.ok).toBe(true);
			expect(recordedRequests[2]).toMatchObject({
				method: "POST",
				pathname: "/items/item-99",
				query: { callbackUrl: "https://tonys-server.com/angular-hook" },
				body: JSON.stringify({ name: "AngularWidget" }),
			});
			expect(recordedRequests[2]?.headers["x-trace-id"]).toBe("trace-ng");

			const angDatasetService = new DatasetServiceCtor();
			const angRes2 = await angDatasetService.performSearch(
				"v1",
				"oa_citations",
				{
					criteria: "*:*",
					start: 0,
					rows: 100,
				},
			);
			expect(angRes2.ok).toBe(true);
			expect(recordedRequests[3]).toMatchObject({
				method: "POST",
				pathname: "/oa_citations/v1/records",
				body: "criteria=*%3A*&start=0&rows=100",
			});
			expect(recordedRequests[3]?.headers["content-type"]).toContain(
				"application/x-www-form-urlencoded",
			);
		});
	});
});
