import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OAS_3_1_DIALECT } from "@src/core/constants.js";

import {
	buildOpenApiSpecFromScan,
	scanTypeScriptProject,
	scanTypeScriptSource,
} from "@src/functions/parse.js";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

const makeTempDir = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cdd-ts-ast-"));
	tempDirs.push(dir);
	return dir;
};

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir && fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

const fixturesDir = path.resolve(process.cwd(), "tests/fixtures/ast");
const expressFixture = path.join(fixturesDir, "express.routes.ts");
const decoratedFixture = path.join(fixturesDir, "decorated.controller.ts");
const ignoredFixture = path.join(fixturesDir, "ignored.spec.ts");
const querystringExampleFixture = path.join(
	fixturesDir,
	"querystring.examples.ts",
);

const copyFixture = (src: string, destDir: string) => {
	const content = fs.readFileSync(src, "utf-8");
	const dest = path.join(destDir, path.basename(src));
	fs.writeFileSync(dest, content);
};

describe("Core Utils: OpenAPI AST Scanner", () => {
	it("should scan express routes and infer params, tags, and schemas", () => {
		const sourceText = fs.readFileSync(expressFixture, "utf-8");
		const ir = scanTypeScriptSource(sourceText, expressFixture);
		const noSchemaIr = scanTypeScriptSource(sourceText, expressFixture, {
			includeSchemas: false,
		});
		expect(noSchemaIr.schemas).toEqual({});

		const getUser = ir.operations.find((op) => op.operationId === "getUser");
		expect(getUser).toBeDefined();
		expect(getUser?.method).toBe("GET");
		expect(getUser?.path).toBe("/users/{id}");
		expect(getUser?.summary).toBe("Get user by id.");
		expect(getUser?.description).toBe("Returns the user payload.");
		expect(getUser?.deprecated).toBe(true);
		expect(getUser?.tags).toEqual(["Users", "Accounts"]);

		const paramKeys =
			getUser?.params.map((param) => `${param.in}:${param.name}`) ?? [];
		expect(paramKeys).toEqual(
			expect.arrayContaining([
				"path:id",
				"query:search",
				"header:x-token",
				"header:X-Request-Id",
				"cookie:session",
			]),
		);

		const patchProject = ir.operations.find(
			(op) => op.path === "/projects/{projectId}",
		);
		expect(patchProject?.path).toBe("/projects/{projectId}");
		expect(patchProject?.responses[0]?.contentTypes).toContain(
			"application/xml",
		);

		const messages = ir.operations.find((op) => op.path === "/messages");
		expect(messages?.requestBody?.contentTypes).toEqual(["application/json"]);
		expect(messages?.responses[0]?.contentTypes).toEqual(["text/plain"]);

		const typedMessages = ir.operations.find(
			(op) => op.path === "/typed-messages",
		);
		expect(typedMessages?.responses[0]?.status).toBe("201");
		expect(typedMessages?.requestBody?.schema).toEqual({
			$ref: "#/components/schemas/CreateMessageBody",
		});
		expect(typedMessages?.responses[0]?.schema).toEqual({
			$ref: "#/components/schemas/MessageReceipt",
		});

		const templated = ir.operations.find(
			(op) => op.path === "/{version}/status",
		);
		expect(templated).toBeDefined();

		const arrayOp = ir.operations.find((op) => op.path === "/array");
		expect(arrayOp?.method).toBe("PUT");
		expect(arrayOp?.responses[0]?.contentTypes).toEqual(["text/csv"]);

		const boundOp = ir.operations.find((op) => op.path === "/bound/{id}");
		const boundParams =
			boundOp?.params.map((param) => `${param.in}:${param.name}`) ?? [];
		expect(boundParams).toEqual(
			expect.arrayContaining(["path:id", "query:filter"]),
		);
		expect(boundOp?.responses[0]?.contentTypes).toEqual([]);

		const objectOp = ir.operations.find((op) => op.path === "/object");
		expect(objectOp?.responses[0]?.contentTypes).toEqual(["application/json"]);

		const removeOp = ir.operations.find((op) => op.path === "/remove/{id}");
		expect(removeOp?.responses[0]?.status).toBe("204");

		const localOp = ir.operations.find((op) => op.path === "/local");
		expect(localOp?.summary).toBe("Local handler summary.");
		expect(localOp?.description).toBe("Local handler description.");

		const stringStatusOp = ir.operations.find(
			(op) => op.path === "/string-status",
		);
		expect(stringStatusOp?.responses[0]?.status).toBe("202");

		expect(ir.operations.some((op) => op.path === "/literal")).toBe(true);

		const queryOp = ir.operations.find((op) => op.path === "/search");
		expect(queryOp?.method).toBe("QUERY");
		const queryParams =
			queryOp?.params.map((param) => `${param.in}:${param.name}`) ?? [];
		expect(queryParams).toEqual(expect.arrayContaining(["query:q"]));

		const rawQueryOp = ir.operations.find((op) => op.path === "/raw-query");
		const rawQueryParams =
			rawQueryOp?.params.map((param) => `${param.in}:${param.name}`) ?? [];
		expect(rawQueryParams).toEqual(
			expect.arrayContaining(["querystring:rawQuery"]),
		);

		const copyOp = ir.operations.find((op) => op.path === "/files/{id}");
		expect(copyOp?.method).toBe("COPY");
		const copyParams =
			copyOp?.params.map((param) => `${param.in}:${param.name}`) ?? [];
		expect(copyParams).toEqual(expect.arrayContaining(["path:id"]));

		const secureOp = ir.operations.find((op) => op.path === "/secure");
		expect(secureOp?.externalDocs).toEqual({
			url: "https://example.com/secure",
			description: "Secure docs",
		});
		expect(secureOp?.servers).toEqual([
			{
				url: "https://api.example.com/v2",
				description: "Production",
				name: "prod",
				variables: { version: { default: "v2" } },
			},
			{ url: "https://staging.example.com/v2", description: "Staging" },
		]);
		expect(secureOp?.security).toEqual([
			{ ApiKey: [] },
			{ OAuth2: ["read:items", "write:items"] },
		]);
		expect(secureOp?.extensions).toEqual({ "x-feature-flag": "beta" });

		const documentedOp = ir.operations.find(
			(op) => op.path === "/documented/{id}",
		);
		expect(documentedOp?.operationId).toBe("fetchDocumented");
		const documentedId = documentedOp?.params.find(
			(param) => param.in === "path" && param.name === "id",
		);
		expect(documentedId?.description).toBe("Documented id.");
		const documented202 = documentedOp?.responses.find(
			(response) => response.status === "202",
		);
		expect(documented202?.summary).toBe("Accepted summary");
		expect(documented202?.description).toBe("Accepted payload");
		expect(documented202?.contentTypes).toEqual(
			expect.arrayContaining(["application/json"]),
		);
		const documented404 = documentedOp?.responses.find(
			(response) => response.status === "404",
		);
		expect(documented404?.description).toBe("Not found");
		expect(documented404?.contentTypes).toEqual(
			expect.arrayContaining(["text/plain"]),
		);

		expect(ir.schemas).toHaveProperty("CreateMessage");
		expect(ir.schemas).toHaveProperty("MessageStatus");
	});

	it("should apply JSDoc example tags to params, request bodies, and responses", () => {
		const sourceText = `
const app = { post: (..._args: string | number | boolean | object | undefined | null[]) => { void _args; } };
/**
 * Create user.
 * @paramExample id 123
 * @requestExample application/json {"name":"Ada"}
 * @responseExample 200 application/json {"id":123,"name":"Ada"}
 */
function createUser(req: string | number | boolean | object | undefined | null, res: string | number | boolean | object | undefined | null) {
  const { id } = req.params;
  const body = req.body;
  res.status(200).json({ id, body });
}
app.post('/users/:id', createUser);
`;
		const ir = scanTypeScriptSource(sourceText, "/virtual.ts");
		const spec = buildOpenApiSpecFromScan(ir);

		const createUser = spec.paths?.["/users/{id}"]?.post;

		const idParam = createUser?.parameters?.find?.(
			(param) => param.name === "id",
		);

		expect(idParam?.example).toBe(123);

		expect(
			createUser?.requestBody?.content?.["application/json"]?.example,
		).toEqual({
			name: "Ada",
		});

		expect(
			createUser?.responses?.["200"]?.content?.["application/json"]?.example,
		).toEqual({ id: 123, name: "Ada" });
	});

	it("should preserve wrapped serialized/external examples from JSDoc tags", () => {
		const sourceText = `
const app = { post: (..._args: string | number | boolean | object | undefined | null[]) => { void _args; }, get: (..._args: string | number | boolean | object | undefined | null[]) => { void _args; } };
/**
 * Return plain text.
 * @response 200 text/plain OK
 * @responseExample 200 text/plain {"__oasExample":{"serializedValue":"OK"}}
 */
function getPlain(req: string | number | boolean | object | undefined | null, res: string | number | boolean | object | undefined | null) {
  res.status(200).send('OK');
}
app.get('/plain', getPlain);

/**
 * Send plain text.
 * @requestExample text/plain {"__oasExample":{"externalValue":"./examples/request.txt"}}
 */
function postPlain(req: string | number | boolean | object | undefined | null, res: string | number | boolean | object | undefined | null) {
  if (req.is('text/plain')) { /* noop */ }
  const body = req.body;
  res.status(204).send();
}
app.post('/plain', postPlain);
`;
		const ir = scanTypeScriptSource(sourceText, "/virtual.ts");
		const spec = buildOpenApiSpecFromScan(ir);

		const getPlain = spec.paths?.["/plain"]?.get;

		const responseContent =
			getPlain?.responses?.["200"]?.content?.["text/plain"];

		expect(responseContent?.example).toBeUndefined();

		expect(responseContent?.examples?.example?.serializedValue).toBe("OK");

		const postPlain = spec.paths?.["/plain"]?.post;

		const requestContent = postPlain?.requestBody?.content?.["text/plain"];

		expect(requestContent?.example).toBeUndefined();

		expect(requestContent?.examples?.example?.externalValue).toBe(
			"./examples/request.txt",
		);
	});

	it("should preserve wrapped examples for querystring content parameters (fixture)", () => {
		const sourceText = fs.readFileSync(querystringExampleFixture, "utf-8");
		const ir = scanTypeScriptSource(sourceText, querystringExampleFixture);
		const spec = buildOpenApiSpecFromScan(ir);

		const rawQuery = spec.paths?.["/raw-query-example"]?.get;

		const param = rawQuery?.parameters?.find?.(
			(entry) => entry.in === "querystring",
		);

		const content = param?.content?.["application/x-www-form-urlencoded"];

		expect(content?.example).toBeUndefined();

		expect(content?.examples?.example?.serializedValue).toBe("foo=bar&baz=qux");

		expect(content?.encoding).toEqual({
			tags: { style: "pipeDelimited", explode: false },
		});
	});

	it("should apply JSDoc paramSchema overrides", () => {
		const sourceText = `
const app = { get: (..._args: string | number | boolean | object | undefined | null[]) => { void _args; } };
/**
 * Fetch a resource.
 * @paramSchema id {"type":"string","format":"uuid"}
 * @paramSchema search string
 * @paramSchema filter Filter
 */
function fetchResource(req: string | number | boolean | object | undefined | null, res: string | number | boolean | object | undefined | null) {
  const { id } = req.params;
  const search = req.query.search;
  const filter = req.query.filter;
  res.status(200).json({ id, search, filter });
}
app.get('/resources/:id', fetchResource);
`;
		const ir = scanTypeScriptSource(sourceText, "/virtual.ts");
		const spec = buildOpenApiSpecFromScan(ir);

		const op = spec.paths?.["/resources/{id}"]?.get;

		const idParam = op?.parameters?.find?.((param) => param.name === "id");

		const searchParam = op?.parameters?.find?.(
			(param) => param.name === "search",
		);

		const filterParam = op?.parameters?.find?.(
			(param) => param.name === "filter",
		);

		expect(idParam?.schema).toEqual({ type: "string", format: "uuid" });

		expect(searchParam?.schema).toEqual({ type: "string" });

		expect(filterParam?.schema).toEqual({
			$ref: "#/components/schemas/Filter",
		});
	});

	it("should ignore reserved header parameters when building specs (OAS 3.2)", () => {
		const sourceText = `
const app = { get: (..._args: string | number | boolean | object | undefined | null[]) => { void _args; } };
function headerHandler(req: string | number | boolean | object | undefined | null, res: string | number | boolean | object | undefined | null) {
  const accept = req.headers['accept'];
  const contentType = req.headers['content-type'];
  const auth = req.get('Authorization');
  const custom = req.headers['x-custom'];
  res.status(200).send({ accept, contentType, auth, custom });
}
app.get('/headers', headerHandler);
`;
		const ir = scanTypeScriptSource(sourceText, "/virtual.ts");
		const spec = buildOpenApiSpecFromScan(ir);

		const op = spec.paths?.["/headers"]?.get;

		const headerParams = (op?.parameters || []).filter(
			(param) => param.in === "header",
		);

		const headerNames = headerParams.map((param) =>
			String(param.name).toLowerCase(),
		);

		expect(headerNames).toEqual(["x-custom"]);
	});

	it("should scan directories, ignore excluded folders, and allow schema toggle", () => {
		const dir = makeTempDir();
		copyFixture(expressFixture, dir);
		copyFixture(decoratedFixture, dir);
		copyFixture(ignoredFixture, dir);

		const nodeModulesDir = path.join(dir, "node_modules");
		fs.mkdirSync(nodeModulesDir, { recursive: true });
		fs.writeFileSync(
			path.join(nodeModulesDir, "ignored.ts"),
			"import express from 'express'; const app = express(); app.get('/node', () => null);",
		);

		const customIgnoreDir = path.join(dir, "custom-ignore");
		fs.mkdirSync(customIgnoreDir, { recursive: true });
		fs.writeFileSync(
			path.join(customIgnoreDir, "ignored.ts"),
			"import express from 'express'; const app = express(); app.get('/custom', () => null);",
		);

		const ir = scanTypeScriptProject(dir, fs, {
			ignoreDirs: ["custom-ignore"],
		});
		const createOp = ir.operations.find((op) => op.operationId === "create");
		expect(createOp).toBeDefined();
		expect(createOp?.responses[0]?.status).toBe("201");
		expect(createOp?.requestBody?.contentTypes).toEqual(["application/json"]);
		expect(createOp?.requestBody?.schema).toEqual({
			$ref: "#/components/schemas/CreateWidget",
		});
		expect(createOp?.responses[0]?.schema).toEqual({
			$ref: "#/components/schemas/Widget",
		});
		const createParamKeys =
			createOp?.params.map((param) => `${param.in}:${param.name}`) ?? [];
		expect(createParamKeys).toEqual(
			expect.arrayContaining(["path:id", "query:mode", "header:X-Trace"]),
		);
		expect(ir.operations.some((op) => op.operationId === "list")).toBe(true);
		expect(ir.operations.some((op) => op.path === "/ignored")).toBe(false);
		expect(ir.operations.some((op) => op.path === "/node")).toBe(false);
		expect(ir.operations.some((op) => op.path === "/custom")).toBe(false);

		const fileIr = scanTypeScriptProject(
			path.join(dir, "express.routes.ts"),
			fs,
			{ includeSchemas: false },
		);
		expect(fileIr.operations.length).toBeGreaterThan(0);
		expect(fileIr.schemas).toEqual({});
	});

	it("should build an OpenAPI spec from the scan output", () => {
		const sourceText = fs.readFileSync(expressFixture, "utf-8");
		const ir = scanTypeScriptSource(sourceText, expressFixture);
		const spec = buildOpenApiSpecFromScan(ir, {
			title: "AST Scan",
			version: "1.2.3",
		});

		expect(spec.openapi).toBe("3.2.0");
		expect(spec.jsonSchemaDialect).toBe(OAS_3_1_DIALECT);
		expect(spec.info.title).toBe("AST Scan");
		expect(spec.info.version).toBe("1.2.3");

		const getUser = spec.paths?.["/users/{id}"]?.get;

		expect(getUser?.operationId).toBe("getUser");

		expect(
			getUser?.parameters?.some?.(
				(param) => param.name === "id" && param.in === "path",
			),
		).toBe(true);

		expect(getUser?.tags).toEqual(["Users", "Accounts"]);
		expect(spec.tags?.map((tag) => tag.name)).toEqual(["Users", "Accounts"]);
		const usersTag = spec.tags?.find((tag) => tag.name === "Users");
		expect(usersTag?.summary).toBe("User operations");
		expect(usersTag?.kind).toBe("nav");

		const search = spec.paths?.["/search"]?.query;

		expect(search).toBeDefined();

		const rawQuery = spec.paths?.["/raw-query"]?.get;

		expect(rawQuery?.parameters).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "rawQuery",
					in: "querystring",
					content: {
						"application/x-www-form-urlencoded": { schema: { type: "object" } },
					},
				}),
			]),
		);

		const copyPath = spec.paths?.["/files/{id}"];

		expect(copyPath?.additionalOperations?.COPY).toBeDefined();

		const messages = spec.paths?.["/messages"]?.post;

		expect(messages?.requestBody?.content?.["application/json"]).toBeDefined();

		expect(messages?.responses?.["200"]?.content?.["text/plain"]).toBeDefined();

		const typedMessages = spec.paths?.["/typed-messages"]?.post;

		expect(
			typedMessages?.requestBody?.content?.["application/json"]?.schema,
		).toEqual({
			$ref: "#/components/schemas/CreateMessageBody",
		});

		expect(
			typedMessages?.responses?.["201"]?.content?.["application/json"]?.schema,
		).toEqual({
			$ref: "#/components/schemas/MessageReceipt",
		});

		const secure = spec.paths?.["/secure"]?.get;

		expect(secure?.externalDocs).toEqual({
			url: "https://example.com/secure",
			description: "Secure docs",
		});

		expect(secure?.servers).toEqual([
			{
				url: "https://api.example.com/v2",
				description: "Production",
				name: "prod",
				variables: { version: { default: "v2" } },
			},
			{ url: "https://staging.example.com/v2", description: "Staging" },
		]);

		expect(secure?.security).toEqual([
			{ ApiKey: [] },
			{ OAuth2: ["read:items", "write:items"] },
		]);

		expect(secure?.["x-feature-flag"]).toBe("beta");

		const documented = spec.paths?.["/documented/{id}"]?.get;

		expect(documented?.operationId).toBe("fetchDocumented");

		const documentedParam = documented?.parameters?.find?.(
			(param) => param.name === "id",
		);

		expect(documentedParam?.description).toBe("Documented id.");

		expect(documented?.responses?.["202"]?.summary).toBe("Accepted summary");

		expect(documented?.responses?.["202"]?.description).toBe(
			"Accepted payload",
		);

		expect(
			documented?.responses?.["202"]?.content?.["application/json"],
		).toBeDefined();

		expect(
			documented?.responses?.["404"]?.content?.["text/plain"],
		).toBeDefined();

		expect(spec.components?.schemas).toHaveProperty("CreateMessage");

		const customSpec = buildOpenApiSpecFromScan(
			{
				operations: [
					{
						operationId: "copyThing",
						method: "COPY",
						path: "/things/{id}",
						filePath: path.join(os.tmpdir(), "copy.ts"),
						params: [{ name: "id", in: "path", required: true }],
						requestBody: { required: false, contentTypes: [] },
						responses: [],
					},
					{
						operationId: "uploadBinary",
						method: "POST",
						path: "/upload",
						filePath: path.join(os.tmpdir(), "upload.ts"),
						params: [],
						requestBody: {
							required: true,
							contentTypes: [
								"multipart/form-data",
								"application/octet-stream",
								"application/unknown",
							],
						},
						responses: [
							{ status: "200", contentTypes: ["application/octet-stream"] },
						],
					},
				],
				schemas: {},
				sources: [],
			},
			{ title: "Custom", version: "0.1.0" },
		);

		const customPath = customSpec.paths?.["/things/{id}"];

		expect(customPath?.additionalOperations?.COPY).toBeDefined();

		expect(
			customPath?.additionalOperations?.COPY?.responses?.["200"],
		).toBeDefined();

		const uploadPath = customSpec.paths?.["/upload"]?.post;

		expect(
			uploadPath?.requestBody?.content?.["multipart/form-data"],
		).toBeDefined();

		expect(
			uploadPath?.requestBody?.content?.["application/octet-stream"],
		).toBeDefined();
	});

	it("should throw when no routes are discovered", () => {
		const dir = makeTempDir();
		fs.writeFileSync(path.join(dir, "empty.ts"), "export const x = 1;");
		expect(() => scanTypeScriptProject(dir, fs)).toThrow(
			/No route handlers found/,
		);
		expect(() =>
			scanTypeScriptSource(
				"export const x = 1;",
				path.join(os.tmpdir(), "empty.ts"),
			),
		).toThrow(/No route handlers found/);

		const emptyDir = makeTempDir();
		const ignoredDir = path.join(emptyDir, "node_modules");
		fs.mkdirSync(ignoredDir, { recursive: true });
		fs.writeFileSync(
			path.join(ignoredDir, "ignored.ts"),
			"export const y = 2;",
		);
		expect(() => scanTypeScriptProject(emptyDir, fs)).toThrow(
			/No TypeScript source files found/,
		);

		const badFile = path.join(emptyDir, "not-source.txt");
		fs.writeFileSync(badFile, "noop");
		expect(() => scanTypeScriptProject(badFile, fs)).toThrow(
			/Expected a TypeScript source file/,
		);
	});

	it("should cover remaining JSDoc and Express/decorator route scanner branches", async () => {
		const sourceText = `
const app = {
	get: (..._args: unknown[]) => { void _args; },
	post: (..._args: unknown[]) => { void _args; },
	other: (..._args: unknown[]) => ({ get: (..._a: unknown[]) => { void _a; } }),
};
const notFn = 123;
const idSegment = 'seg';
function helperCall(paramCb?: unknown) {
	if (paramCb) app.get('/param-cb', paramCb);
}
app.other('/ignored').get(() => {});
app.get('/no-handler', [notFn]);

type Request<P = unknown, ResB = unknown, ReqB = unknown, Q = unknown> = {
	params: P;
	query: Q;
	headers: Record<string, string>;
	cookies: Record<string, string>;
	body: ReqB;
};
type Response<ResB = unknown> = {
	status: (c?: number) => Response<ResB>;
	type: (t?: string) => Response<ResB>;
	set: (k?: string, v?: string) => Response<ResB>;
	header: (k?: string, v?: string) => Response<ResB>;
	cookie: (k?: string, v?: string) => Response<ResB>;
	send: (v?: ResB) => void;
	json: (v?: ResB) => void;
	end: () => void;
	sendStatus: (c?: number) => void;
};

/**
 * Summary line
 * @tags ["TagA", "", 123, {"name":"MergedTag","description":"First"}, {"name":""}]
 * @server {invalid-json
 * @server [{"url":"https://srv1.com"}, {"url":""}, 123]
 * @security [{"Bearer":["read"]}, 123]
 * @security {"ApiKey":[]}
 * @querystring {"name":"qsJson","required":true,"description":"QS json"}
 * @paramExample qsJson "raw=1"
 * @paramExample h1 {"__oasExample":{"serializedValue":"ser-h1"}}
 * @requestExample {"wildcardReq":true}
 * @responseExample 200 {"noMediaResp":true}
 * @responseExample 200 text/xml <xml/>
 * @responseSummary 201 Standalone 201 summary
 * @paramSchema h1 true
 * @paramSchema h2 https://example.com/schema.json
 * @paramSchema c1 !invalid!
 * @paramSchema c2 123
 */
function boundHeadersAndCookies(
	{ headers, cookies, body, params: renamedParams, unknownProp }: {
		headers: Record<string, string>;
		cookies: Record<string, string>;
		body: Record<string, string>;
		params: Record<string, string>;
		unknownProp: string;
	},
	res: Response
) {
	const dyn = "dyn";
	const h1 = headers.h1;
	const h2 = headers["h2"];
	const hDyn = headers[dyn];
	const c1 = cookies.c1;
	const c2 = cookies["c2"];
	const p1 = renamedParams.id;
	const { destructuredBody } = body;
	const { nonReq } = { nonReq: 1 };
	helperCall();
	void h1; void h2; void hDyn; void c1; void c2; void p1; void destructuredBody; void unknownProp; void nonReq;
	[1].map((x) => x)[0]?.toString();
	res.cookie("k", "v").status().type().set("X-Other", "1").header("Content-Type").send(123);
	res.status(200).json({ ok: true });
	res.sendStatus();
}
app.post(\`/\${idSegment}/\${'lit'}/\${1 + 2}\`, [notFn, boundHeadersAndCookies]);

/**
 * @tag {"name":"MergedTag","externalDocs":{"url":"https://docs.example.com"}}
 * @querystring qsSpace required Space QS
 * @see https://only-url.example.com
 * @server https://only-server.example.com
 * @x-empty-ext
 * @requestExample text/xml <xml/>
 * @responseExample 200 text/xml <xml/>
 * @response 200
 * @response 202 application/json Extra typed response
 * @param x
 */
const propHandler = (
	req: Request<unknown, { id: string }, void>,
	res: Response<{ id: string }>
) => {
	const { x } = (req.body as unknown as Record<string, string>);
	void x;
	res.end();
};
app.post('/prop-handler', propHandler);

/**
 * @querystring {"name": "qsMinimal"}
 * @see
 */
function invalidQs() {
	helperCall();
}
app.get('/invalid-qs', invalidQs);

/**
 * @querystring {"noName": true}
 */
function badQs(_req: Request, { send }: Response) {
	send();
}
app.get('/one-param', badQs);

function Controller(_p?: string): ClassDecorator { return () => undefined; }
function Get(_p?: string): MethodDecorator { return () => undefined; }
function Post(_p?: string): MethodDecorator { return () => undefined; }
function Cookie(_p?: string): ParameterDecorator { return () => undefined; }
function Query(_p?: string): ParameterDecorator { return () => undefined; }
function Body(): ParameterDecorator { return () => undefined; }
function HttpCode(_c?: number): MethodDecorator { return () => undefined; }

@Controller()
export class ExtraController {
	/**
	 * @response 204
	 */
	@Get()
	@HttpCode()
	voidRet(@Cookie('sid') _sid: string, @Query() _bareQ?: string): string {
		return "ok";
	}

	@Get('resp-ret')
	respRet(): Promise<Response<string>> {
		return Promise.resolve({} as Response<string>);
	}

	/**
	 * @response 201 application/json Created
	 */
	@Post('prim-body')
	primBody(@Body() _body?: String): Promise<Number> {
		return Promise.resolve(1);
	}

	@Post('untyped-body')
	untypedBody(@Body() _body: unknown) {}

	/**
	 * @response 200 application/json JSON response
	 * @responseExample 200 text/plain "unmatched"
	 */
	@Get('unmatched-resp-example')
	unmatchedRespExample(): { ok: boolean } {
		return { ok: true };
	}
}
`;
		const ir = scanTypeScriptSource(sourceText, "/extra.ts");
		const spec = buildOpenApiSpecFromScan(ir);
		expect(spec.paths).toBeDefined();
		expect(spec.tags?.some((t) => t.name === "MergedTag")).toBe(true);

		const { Project, SyntaxKind } = await import("ts-morph");
		const { evaluateAstLiteral } = await import(
			"@src/openapi/parse_ast_literal.js"
		);
		const malformedProject = new Project({ useInMemoryFileSystem: true });
		const malformedSf = malformedProject.createSourceFile(
			"/malformed.ts",
			"const x = { a: };",
		);
		const objLit = malformedSf.getFirstDescendantByKindOrThrow(
			SyntaxKind.ObjectLiteralExpression,
		);
		expect(evaluateAstLiteral(objLit)).toBeUndefined();
	});
});
