import type { GeneratorConfig } from "@src/core/types/index.js";
import {
	buildOperationMethodDocs,
	filterMediaTypes,
} from "@src/functions/emit_operation_jsdoc.js";
import type { ServiceMethodModel } from "@src/functions/types.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { ServiceMethodGenerator } from "@src/vendors/angular/service/service-method.generator.js";
import { Project } from "ts-morph";
import { describe, expect, it, vi } from "vitest";
import {
	createTestConfig,
	createTestOperation,
	createTestSpec,
} from "../shared/helpers.js";

describe("Emitter: ServiceMethodGenerator (Coverage)", () => {
	const config: GeneratorConfig = createTestConfig({
		input: "",
		output: "/out",
		options: { dateType: "string", enumStyle: "enum" },
	});

	it("should include docs when provided", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "doThing",
			httpMethod: "GET",
			urlTemplate: "/do",
			docs: "Doc string",
			isDeprecated: false,
			parameters: [],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const sourceFile = project.createSourceFile("/out/service.ts", "", {
			overwrite: true,
		});
		const classDeclaration = sourceFile.addClass({ name: "TestService" });

		vi.spyOn(generator.analyzer, "analyze").mockReturnValue(model);
		generator.addServiceMethod(
			classDeclaration,
			createTestOperation({ methodName: "doThing" }),
		);

		const docs = classDeclaration.getMethodOrThrow("doThing").getJsDocs();
		expect(docs[0]?.getText()).toContain("Doc string");
	});

	it("should emit @operationId when provided on the operation", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "doThing",
			httpMethod: "GET",
			urlTemplate: "/do",
			docs: "Doc string",
			isDeprecated: false,
			parameters: [],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const sourceFile = project.createSourceFile("/out/service.ts", "", {
			overwrite: true,
		});
		const classDeclaration = sourceFile.addClass({ name: "TestService" });

		vi.spyOn(generator.analyzer, "analyze").mockReturnValue(model);
		generator.addServiceMethod(
			classDeclaration,
			createTestOperation({
				methodName: "doThing",
				operationId: "getThing",
			}),
		);

		const docText = classDeclaration
			.getMethodOrThrow("doThing")
			.getJsDocs()[0]
			?.getText();
		expect(docText).toContain("@operationId getThing");
	});

	it("should emit operation metadata tags for reverse generation", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const spec = {
			openapi: "3.2.0",
			info: { title: "T", version: "1" },
			components: {
				securitySchemes: {
					ApiKey: { type: "apiKey", in: "header", name: "X-API-KEY" },
				},
			},
			paths: {
				"/items": {
					get: {
						operationId: "listItems",
						tags: ["items", "admin"],
						externalDocs: {
							url: "https://example.com/items",
							description: "Item docs",
						},
						servers: [
							{
								url: "https://api.example.com/v1",
								description: "primary",
								name: "prod",
								variables: {
									region: { default: "us" },
								},
							},
						],
						security: [{ ApiKey: [] }],
						parameters: [
							{
								name: "qs",
								in: "querystring",
								required: true,
								description: "Filter",
								content: {
									"application/x-www-form-urlencoded": {
										schema: { type: "object" },
									},
								},
							},
						],
						"x-feature-flag": "beta",
						responses: { "200": { description: "ok" } },
					},
				},
			},
		};
		const parser = new SwaggerParser(createTestSpec(spec), config);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "listItems",
			httpMethod: "GET",
			urlTemplate: "/items",
			isDeprecated: false,
			parameters: [],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const sourceFile = project.createSourceFile("/out/service.ts", "", {
			overwrite: true,
		});
		const classDeclaration = sourceFile.addClass({ name: "TestService" });

		vi.spyOn(generator.analyzer, "analyze").mockReturnValue(model);
		generator.addServiceMethod(
			classDeclaration,
			parser.operations[0] as (typeof parser.operations)[number],
		);

		const docText = classDeclaration
			.getMethodOrThrow("listItems")
			.getJsDocs()[0]
			?.getText();
		expect(docText).toContain("@tags items, admin");
		expect(docText).toContain("@see https://example.com/items Item docs");
		expect(docText).toContain('@server [{"url":"https://api.example.com/v1"');
		expect(docText).toContain('@security [{"ApiKey":[]}'); // order stable via JSON.stringify
		expect(docText).toContain('@x-feature-flag "beta"');
		expect(docText).toContain(
			'@querystring {"name":"qs","contentType":"application/x-www-form-urlencoded","required":true,"description":"Filter"}',
		);
	});

	it("should emit example tags for parameters, request bodies, and responses", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const spec = {
			openapi: "3.2.0",
			info: { title: "T", version: "1" },
			paths: {
				"/items/{id}": {
					post: {
						operationId: "createItem",
						parameters: [
							{
								name: "id",
								in: "path",
								required: true,
								example: "abc",
								schema: { type: "string" },
							},
							{
								name: "limit",
								in: "query",
								example: 10,
								schema: { type: "integer" },
							},
						],
						requestBody: {
							content: {
								"application/json": {
									example: { name: "Widget" },
								},
							},
						},
						responses: {
							"200": {
								description: "ok",
								content: {
									"application/json": {
										example: { id: 1 },
									},
								},
							},
						},
					},
				},
			},
		};
		const parser = new SwaggerParser(createTestSpec(spec), config);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "createItem",
			httpMethod: "POST",
			urlTemplate: "/items/{id}",
			isDeprecated: false,
			parameters: [
				{ name: "id", type: "string" },
				{ name: "limit", type: "number", hasQuestionToken: true },
				{
					name: "body",
					type: "string | number | boolean | object | undefined | null",
				},
			],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const sourceFile = project.createSourceFile("/out/service.ts", "", {
			overwrite: true,
		});
		const classDeclaration = sourceFile.addClass({ name: "TestService" });

		vi.spyOn(generator.analyzer, "analyze").mockReturnValue(model);
		generator.addServiceMethod(
			classDeclaration,
			parser.operations[0] as (typeof parser.operations)[number],
		);

		const docText = classDeclaration
			.getMethodOrThrow("createItem")
			.getJsDocs()[0]
			?.getText();
		expect(docText).toContain('@paramExample id "abc"');
		expect(docText).toContain("@paramExample limit 10");
		expect(docText).toContain(
			'@requestExample application/json {"name":"Widget"}',
		);
		expect(docText).toContain('@responseExample 200 application/json {"id":1}');
	});

	it("should prefer serializedValue examples for non-JSON media types", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const spec = {
			openapi: "3.2.0",
			info: { title: "T", version: "1" },
			paths: {
				"/text": {
					get: {
						operationId: "getText",
						responses: {
							"200": {
								description: "ok",
								content: {
									"text/plain": {
										examples: {
											sample: {
												dataValue: "raw-value",
												serializedValue: "SERIALIZED-VALUE",
											},
										},
									},
								},
							},
						},
					},
				},
			},
			components: {},
		};
		const parser = new SwaggerParser(createTestSpec(spec), config);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "getText",
			httpMethod: "GET",
			urlTemplate: "/text",
			isDeprecated: false,
			parameters: [],
			responseType: "string",
			responseSerialization: "text",
			responseVariants: [
				{
					mediaType: "text/plain",
					type: "string",
					serialization: "text",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const sourceFile = project.createSourceFile("/out/service.ts", "", {
			overwrite: true,
		});
		const classDeclaration = sourceFile.addClass({ name: "TestService" });

		vi.spyOn(generator.analyzer, "analyze").mockReturnValue(model);
		generator.addServiceMethod(
			classDeclaration,
			parser.operations[0] as (typeof parser.operations)[number],
		);

		const docText = classDeclaration
			.getMethodOrThrow("getText")
			.getJsDocs()[0]
			?.getText();
		expect(docText).toContain(
			'@responseExample 200 text/plain {"__oasExample":{"serializedValue":"SERIALIZED-VALUE"}}',
		);
		expect(docText).not.toContain("raw-value");
	});

	it("should widen return type when multiple success response types exist", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.2.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "getMulti",
			httpMethod: "GET",
			urlTemplate: "/multi",
			isDeprecated: false,
			parameters: [],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
				{
					mediaType: "application/json",
					type: "number",
					serialization: "json",
					isDefault: false,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const sourceFile = project.createSourceFile("/out/service.ts", "", {
			overwrite: true,
		});
		const classDeclaration = sourceFile.addClass({ name: "TestService" });

		vi.spyOn(generator.analyzer, "analyze").mockReturnValue(model);
		generator.addServiceMethod(
			classDeclaration,
			createTestOperation({ methodName: "getMulti" }),
		);

		const returnType =
			classDeclaration
				.getMethodOrThrow("getMulti")
				.getReturnTypeNode()
				?.getText() ??
			classDeclaration.getMethodOrThrow("getMulti").getReturnType().getText();
		expect(
			returnType.replace(/ \| null \| undefined| \| undefined \| null/g, ""),
		).toContain("Observable<string | number | boolean | object>");
	});

	it("should emit @response tags when responses are defined", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "withResponses",
			httpMethod: "GET",
			urlTemplate: "/with-responses",
			docs: "Doc string",
			isDeprecated: false,
			parameters: [],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const sourceFile = project.createSourceFile("/out/service.ts", "", {
			overwrite: true,
		});
		const classDeclaration = sourceFile.addClass({ name: "TestService" });

		vi.spyOn(generator.analyzer, "analyze").mockReturnValue(model);
		generator.addServiceMethod(
			classDeclaration,
			createTestOperation({
				methodName: "withResponses",
				responses: {
					"200": {
						summary: "Success payload",
						description: "OK",
						content: {
							"application/json": { schema: { type: "string" } },
							"text/plain": { schema: { type: "string" } },
						},
					},
					"404": {
						description: "Not found",
					},
				},
			}),
		);

		const docText = classDeclaration
			.getMethodOrThrow("withResponses")
			.getJsDocs()[0]
			?.getText();
		expect(docText).toContain("@response 200 application/json OK");
		expect(docText).toContain("@response 200 text/plain OK");
		expect(docText).toContain("@response 404 Not found");
		expect(docText).toContain("@responseSummary 200 Success payload");
	});

	it("should omit docs when none are provided", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "noDocs",
			httpMethod: "GET",
			urlTemplate: "/nodocs",
			docs: "",
			isDeprecated: false,
			parameters: [],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const sourceFile = project.createSourceFile("/out/service.ts", "", {
			overwrite: true,
		});
		const classDeclaration = sourceFile.addClass({ name: "TestService" });

		vi.spyOn(generator.analyzer, "analyze").mockReturnValue(model);
		generator.addServiceMethod(
			classDeclaration,
			createTestOperation({ methodName: "noDocs" }),
		);

		expect(classDeclaration.getMethodOrThrow("noDocs").getJsDocs().length).toBe(
			0,
		);
	});

	it("should generate body logic for xml, json-seq, json-lines, and decoding variants", () => {
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "custom",
			httpMethod: "CUSTOM",
			urlTemplate: "/custom",
			isDeprecated: false,
			parameters: [
				{
					name: "payload",
					type: "string | number | boolean | object | undefined | null",
				},
				{ name: "qs", type: "string" },
				{ name: "hdr", type: "string" },
				{ name: "cookie", type: "string" },
			],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					decodingConfig: { foo: "bar" },
					isDefault: true,
				},
				{
					mediaType: "application/xml",
					type: "string",
					serialization: "xml",
					xmlConfig: { name: "Root" },
					isDefault: false,
				},
				{
					mediaType: "application/json-seq",
					type: "(string | number | boolean | object | undefined | null)[]",
					serialization: "json-seq",
					isDefault: false,
				},
				{
					mediaType: "application/json-lines",
					type: "(string | number | boolean | object | undefined | null)[]",
					serialization: "json-lines",
					isDefault: false,
				},
				{
					mediaType: "application/custom",
					type: "string",
					serialization: "json",
					decodingConfig: { baz: true },
					isDefault: false,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [
				{
					paramName: "hdr",
					originalName: "X-Hdr",
					explode: false,
					allowReserved: false,
					serializationLink: "json",
				},
			],
			cookieParams: [
				{
					paramName: "cookie",
					originalName: "sid",
					style: "form",
					explode: true,
					allowReserved: false,
					serializationLink: "json",
				},
			],
			body: { type: "xml", paramName: "payload", rootName: "Root", config: {} },
			security: [],
			extensions: {},
			hasServers: false,
		};

		const rawOp = {
			path: "/custom",
			method: "CUSTOM",
			parameters: [
				{
					name: "qs",
					in: "querystring",
					schema: { type: "string" },
					content: { "application/json": { schema: { type: "string" } } },
				},
			],
		};

		const body = generator.emitMethodBody(
			model,
			createTestOperation(rawOp),
			false,
			true,
		);

		expect(body).toContain("serializeRawQuerystring(qs, 'json')");

		expect(body).toContain("serializeHeaderParam(hdr, false, 'json')");

		expect(body).toContain(
			"serializeCookieParam('sid', cookie, 'form', true, false, 'json')",
		);

		expect(body).toContain("XmlBuilder.serialize(payload, 'Root'");

		expect(body).toContain(
			"this.http.request<string | number | boolean | object | undefined | null>('CUSTOM', url, { ...requestOptions, body: xmlBody } as Record<string, string | number | boolean | object | undefined | null>)",
		);

		expect(body).toContain("response.split('\\x1e')");

		expect(body).toContain("response.split('\\n')");

		expect(body).toContain("ContentDecoder.decode(response");
	});

	it("should omit json hints for querystring and header params when not using json serialization", () => {
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "noJsonHints",
			httpMethod: "GET",
			urlTemplate: "/qs",
			isDeprecated: false,
			parameters: [
				{ name: "qs", type: "string" },
				{ name: "hdr", type: "string" },
			],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [
				{
					paramName: "hdr",
					originalName: "X-Hdr",
					explode: false,
					allowReserved: false,
				},
			],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const rawOp = {
			path: "/qs",
			method: "GET",
			parameters: [
				{ name: "qs", in: "querystring", schema: { type: "string" } },
			],
		};

		const body = generator.emitMethodBody(
			model,
			createTestOperation(rawOp),
			false,
			false,
		);

		expect(body).toContain("serializeRawQuerystring(qs)");

		expect(body).not.toContain("serializeRawQuerystring(qs, 'json')");

		expect(body).toContain("serializeHeaderParam(hdr, false)");

		expect(body).not.toContain("serializeHeaderParam(hdr, false, 'json')");
	});

	it("should keep responseType as options when content negotiation has no xml/seq variants", () => {
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "negotiated",
			httpMethod: "GET",
			urlTemplate: "/neg",
			isDeprecated: false,
			parameters: [],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
				{
					mediaType: "application/problem+json",
					type: "string",
					serialization: "json",
					isDefault: false,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const rawOp = { path: "/neg", method: "GET" };

		const body = generator.emitMethodBody(
			model,
			createTestOperation(rawOp),
			false,
			true,
		);

		expect(body).toContain("const acceptHeader = headers.get('Accept');");

		expect(body).toContain("responseType: options?.responseType");

		expect(body).not.toContain("? 'text' :");
	});

	it("should default responseType to blob for binary responses", () => {
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.2.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "download",
			httpMethod: "GET",
			urlTemplate: "/download",
			isDeprecated: false,
			parameters: [],
			responseType: "Blob",
			responseSerialization: "blob",
			responseVariants: [
				{
					mediaType: "application/pdf",
					type: "Blob",
					serialization: "blob",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const rawOp = { path: "/download", method: "GET" };

		const body = generator.emitMethodBody(
			model,
			createTestOperation(rawOp),
			false,
			false,
		);

		expect(body).toContain("responseType: 'blob'");
	});

	it("should leave body null for unsupported body types", () => {
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "weird",
			httpMethod: "POST",
			urlTemplate: "/weird",
			isDeprecated: false,
			parameters: [
				{
					name: "payload",
					type: "string | number | boolean | object | undefined | null",
				},
			],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			body: { type: "encoded-form-data", paramName: "payload", mappings: [] },
			security: [],
			extensions: {},
			hasServers: false,
		};

		const rawOp = { path: "/weird", method: "POST" };

		const body = generator.emitMethodBody(
			model,
			createTestOperation(rawOp),
			false,
			false,
		);

		expect(body).toContain(
			"this.http.post<string | number | boolean | object | undefined | null>(url, null, requestOptions as object)",
		);
	});

	it("should set Content-Type when requestContentType is provided", () => {
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const model: ServiceMethodModel = {
			methodName: "sendText",
			httpMethod: "POST",
			urlTemplate: "/text",
			isDeprecated: false,
			parameters: [{ name: "payload", type: "string" }],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			body: { type: "raw", paramName: "payload" },
			requestContentType: "text/plain",
			security: [],
			extensions: {},
			hasServers: false,
		};

		const rawOp = { path: "/text", method: "POST" };

		const body = generator.emitMethodBody(
			model,
			createTestOperation(rawOp),
			false,
			false,
		);

		expect(body).toContain(
			"headers = headers.set('Content-Type', 'text/plain')",
		);

		expect(body).toContain("requestOptions = { ...requestOptions, headers };");
	});

	it("should fall back to string | number | boolean | object | undefined | null when responseType is empty", () => {
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.0.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		const overloads = generator.emitOverloads(
			"doThing",
			"",
			[],
			false,
			false,
			[
				{
					mediaType: "application/json",
					type: "string | number | boolean | object | undefined | null",
					serialization: "json",
					isDefault: true,
				},
			],
			"",
		);

		expect(overloads[0]?.returnType).toContain(
			"Record<string, string | number | boolean | object | undefined | null>",
		);
	});

	it("should handle binary content negotiation, SSE with body and decoding, and advanced param/body encoders", () => {
		const parser = new SwaggerParser(
			createTestSpec({
				openapi: "3.2.0",
				info: { title: "T", version: "1" },
				paths: {},
			}),
			config,
		);
		const generator = new ServiceMethodGenerator(config, parser);

		// 1. Binary content negotiation (only binary + json, no xml/seq)
		const binaryNegModel: ServiceMethodModel = {
			methodName: "negBinary",
			httpMethod: "GET",
			urlTemplate: "/neg-bin/{id}",
			isDeprecated: false,
			parameters: [{ name: "id", type: "string" }],
			responseType: "Blob",
			responseSerialization: "blob",
			responseVariants: [
				{
					mediaType: "application/pdf",
					type: "Blob",
					serialization: "blob",
					isDefault: true,
				},
				{
					mediaType: "application/json",
					type: "string",
					serialization: "json",
					isDefault: false,
				},
			],
			errorResponses: [],
			pathParams: [
				{
					paramName: "id",
					originalName: "id",
					explode: false,
					allowReserved: false,
					contentEncoderConfig: { encode: true },
				},
			],
			queryParams: [
				{
					paramName: "qs",
					originalName: "qs",
					explode: true,
					allowReserved: false,
					contentEncoderConfig: { encode: true },
				},
			],
			headerParams: [
				{
					paramName: "h1",
					originalName: "X-H1",
					explode: false,
					allowReserved: false,
					contentType: "application/x-www-form-urlencoded",
					encoding: { a: { style: "form" } },
					contentEncoderConfig: { encode: true },
				},
				{
					paramName: "h2",
					originalName: "X-H2",
					explode: false,
					allowReserved: false,
					contentEncoderConfig: { encode: true },
				},
			],
			cookieParams: [
				{
					paramName: "c1",
					originalName: "c1",
					explode: true,
					allowReserved: false,
					contentEncoderConfig: { encode: true },
				},
			],
			security: [],
			extensions: {},
			hasServers: false,
		};

		const binRawOp = {
			path: "/neg-bin/{id}",
			method: "GET",
			parameters: [
				{
					name: "qs",
					in: "querystring",
					content: { "text/plain": { schema: { type: "string" } } },
				},
			],
		};
		const binBody = generator.emitMethodBody(
			binaryNegModel,
			createTestOperation(binRawOp),
			false,
			true,
		);
		expect(binBody).toContain("acceptHeader?.includes('application/pdf')");
		expect(binBody).toContain("? 'blob' : (false) ? 'text'");

		// 2. SSE with bodyArgument !== "null", responseDecodingConfig, and undefined sseMode
		const sseBodyModel: ServiceMethodModel = {
			methodName: "ssePost",
			httpMethod: "POST",
			urlTemplate: "/sse",
			isDeprecated: false,
			parameters: [{ name: "payload", type: "string" }],
			responseType: "string",
			responseSerialization: "sse",
			responseDecodingConfig: { contentEncoding: "base64" },
			responseVariants: [
				{
					mediaType: "text/event-stream",
					type: "string",
					serialization: "sse",
					isDefault: true,
				},
			],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			body: { type: "urlencoded", paramName: "payload", config: {} },
			requestEncodingConfig: { encode: true },
			security: [],
			extensions: {},
			hasServers: false,
		};
		const sseBody = generator.emitMethodBody(
			sseBodyModel,
			createTestOperation({ path: "/sse", method: "POST" }),
			true,
			false,
		);
		expect(sseBody).toContain("const sseDecodingConfig =");
		expect(sseBody).toContain("fetchOptions.body = formBody");
		expect(sseBody).toContain(
			"payload = ContentDecoder.decode(payload, sseDecodingConfig);",
		);

		// 3. Legacy formData with application/x-www-form-urlencoded and json-seq with requestEncodingConfig
		const legacyFormModel: ServiceMethodModel = {
			methodName: "legacyForm",
			httpMethod: "POST",
			urlTemplate: "/legacy",
			isDeprecated: false,
			parameters: [{ name: "fieldA", type: "string" }],
			responseType: "string",
			responseSerialization: "json",
			responseVariants: [],
			errorResponses: [],
			pathParams: [],
			queryParams: [],
			headerParams: [],
			cookieParams: [],
			security: [],
			extensions: {},
			hasServers: false,
		};
		const legacyBody = generator.emitMethodBody(
			legacyFormModel,
			createTestOperation({
				path: "/legacy",
				method: "POST",
				consumes: ["application/x-www-form-urlencoded"],
				parameters: [{ name: "field_a", in: "formData", type: "string" }],
			}),
			false,
			false,
		);
		expect(legacyBody).toContain(
			"formBody = formBody.append('field_a', fieldA)",
		);

		const legacyMultiBody = generator.emitMethodBody(
			legacyFormModel,
			createTestOperation({
				path: "/legacy-multi",
				method: "POST",
				consumes: ["multipart/form-data"],
				parameters: [{ name: "field_a", in: "formData", type: "string" }],
			}),
			false,
			false,
		);
		expect(legacyMultiBody).toContain("formData.append('field_a', fieldA)");

		const seqEncModel: ServiceMethodModel = {
			...legacyFormModel,
			body: { type: "json-seq", paramName: "fieldA" },
			requestEncodingConfig: { encode: true },
		};
		const seqEncBody = generator.emitMethodBody(
			seqEncModel,
			createTestOperation({ path: "/seq", method: "POST" }),
			false,
			false,
		);
		expect(seqEncBody).toContain(
			"jsonSeqBody = ContentEncoder.encode(jsonSeqBody",
		);

		// 4. filterMediaTypes and buildOperationMethodDocs edge cases
		expect(
			filterMediaTypes([
				"",
				"text/*",
				"*/json",
				"application/json",
				"application/json",
			]),
		).toEqual(["text/*", "application/json"]);

		const jsdocParser = new SwaggerParser(
			createTestSpec({
				openapi: "3.2.0",
				info: { title: "T", version: "1" },
				paths: {
					"/custom-add": {
						additionalOperations: {
							OTHER: {
								responses: { "200": { description: "ok" } },
							},
						},
					},
					"/no-add": {
						get: {
							responses: { "200": { description: "ok" } },
						},
					},
				},
			}),
			config,
		);
		const docs = buildOperationMethodDocs(
			createTestOperation({
				path: "/custom-add",
				method: "LOCK",
				externalDocs: { url: "https://example.com/no-desc" },
				parameters: [
					{
						name: "p1",
						in: "query",
						examples: {
							ex1: { externalValue: "https://example.com/ex.json" },
						},
					},
					{
						name: "p2",
						in: "query",
						examples: {
							exEmpty: {},
						},
						schema: {
							examples: ["fromSchemaArray"],
						},
					},
					{
						name: "p3",
						in: "query",
						examples: {
							exPrim: "primitive",
						},
						schema: {
							example: "fromSchemaDirect",
						},
					},
					{
						name: "p4",
						in: "query",
						content: {
							"text/plain": {
								examples: {
									exSer: { serializedValue: "ser-val" },
								},
							},
						},
					},
					{
						name: "p5",
						in: "query",
						content: {
							"text/plain": {
								examples: {
									exEmpty: {},
								},
							},
						},
					},
					{
						name: "qs",
						in: "querystring",
					},
				],
				requestBody: {
					description: "Body desc",
					content: {
						"application/json": {
							examples: {
								exVal: { value: { a: 1 } },
							},
						},
					},
				},
				responses: {
					"200": {
						description: "",
						content: {
							"application/json": {
								examples: {
									exData: { dataValue: { b: 2 } },
								},
							},
						},
					},
					"204": {
						description: "",
					},
				},
			}),
			{
				...legacyFormModel,
				docs: "",
				parameters: [
					{ name: "p1", type: "string" },
					{ name: "p2", type: "string" },
					{ name: "p3", type: "string" },
					{ name: "p4", type: "string" },
					{ name: "p5", type: "string" },
					{ name: "qs", type: "string" },
					{ name: "body", type: "object" },
				],
			},
			jsdocParser,
		);
		expect(docs[0]).toContain("@paramExample p1");
		expect(docs[0]).toContain("@paramExample p2");
		expect(docs[0]).toContain("@paramExample p3");
		expect(docs[0]).toContain("@paramExample p4");

		const missingPathDocs = buildOperationMethodDocs(
			createTestOperation({
				path: "/not-in-spec",
				method: "GET",
				requestBody: {},
			}),
			{
				...legacyFormModel,
				docs: "",
				parameters: [{ name: "body", type: "object" }],
			},
			jsdocParser,
		);
		expect(missingPathDocs).toEqual([]);

		const noAddDocs = buildOperationMethodDocs(
			createTestOperation({
				path: "/no-add",
				method: "POST",
			}),
			{
				...legacyFormModel,
				docs: "",
				parameters: [],
			},
			jsdocParser,
		);
		expect(noAddDocs).toEqual([]);
	});
});
