import { describe, expect, it } from "vitest";
import {
	applyPayloadReplacements,
	evaluateArazzoSelectorObject,
	evaluateCriteriaList,
	evaluateCriterion,
	evaluateJsonPath,
	evaluateSelector,
	evaluateSimpleCondition,
	evaluateValueOrSelector,
	evaluateXPath,
	parseSimpleXml,
	serializeSimpleXml,
	topologicalSortSteps,
	topologicalSortWorkflows,
} from "../../src/core/arazzo-engine.js";
import {
	decodeJsonPointerToken,
	evaluateJsonPointer,
	evaluatePayloadExpressions,
	evaluateRuntimeExpression,
	type RuntimeContext,
	resolveSingleExpression,
} from "../../src/core/runtime-expressions.js";

function createFullContext(): RuntimeContext {
	return {
		url: "https://api.petstore.io/v2/pet/10",
		method: "POST",
		statusCode: 200,
		self: "https://api.petstore.io/arazzo.yaml",
		request: {
			headers: {
				"X-Request-Id": "req-123",
				"X-Multi": ["first", "second"],
			},
			query: {
				filter: "active",
				tags: ["dog", "cat"],
			},
			path: {
				petId: "10",
			},
			body: {
				name: "Max",
				items: [{ id: 1 }, { id: 2 }],
				nested: { flag: true },
			},
		},
		response: {
			headers: {
				"Content-Type": "application/json",
				"Retry-After": ["5"],
			},
			body: {
				id: 10,
				status: "available",
				price: 25,
				items: [
					{ id: "a1", active: true, price: 5 },
					{ id: "a2", active: false, price: 15 },
				],
				matrix: [[100, 200]],
			},
		},
		message: {
			headers: {
				"x-correlation-id": "corr-999",
			},
			payload: {
				eventId: "evt-1",
				data: { score: 42 },
			},
		},
		inputs: {
			username: "alice",
			prefs: { theme: "dark" },
			list: ["x", "y"],
		},
		outputs: {
			finalToken: "tok-xyz",
		},
		steps: {
			login: {
				statusCode: 201,
				outputs: {
					token: "jwt-abc",
					user: { id: 99 },
				},
				request: {
					headers: { "x-step-req": "sreq" },
					query: {},
					path: {},
					body: { user: "alice" },
				},
				response: {
					headers: { "x-step-res": "sres" },
					body: { ok: true },
				},
				message: {
					headers: { "x-step-msg": "smsg" },
					payload: { done: true },
				},
			},
		},
		workflows: {
			authFlow: {
				inputs: { clientId: "c1" },
				outputs: { sessionKey: "sk-1" },
			},
		},
		sourceDescriptions: {
			petstore: {
				url: "https://api.petstore.io/openapi.json",
				workflows: {
					subFlow: {
						inputs: { subIn: "v1" },
						outputs: { subOut: "v2" },
					},
				},
			},
		},
		components: {
			parameters: {
				sharedPage: { name: "page", in: "query", value: 1 },
			},
			inputs: {
				UserAuth: { type: "object" },
			},
			successActions: {
				endNow: { name: "endNow", type: "end" },
			},
			failureActions: {
				retryOnce: {
					name: "retryOnce",
					type: "retry",
					retryLimit: 1,
					retryAfter: 2,
				},
			},
		},
	};
}

describe("Runtime Expressions & Arazzo 1.1.0 Engine", () => {
	describe("decodeJsonPointerToken & evaluateJsonPointer", () => {
		it("decodes URI components, ~1, ~0, and handles malformed % escapes", () => {
			expect(decodeJsonPointerToken("a~1b~0c%20d")).toBe("a/b~c d");
			expect(decodeJsonPointerToken("%E0%A4%A")).toBe("%E0%A4%A");
		});

		it("evaluates root, object, array, and out-of-bounds or invalid pointers", () => {
			const data = { a: { "b/c": [10, 20] }, nullVal: null };
			expect(evaluateJsonPointer(data, "")).toEqual(data);
			expect(evaluateJsonPointer(data, "#")).toEqual(data);
			expect(evaluateJsonPointer(data, "invalid")).toBeUndefined();
			expect(evaluateJsonPointer(data, "#/a/b~1c/1")).toBe(20);
			expect(evaluateJsonPointer(data, "/a/b~1c/99")).toBeUndefined();
			expect(evaluateJsonPointer(data, "/a/b~1c/notnum")).toBeUndefined();
			expect(evaluateJsonPointer(data, "/a/missing")).toBeUndefined();
			expect(evaluateJsonPointer(data, "/nullVal/child")).toBeUndefined();
		});
	});

	describe("resolveSingleExpression & evaluateRuntimeExpression", () => {
		it("resolves all OpenAPI and Arazzo 1.1.0 top-level and nested expressions", () => {
			const ctx = createFullContext();
			expect(evaluateRuntimeExpression("$url", ctx)).toBe(ctx.url);
			expect(evaluateRuntimeExpression("$method", ctx)).toBe("POST");
			expect(evaluateRuntimeExpression("$statusCode", ctx)).toBe(200);
			expect(evaluateRuntimeExpression("$self", ctx)).toBe(ctx.self);
			expect(evaluateRuntimeExpression("$request", ctx)).toEqual(ctx.request);
			expect(
				evaluateRuntimeExpression("$request.header.x-request-id", ctx),
			).toBe("req-123");
			expect(evaluateRuntimeExpression("$request.header.x-multi", ctx)).toBe(
				"first",
			);
			expect(
				evaluateRuntimeExpression("$request.header.missing", ctx),
			).toBeUndefined();
			expect(evaluateRuntimeExpression("$request.query.filter", ctx)).toBe(
				"active",
			);
			expect(evaluateRuntimeExpression("$request.query.tags", ctx)).toBe("dog");
			expect(evaluateRuntimeExpression("$request.path.petId", ctx)).toBe("10");
			expect(evaluateRuntimeExpression("$request.body", ctx)).toEqual(
				ctx.request.body,
			);
			expect(evaluateRuntimeExpression("$request.body#/name", ctx)).toBe("Max");
			expect(evaluateRuntimeExpression("$request.body.nested.flag", ctx)).toBe(
				true,
			);
			expect(
				evaluateRuntimeExpression("$request.unknown", ctx),
			).toBeUndefined();

			expect(evaluateRuntimeExpression("$response", ctx)).toEqual(ctx.response);
			expect(
				evaluateRuntimeExpression("$response.header.content-type", ctx),
			).toBe("application/json");
			expect(
				evaluateRuntimeExpression("$response.header.retry-after", ctx),
			).toBe("5");
			expect(evaluateRuntimeExpression("$response.body", ctx)).toEqual(
				ctx.response?.body,
			);
			expect(evaluateRuntimeExpression("$response.body#/status", ctx)).toBe(
				"available",
			);
			expect(evaluateRuntimeExpression("$response.body.id", ctx)).toBe(10);
			expect(
				evaluateRuntimeExpression("$response.unknown", ctx),
			).toBeUndefined();

			expect(evaluateRuntimeExpression("$message", ctx)).toEqual(ctx.message);
			expect(
				evaluateRuntimeExpression("$message.header.x-correlation-id", ctx),
			).toBe("corr-999");
			expect(
				evaluateRuntimeExpression("$message.header#/x-correlation-id", ctx),
			).toBe("corr-999");
			expect(evaluateRuntimeExpression("$message.payload", ctx)).toEqual(
				ctx.message?.payload,
			);
			expect(
				evaluateRuntimeExpression("$message.payload#/data/score", ctx),
			).toBe(42);
			expect(evaluateRuntimeExpression("$message.payload.eventId", ctx)).toBe(
				"evt-1",
			);
			expect(
				evaluateRuntimeExpression("$message.unknown", ctx),
			).toBeUndefined();

			expect(evaluateRuntimeExpression("$inputs", ctx)).toEqual(ctx.inputs);
			expect(evaluateRuntimeExpression("$inputs.username", ctx)).toBe("alice");
			expect(evaluateRuntimeExpression("$inputs.prefs#/theme", ctx)).toBe(
				"dark",
			);
			expect(evaluateRuntimeExpression("$inputs.list.1", ctx)).toBe("y");
			expect(
				evaluateRuntimeExpression("$inputs.list.bad", ctx),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$inputs.username.deep", ctx),
			).toBeUndefined();

			expect(evaluateRuntimeExpression("$outputs", ctx)).toEqual(ctx.outputs);
			expect(evaluateRuntimeExpression("$outputs.finalToken", ctx)).toBe(
				"tok-xyz",
			);

			expect(evaluateRuntimeExpression("$steps.login", ctx)).toEqual(
				ctx.steps?.login,
			);
			expect(
				evaluateRuntimeExpression("$steps.missing.outputs.a", ctx),
			).toBeUndefined();
			expect(evaluateRuntimeExpression("$steps.login.outputs", ctx)).toEqual(
				ctx.steps?.login?.outputs,
			);
			expect(evaluateRuntimeExpression("$steps.login.outputs.token", ctx)).toBe(
				"jwt-abc",
			);
			expect(evaluateRuntimeExpression("$steps.login.statusCode", ctx)).toBe(
				201,
			);
			expect(
				evaluateRuntimeExpression(
					"$steps.login.request.header.x-step-req",
					ctx,
				),
			).toBe("sreq");
			expect(
				evaluateRuntimeExpression(
					"$steps.login.response.header.x-step-res",
					ctx,
				),
			).toBe("sres");
			expect(
				evaluateRuntimeExpression("$steps.login.message.payload.done", ctx),
			).toBe(true);
			expect(evaluateRuntimeExpression("$steps.login.token", ctx)).toBe(
				"jwt-abc",
			);

			expect(evaluateRuntimeExpression("$workflows.authFlow", ctx)).toEqual(
				ctx.workflows?.authFlow,
			);
			expect(
				evaluateRuntimeExpression("$workflows.missing.inputs.a", ctx),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$workflows.authFlow.inputs", ctx),
			).toEqual({ clientId: "c1" });
			expect(
				evaluateRuntimeExpression("$workflows.authFlow.inputs.clientId", ctx),
			).toBe("c1");
			expect(
				evaluateRuntimeExpression("$workflows.authFlow.outputs", ctx),
			).toEqual({ sessionKey: "sk-1" });
			expect(
				evaluateRuntimeExpression(
					"$workflows.authFlow.outputs.sessionKey",
					ctx,
				),
			).toBe("sk-1");
			expect(
				evaluateRuntimeExpression("$workflows.authFlow.unknown", ctx),
			).toBeUndefined();

			expect(
				evaluateRuntimeExpression("$sourceDescriptions.petstore", ctx),
			).toEqual(ctx.sourceDescriptions?.petstore);
			expect(
				evaluateRuntimeExpression("$sourceDescriptions.missing.url", ctx),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$sourceDescriptions.petstore.url", ctx),
			).toBe("https://api.petstore.io/openapi.json");
			expect(
				evaluateRuntimeExpression(
					"$sourceDescriptions.petstore.workflows.subFlow",
					ctx,
				),
			).toEqual(ctx.sourceDescriptions?.petstore?.workflows?.subFlow);
			expect(
				evaluateRuntimeExpression(
					"$sourceDescriptions.petstore.workflows.unregistered",
					ctx,
				),
			).toBe("$sourceDescriptions.petstore.workflows.unregistered");
			expect(
				evaluateRuntimeExpression(
					"$sourceDescriptions.petstore.workflows.subFlow.inputs.subIn",
					ctx,
				),
			).toBe("v1");
			expect(
				evaluateRuntimeExpression(
					"$sourceDescriptions.petstore.workflows.subFlow.outputs.subOut",
					ctx,
				),
			).toBe("v2");
			expect(
				evaluateRuntimeExpression(
					"$sourceDescriptions.petstore.workflows.subFlow.unknown",
					ctx,
				),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression(
					"$sourceDescriptions.petstore.workflows.missing.inputs.x",
					ctx,
				),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$sourceDescriptions.petstore.other", ctx),
			).toBeUndefined();

			expect(
				evaluateRuntimeExpression(
					"$components.parameters.sharedPage.value",
					ctx,
				),
			).toBe(1);
			expect(resolveSingleExpression("$unknownRoot", ctx)).toBeUndefined();
		});

		it("handles missing optional contexts and string interpolation", () => {
			const minimalCtx: RuntimeContext = {
				url: "http://localhost",
				method: "GET",
				statusCode: 404,
				request: { headers: {}, query: {}, path: {} },
			};
			expect(
				evaluateRuntimeExpression("$response.body#/id", minimalCtx),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$message.payload#/id", minimalCtx),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$request.body.foo", minimalCtx),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$response.body.foo", minimalCtx),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$response.body.foo", {
					...minimalCtx,
					response: { headers: {} },
				}),
			).toBeUndefined();
			expect(
				evaluateRuntimeExpression("$message.payload.foo", {
					...minimalCtx,
					response: { headers: {} },
					message: { headers: {} },
				}),
			).toBeUndefined();
			expect(evaluateRuntimeExpression("plain-constant", minimalCtx)).toBe(
				"plain-constant",
			);

			const ctx = createFullContext();
			expect(
				evaluateRuntimeExpression(
					"Bearer {$steps.login.outputs.token} ({$inputs.missing})",
					ctx,
				),
			).toBe("Bearer jwt-abc ()");

			expect(
				evaluatePayloadExpressions(
					{
						auth: "Bearer {$steps.login.outputs.token}",
						list: ["{$inputs.username}", 123],
					},
					ctx,
				),
			).toEqual({
				auth: "Bearer jwt-abc",
				list: ["alice", 123],
			});
		});
	});

	describe("XML & XPath Evaluator", () => {
		const sampleXml = `<?xml version="1.0"?><!-- comment --><pet id="10" status='available'><name>Max</name><note><![CDATA[friendly]]></note><tags><tag active="true">dog</tag><tag>guard</tag></tags><empty/></pet>`;

		it("parses and serializes XML nodes and evaluates XPath queries", () => {
			const parsed = parseSimpleXml(sampleXml);
			expect(parsed?.tag).toBe("pet");
			expect(parsed ? serializeSimpleXml(parsed) : "").toContain("<empty/>");
			expect(parseSimpleXml("just plain text")).toBeUndefined();

			expect(evaluateXPath(sampleXml, "")).toBeUndefined();
			expect(evaluateXPath(sampleXml, "/pet/name")).toBe("Max");
			expect(evaluateXPath(sampleXml, "/pet/name/text()")).toBe("Max");
			expect(evaluateXPath(sampleXml, "/pet/@id")).toBe("10");
			expect(evaluateXPath(sampleXml, "/pet/@missing")).toBeUndefined();
			expect(evaluateXPath(sampleXml, "//tag")).toEqual(["dog", "guard"]);
			expect(evaluateXPath(sampleXml, "//tag/text()")).toEqual([
				"dog",
				"guard",
			]);
			expect(evaluateXPath(sampleXml, "//tag[2]")).toBe("guard");
			expect(evaluateXPath(sampleXml, "//tag[99]")).toBeUndefined();
			expect(evaluateXPath(sampleXml, "//tag[@active='true']")).toBe("dog");
			expect(evaluateXPath(sampleXml, "//tag[@active]")).toBe("dog");
			expect(evaluateXPath(sampleXml, "//tag[unknownPred]")).toEqual([
				"dog",
				"guard",
			]);
			expect(evaluateXPath(sampleXml, "count(//tag)")).toBe(2);
			expect(evaluateXPath(sampleXml, "count(//nonexistent)")).toBe(0);
			expect(evaluateXPath(sampleXml, "count(/pet/name)")).toBe(1);
			expect(evaluateXPath(sampleXml, "/pet/tags")).toContain("<tag");
			expect(evaluateXPath(sampleXml, "/wrongRoot/name")).toBeUndefined();
			expect(evaluateXPath(sampleXml, "pet/note")).toBe("friendly");
			expect(evaluateXPath(sampleXml, "/*/@status")).toBe("available");
			expect(
				evaluateXPath("<root><a id='1'/><a id='2'/></root>", "/root/a/@id"),
			).toEqual(["1", "2"]);
			expect(evaluateXPath("not-xml", "/pet/name")).toBeUndefined();
			expect(evaluateXPath({ pet: { name: "Max" } }, "/pet/name/text()")).toBe(
				"Max",
			);
			expect(evaluateXPath(42, "/pet/name")).toBeUndefined();
		});
	});

	describe("JSONPath & Selector Evaluator", () => {
		it("evaluates RFC 9535 & Goessner JSONPath expressions", () => {
			const ctx = createFullContext();
			const body = ctx.response?.body;

			expect(evaluateJsonPath(body, "$")).toEqual(body);
			expect(evaluateJsonPath(body, "/status")).toBe("available");
			expect(evaluateJsonPath(body, "$.status")).toBe("available");
			expect(evaluateJsonPath(body, "status")).toBe("available");
			expect(evaluateJsonPath(body, "$.items[0].id")).toBe("a1");
			expect(evaluateJsonPath(body, "$.items[-1].id")).toBe("a2");
			expect(evaluateJsonPath(body, "$.items[99].id")).toBeUndefined();
			expect(evaluateJsonPath(body, "$.items[*].id")).toEqual(["a1", "a2"]);
			expect(evaluateJsonPath({ a: 1, b: 2 }, "$.*")).toEqual([1, 2]);
			expect(evaluateJsonPath(body, "$.items[?(@.active == true)].id")).toEqual(
				["a1"],
			);
			expect(evaluateJsonPath(body, "$.items[?(@.price < 10)].id")).toEqual([
				"a1",
			]);
			expect(evaluateJsonPath(body, "$.items[?(@.active)].id")).toEqual(["a1"]);
			expect(evaluateJsonPath(body, "$.items[?(invalid)].id")).toBeUndefined();
			expect(evaluateJsonPath(body, "$[?(@.id == 10)]")).toBeUndefined();
			expect(evaluateJsonPath(body, "$.items.notanindex")).toBeUndefined();
			expect(evaluateJsonPath(body, "$.missingProp")).toBeUndefined();
			expect(evaluateJsonPath([1, 2], "$[?(@.x == 1)]")).toBeUndefined();
			expect(evaluateJsonPath(body, "$..id")).toEqual([10, "a1", "a2"]);
			expect(evaluateJsonPath(body, "$..price")).toEqual([25, 5, 15]);
			expect(evaluateJsonPath(body, "$..missingKey")).toBeUndefined();
			expect(evaluateJsonPath({ single: { k: 7 } }, "$..k")).toBe(7);
			expect(evaluateJsonPath(body, "$.status.nonObject")).toBeUndefined();
			expect(
				evaluateJsonPath(
					{ items: [{ nested: { val: 5 } }] },
					"$.items[?(@.nested.val == 5)]",
				),
			).toEqual([{ nested: { val: 5 } }]);
			expect(
				evaluateJsonPath(
					{ items: [{ nested: "prim" }] },
					"$.items[?(@.nested.val == 5)]",
				),
			).toBeUndefined();
		});

		it("evaluates evaluateSelector, evaluateArazzoSelectorObject, and evaluateValueOrSelector", () => {
			const ctx = createFullContext();
			expect(evaluateSelector(ctx.response?.body, "/id", "jsonpointer")).toBe(
				10,
			);
			expect(evaluateSelector(ctx.response?.body, "/id")).toBe(10);
			expect(
				evaluateSelector(ctx.response?.body, "$.id", {
					type: "jsonpath",
					version: "rfc9535",
				}),
			).toBe(10);
			expect(evaluateSelector("<pet><id>55</id></pet>", "/pet/id")).toBe("55");

			expect(
				evaluateArazzoSelectorObject(
					{
						context: "$response.body",
						selector: "$.items[0].id",
						type: "jsonpath",
					},
					ctx,
				),
			).toBe("a1");

			expect(
				evaluateValueOrSelector(
					{
						context: "$response.body",
						selector: "/status",
						type: { type: "jsonpointer", version: "rfc6901" },
					},
					ctx,
				),
			).toBe("available");
			expect(evaluateValueOrSelector("$inputs.username", ctx)).toBe("alice");
		});
	});

	describe("Criterion Evaluator", () => {
		it("evaluates simple, regex, jsonpath, jsonpointer, and xpath criteria", () => {
			const ctx = createFullContext();

			expect(evaluateCriterion({ condition: "$statusCode == 200" }, ctx)).toBe(
				true,
			);
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition:
							"($.status == 'available' && /price >= 20) || /price < 0",
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition:
							"!($.status == 'sold') && /price != 99 && /price <= 25 && /price > 10 && /price < 100",
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body#/status",
						condition: "$ == 'available'",
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition: "$.status",
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition: "true == true && false == false && null == null",
					},
					ctx,
				),
			).toBe(true);
			expect(evaluateSimpleCondition("(true) && (1 == 1)", ctx, null)).toBe(
				true,
			);

			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition:
							"$.status == available && $.price == 25.5 || $.price == 25",
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body#/status",
						condition: "^avail",
						type: "regex",
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$statusCode",
						condition: "^20[0-9]$",
						type: "regex",
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition: "available",
						type: "regex",
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$inputs.missing",
						condition: "^$",
						type: "regex",
					},
					ctx,
				),
			).toBe(true);

			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition: "$.items[?(@.active == true)]",
						type: { type: "jsonpath", version: "rfc9535" },
					},
					ctx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition: "/status",
						type: "jsonpointer",
					},
					ctx,
				),
			).toBe(true);

			const xmlCtx: RuntimeContext = {
				...ctx,
				response: {
					headers: {},
					body: "<order><item>1</item></order>",
				},
			};
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition: "/order/item",
						type: { type: "xpath", version: "xpath-31" },
					},
					xmlCtx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition: "count(//item)",
						type: "xpath",
					},
					xmlCtx,
				),
			).toBe(true);
			expect(
				evaluateCriterion(
					{
						context: "$response.body",
						condition: "//item",
						type: "xpath",
					},
					{
						...ctx,
						response: {
							headers: {},
							body: "<order><item>1</item><item>2</item></order>",
						},
					},
				),
			).toBe(true);

			expect(evaluateCriteriaList(undefined, ctx)).toBe(true);
			expect(
				evaluateCriteriaList([{ condition: "$statusCode == 200" }], ctx),
			).toBe(true);
		});
	});

	describe("Payload Replacements", () => {
		it("applies jsonpointer, jsonpath, and xpath payload replacements immutably", () => {
			const ctx = createFullContext();
			const basePayload = {
				user: { name: "placeholder" },
				items: ["old"],
			};

			expect(applyPayloadReplacements(basePayload, undefined, ctx)).toEqual(
				basePayload,
			);

			const replaced = applyPayloadReplacements(
				basePayload,
				[
					{
						target: "/user/name",
						value: "$inputs.username",
					},
					{
						target: "$.items[0]",
						targetSelectorType: "jsonpath",
						value: {
							context: "$response.body",
							selector: "$.items[0].id",
						},
					},
					{
						target: "/newSection/deep/key",
						targetSelectorType: { type: "jsonpointer", version: "rfc6901" },
						value: "created",
					},
					{
						target: "",
						value: { skippedBecauseRoot: false },
					},
				],
				ctx,
			);
			expect(replaced).toEqual({ skippedBecauseRoot: false });
			expect(basePayload.user.name).toBe("placeholder");

			const partialReplaced = applyPayloadReplacements(
				{
					user: { name: "placeholder" },
					items: [["nestedOld"]],
				},
				[
					{ target: "#/user/name", value: "$inputs.username" },
					{ target: "$['items'][0][0]", value: "updatedNested" },
					{
						target: "user.name",
						targetSelectorType: "jsonpath",
						value: "alice",
					},
					{ target: "/items/0/notanindex", value: "ignored" },
					{ target: "/newObj/sub", value: 123 },
					{ target: "invalidPointer", value: "ignored" },
				],
				ctx,
			);
			expect(partialReplaced).toEqual({
				user: { name: "alice" },
				items: [["updatedNested"]],
				newObj: { sub: 123 },
			});
			expect(
				applyPayloadReplacements(42, [{ target: "/a", value: 1 }], ctx),
			).toBe(42);

			const xmlPayload = '<pet id="1"><name>Old</name></pet>';
			const xmlReplaced = applyPayloadReplacements(
				xmlPayload,
				[
					{
						target: "/pet/name",
						targetSelectorType: "xpath",
						value: "$inputs.username",
					},
					{
						target: "/pet/@id",
						value: "99",
					},
					{
						target: "/pet/missing/deep",
						value: "noop",
					},
					{
						target: "/pet/name",
						value: null,
					},
					{
						target: "/pet/@id",
						value: null,
					},
				],
				ctx,
			);
			expect(xmlReplaced).toBe('<pet id=""><name/></pet>');
			expect(
				applyPayloadReplacements(
					"not-xml",
					[{ target: "/a", value: "b" }],
					ctx,
				),
			).toBe("not-xml");
			expect(
				applyPayloadReplacements(
					xmlPayload,
					[{ target: "/", value: "b" }],
					ctx,
				),
			).toBe(xmlPayload);
			expect(
				parseSimpleXml("<![CDATA[orphan]]><root><a>1</a><b>2</b></root>"),
			).toBeDefined();
			expect(
				evaluateSimpleCondition(
					`($.status == "a||b" && $.status != 'c&&d')`,
					ctx,
					{ status: "a||b" },
				),
			).toBe(true);
		});
	});

	describe("Topological DAG Sorters (topologicalSortWorkflows & topologicalSortSteps)", () => {
		it("sorts workflows respecting dependsOn and detects cycles", () => {
			const sorted = topologicalSortWorkflows([
				{
					workflowId: "checkout",
					dependsOn: ["addToCart", "$sourceDescriptions.ext.workflows.init"],
					steps: [],
				},
				{
					workflowId: "addToCart",
					dependsOn: ["login"],
					steps: [],
				},
				{
					workflowId: "login",
					steps: [],
				},
			]);
			expect(sorted).toEqual(["login", "addToCart", "checkout"]);

			expect(() =>
				topologicalSortWorkflows([
					{ workflowId: "a", dependsOn: ["b"], steps: [] },
					{ workflowId: "b", dependsOn: ["a"], steps: [] },
				]),
			).toThrow(/Cyclic workflow dependency detected/);
		});

		it("sorts steps respecting dependsOn and detects cycles or missing steps", () => {
			const sorted = topologicalSortSteps([
				{ stepId: "step3", operationId: "op3", dependsOn: ["step2"] },
				{ stepId: "step1", operationId: "op1" },
				{ stepId: "step2", operationId: "op2", dependsOn: ["step1"] },
			]);
			expect(sorted).toEqual(["step1", "step2", "step3"]);

			expect(() =>
				topologicalSortSteps([
					{ stepId: "s1", operationId: "op1", dependsOn: ["s2"] },
					{ stepId: "s2", operationId: "op2", dependsOn: ["s1"] },
				]),
			).toThrow(/Cyclic step dependency detected/);

			expect(() =>
				topologicalSortSteps([
					{ stepId: "s1", operationId: "op1", dependsOn: ["unknownStep"] },
				]),
			).toThrow(/Step dependency references unknown stepId: unknownStep/);
		});
	});
});
