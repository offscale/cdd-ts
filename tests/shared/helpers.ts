import { IncomingMessage, Server, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { FormControlModel } from "@src/core/admin/form-types.js";
import type {
	ExampleObject,
	FormProperty,
	GeneratorConfig,
	HeaderObject,
	InfoObject,
	LinkObject,
	MediaTypeObject,
	Parameter,
	PathInfo,
	PathItem,
	RequestBody,
	Resource,
	ResourceOperation,
	SecurityScheme,
	ServerObject,
	SpecOperation,
	SwaggerDefinition,
	SwaggerResponse,
	SwaggerSpec,
	TagObject,
	XmlObject,
} from "@src/core/types/index.js";
import { generateFromConfigSync } from "@src/index.js";
import { IndentationText, ModuleKind, Project, ScriptTarget } from "ts-morph";
import ts from "typescript";
import { expect } from "vitest";

/**
 * Recursive object-only view of `SwaggerDefinition` for test assertions where boolean schemas are narrowed out.
 */
export type ObjectSchema = Omit<
	SwaggerDefinition,
	| "properties"
	| "patternProperties"
	| "dependentSchemas"
	| "dependentRequired"
	| "additionalProperties"
	| "unevaluatedProperties"
	| "unevaluatedItems"
	| "items"
	| "prefixItems"
	| "contains"
	| "if"
	| "then"
	| "else"
	| "not"
	| "contentSchema"
	| "propertyNames"
	| "allOf"
	| "oneOf"
	| "anyOf"
	| "xml"
> & {
	properties?: Record<string, ObjectSchema>;
	patternProperties?: Record<string, ObjectSchema>;
	dependentSchemas?: Record<string, ObjectSchema>;
	dependentRequired?: Record<string, string[]>;
	additionalProperties?: ObjectSchema;
	unevaluatedProperties?: ObjectSchema | boolean;
	unevaluatedItems?: ObjectSchema | boolean;
	items?: ObjectSchema;
	prefixItems?: ObjectSchema[];
	contains?: ObjectSchema;
	if?: ObjectSchema;
	then?: ObjectSchema;
	else?: ObjectSchema;
	not?: ObjectSchema;
	contentSchema?: ObjectSchema;
	propertyNames?: ObjectSchema;
	allOf?: ObjectSchema[];
	oneOf?: ObjectSchema[];
	anyOf?: ObjectSchema[];
	xml?: XmlObject;
	type?: string & string[];
};

/**
 * Narrows a `ReverseSchemaMap` (`Record<string, SwaggerDefinition | boolean>`) into a `Record<string, ObjectSchema>` for test assertions.
 *
 * @param schemas - Map of parsed schemas.
 * @returns Map of `ObjectSchema` entries.
 */
export function asSchemaMap(
	schemas: Record<string, SwaggerDefinition | boolean>,
): Record<string, ObjectSchema> {
	const result: Record<string, ObjectSchema> = {};
	Object.assign(result, schemas);
	return result;
}

/**
 * Creates a standard ts-morph project instance for use in tests.
 * This sets up an in-memory file system and a consistent compiler configuration
 * to ensure tests are isolated and reproducible.
 * @returns A pre-configured Project instance with an in-memory file system.
 */
export function createTestProject(): Project {
	return new Project({
		useInMemoryFileSystem: true,
		manipulationSettings: { indentationText: IndentationText.TwoSpaces },
		compilerOptions: {
			target: ScriptTarget.ESNext,
			module: ModuleKind.ESNext,
			moduleResolution: 99, // NodeNext
			lib: ["ES2022", "DOM"],
			strict: true,
			esModuleInterop: true,
			allowArbitraryExtensions: true,
			resolveJsonModule: true,
		},
	});
}

/**
 * A specialized version of `runGenerator` that allows passing a full config object.
 * Useful for E2E tests covering config-dependent features like security and date types.
 * @param spec The OpenAPI specification as a JavaScript object.
 * @param config The full generator config options.
 * @returns A promise that resolves to the `Project` instance containing all generated files.
 */
export async function runGeneratorWithConfig(
	spec: object,
	config: Partial<GeneratorConfig["options"]>,
): Promise<Project> {
	const project = createTestProject();

	const fullConfig: GeneratorConfig = {
		input: "/spec.json",
		output: "/generated",
		options: {
			framework: "angular",
			dateType: "string",
			enumStyle: "enum",
			generateServices: true,
			generateServiceTests: true,
			admin: false,
			...config,
		},
	};
	generateFromConfigSync(fullConfig, project, { spec });
	return project;
}

/**
 * A centralized helper to run the full generator pipeline for tests.
 * @param spec The OpenAPI specification as a JavaScript object.
 * @param genConfig Optional overrides for the standard generator config.
 * @returns A promise that resolves to the `Project` instance containing all generated files.
 */
export async function runGenerator(
	spec: object,
	genConfig?: Partial<GeneratorConfig>,
): Promise<Project> {
	const project = createTestProject();

	const config: GeneratorConfig = {
		...genConfig,
		input: genConfig?.input ?? "/spec.json",
		output: genConfig?.output ?? "/generated",
		options: {
			framework: "angular",
			dateType: "string",
			enumStyle: "enum",
			generateServices: true,
			admin: false,
			generateServiceTests: true,
			...genConfig?.options,
		},
	};

	generateFromConfigSync(config, project, { spec });

	return project;
}

/**
 * Creates a strongly typed `GeneratorConfig` with defaults for unit tests.
 *
 * @param overrides - Partial configuration overrides.
 * @returns A complete `GeneratorConfig`.
 */
export function createTestConfig(overrides?: object): GeneratorConfig {
	const ov = overrides as Partial<GeneratorConfig> | undefined;
	const config: GeneratorConfig = {
		input: ov?.input ?? "/spec.json",
		output: ov?.output ?? "/generated",
		options: ov?.options ?? {},
	};
	if (ov) {
		Object.assign(config, ov);
	}
	return config;
}

/**
 * Creates a strongly typed `SwaggerSpec` with defaults for unit tests.
 *
 * @param overrides - Partial OpenAPI specification overrides.
 * @returns A complete `SwaggerSpec`.
 */
export function createTestSpec(overrides?: object): SwaggerSpec {
	if (overrides) {
		return overrides as SwaggerSpec;
	}
	return {
		openapi: "3.0.0",
		info: { title: "Test API", version: "1.0.0" },
		paths: {},
	};
}

/**
 * Creates a strongly typed `PathInfo` operation object with defaults for unit tests.
 *
 * @param overrides - Partial `PathInfo` overrides.
 * @returns A complete `PathInfo`.
 */
export function createTestOperation(overrides?: object): PathInfo {
	if (overrides) {
		return overrides as PathInfo;
	}
	return {
		path: "/test",
		method: "GET",
		responses: {},
	};
}

/**
 * Creates a strongly typed `ObjectSchema` (`SwaggerDefinition`) for unit tests.
 *
 * @param overrides - Partial schema overrides.
 * @returns An `ObjectSchema`.
 */
export function createTestSchema(overrides?: object | boolean): ObjectSchema {
	const base: ObjectSchema = {};
	if (overrides && typeof overrides === "object") {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `Resource` for unit tests.
 *
 * @param overrides - Partial `Resource` overrides.
 * @returns A `Resource`.
 */
export function createTestResource(overrides?: object): Resource {
	const base: Resource = {
		name: "items",
		modelName: "Item",
		isEditable: true,
		operations: [],
		formProperties: [],
		listProperties: [],
	};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `ResourceOperation` for unit tests.
 *
 * @param overrides - Partial `ResourceOperation` overrides.
 * @returns A `ResourceOperation`.
 */
export function createTestResourceOp(overrides?: object): ResourceOperation {
	if (overrides) {
		return overrides as ResourceOperation;
	}
	return {
		action: "getAll",
		methodName: "getItems",
		path: "/items",
		method: "GET",
	};
}

/**
 * Creates a strongly typed `FormControlModel` for unit tests.
 *
 * @param overrides - Partial `FormControlModel` overrides.
 * @returns A `FormControlModel`.
 */
export function createTestFormControl(overrides?: object): FormControlModel {
	const base: FormControlModel = {
		name: "field",
		propertyName: "field",
		dataType: "string",
		controlType: "control",
		defaultValue: null,
		validationRules: [],
	};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `FormProperty` for unit tests.
 *
 * @param overrides - Partial `FormProperty` overrides.
 * @returns A `FormProperty`.
 */
export function createTestFormProperty(overrides?: object): FormProperty {
	const base: FormProperty = {
		name: "field",
		schema: { type: "string" },
	};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `RequestBody` for unit tests.
 *
 * @param overrides - Partial `RequestBody` overrides.
 * @returns A `RequestBody`.
 */
export function createTestRequestBody(overrides?: object): RequestBody {
	const base: RequestBody = {
		content: {},
	};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `SwaggerResponse` for unit tests.
 *
 * @param overrides - Partial `SwaggerResponse` overrides.
 * @returns A `SwaggerResponse`.
 */
export function createTestResponse(overrides?: object): SwaggerResponse {
	const base: SwaggerResponse = {
		description: "ok",
	};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `PathItem` for unit tests.
 *
 * @param overrides - Partial `PathItem` overrides.
 * @returns A `PathItem`.
 */
export function createTestPathItem(overrides?: object): PathItem {
	const base: PathItem = {};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `Record<string, PathItem>` paths map for unit tests.
 *
 * @param overrides - Partial paths map overrides.
 * @returns A `Record<string, PathItem>`.
 */
export function createTestPaths(overrides?: object): Record<string, PathItem> {
	const base: Record<string, PathItem> = {};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `TagObject` for unit tests.
 *
 * @param overrides - Partial `TagObject` overrides.
 * @returns A `TagObject`.
 */
export function createTestTag(overrides?: object): TagObject {
	const base: TagObject = { name: "default" };
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `ExampleObject` for unit tests.
 *
 * @param overrides - Partial `ExampleObject` overrides.
 * @returns An `ExampleObject`.
 */
export function createTestExample(overrides?: object): ExampleObject {
	const base: ExampleObject = {};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates strongly typed `GeneratorConfig["options"]` for unit tests.
 *
 * @param overrides - Partial options overrides.
 * @returns `GeneratorConfig["options"]`.
 */
export function createTestOptions(
	overrides?: object,
): GeneratorConfig["options"] {
	const base: GeneratorConfig["options"] = {};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `Parameter` for unit tests.
 *
 * @param overrides - Partial `Parameter` overrides.
 * @returns A `Parameter`.
 */
export function createTestParameter(overrides?: object): Parameter {
	const base: Parameter = {
		name: "param",
		in: "query",
	};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `HeaderObject` for unit tests.
 *
 * @param overrides - Partial `HeaderObject` overrides.
 * @returns A `HeaderObject`.
 */
export function createTestHeader(overrides?: object): HeaderObject {
	const base: HeaderObject = {};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `MediaTypeObject` for unit tests.
 *
 * @param overrides - Partial `MediaTypeObject` overrides.
 * @returns A `MediaTypeObject`.
 */
export function createTestMediaType(overrides?: object): MediaTypeObject {
	const base: MediaTypeObject = {};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `LinkObject` for unit tests.
 *
 * @param overrides - Partial `LinkObject` overrides.
 * @returns A `LinkObject`.
 */
export function createTestLink(overrides?: object): LinkObject {
	const base: LinkObject = {};
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `ServerObject` for unit tests.
 *
 * @param overrides - Partial `ServerObject` overrides.
 * @returns A `ServerObject`.
 */
export function createTestServer(overrides?: object): ServerObject {
	const base: ServerObject = { url: "/" };
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `SecurityScheme` for unit tests.
 *
 * @param overrides - Partial `SecurityScheme` overrides.
 * @returns A `SecurityScheme`.
 */
export function createTestSecurityScheme(overrides?: object): SecurityScheme {
	const base: SecurityScheme = { type: "http", scheme: "bearer" };
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Creates a strongly typed `SpecOperation` for unit tests.
 *
 * @param overrides - Partial `SpecOperation` overrides.
 * @returns A `SpecOperation`.
 */
export function createTestSpecOperation(overrides?: object): SpecOperation {
	const base: SpecOperation = { responses: {} };
	if (overrides) {
		Object.assign(base, overrides);
	}
	return base;
}

/**
 * Converts an unknown object value into a `Record<string, unknown>` for property assertions in unit tests.
 *
 * @param val - Candidate object value.
 * @returns A `Record<string, unknown>`.
 */
export function asRecord(val: unknown): Record<string, unknown> {
	const base: Record<string, unknown> = {};
	if (val && typeof val === "object") {
		Object.assign(base, val);
	}
	return base;
}

/** Resolved link result from transpiled `LinkService`. */
export interface CompiledLinkResolution {
	operationId?: string;
	targetOperationId?: string;
	url?: string;
	method?: string;
	parameters: Record<string, unknown>;
	parameterLocations?: Record<string, string>;
	requestBody?: unknown;
	targetServer?: string;
	server?: ServerObject & Record<string, unknown>;
}

/** Transpiled `LinkService` instance contract for unit tests. */
export interface CompiledLinkService {
	resolveLink(
		operationId: string,
		response: unknown,
		linkName: string,
		request?: unknown,
		serverIndexOrUrlTemplate?: number | string,
		serverVariables?: Record<string, string>,
	): CompiledLinkResolution | null;
	getAvailableLinks(operationId: string, status: number | string): string[];
}

/** Transpiled `ResponseHeaderService` instance contract for unit tests. */
export interface CompiledResponseHeaderService {
	parse(
		headers: unknown,
		operationId: string,
		statusCode: number | string,
	): Record<string, unknown>;
}

/** Transpiled `WebhookService` instance contract for unit tests. */
export interface CompiledWebhookService {
	findEntry(
		name: string,
		method?: string,
	):
		| {
				name: string;
				method: string;
				interfaceName?: string;
				pathItem?: PathItem;
				scope?: string;
		  }
		| undefined;
	parsePayload<T = Record<string, unknown>>(
		name: string,
		rawBody: unknown,
		contentType?: string,
	): T;
	isWebhookEvent(name: string, payload: unknown, method?: string): boolean;
}

/**
 * Instantiates a transpiled `LinkService` from `CompiledModuleExports`.
 *
 * @param exportsObj - Compiled module exports containing `LinkService`.
 * @returns A `CompiledLinkService` instance.
 */
export function instantiateLinkService(
	exportsObj: CompiledModuleExports,
): CompiledLinkService {
	const Ctor = exportsObj.LinkService;
	if (!Ctor) {
		throw new Error("LinkService constructor not found on exports");
	}
	return new Ctor();
}

/**
 * Instantiates a transpiled `ResponseHeaderService` from `CompiledModuleExports`.
 *
 * @param exportsObj - Compiled module exports containing `ResponseHeaderService`.
 * @returns A `CompiledResponseHeaderService` instance.
 */
export function instantiateResponseHeaderService(
	exportsObj: CompiledModuleExports,
): CompiledResponseHeaderService {
	const Ctor = exportsObj.ResponseHeaderService;
	if (!Ctor) {
		throw new Error("ResponseHeaderService constructor not found on exports");
	}
	return new Ctor();
}

/**
 * Instantiates a transpiled `WebhookService` from `CompiledModuleExports`.
 *
 * @param exportsObj - Compiled module exports containing `WebhookService`.
 * @returns A `CompiledWebhookService` instance.
 */
export function instantiateWebhookService(
	exportsObj: CompiledModuleExports,
): CompiledWebhookService {
	const Ctor = exportsObj.WebhookService;
	if (!Ctor) {
		throw new Error("WebhookService constructor not found on exports");
	}
	return new Ctor();
}

/**
 * Creates a mock `IncomingMessage` instance for HTTP handler unit tests.
 *
 * @param overrides - Partial `IncomingMessage` properties to assign.
 * @returns An `IncomingMessage` instance.
 */
export function createMockIncomingMessage(overrides?: object): IncomingMessage {
	const req = new IncomingMessage(new Socket());
	if (overrides) {
		Object.assign(req, overrides);
	}
	return req;
}

/**
 * Creates a mock `ServerResponse` instance for HTTP handler unit tests.
 *
 * @param overrides - Partial `ServerResponse` properties to assign.
 * @returns A `ServerResponse` instance with `.req` attached.
 */
export function createMockServerResponse(
	overrides?: object,
): ServerResponse<IncomingMessage> & { req: IncomingMessage } {
	const req = new IncomingMessage(new Socket());
	const res = new ServerResponse(req) as ServerResponse<IncomingMessage> & {
		req: IncomingMessage;
	};
	if (overrides) {
		Object.assign(res, overrides);
	}
	return res;
}

/**
 * Creates a mock `http.Server` instance for unit tests.
 *
 * @param overrides - Partial `Server` properties to assign.
 * @returns An `http.Server` instance.
 */
export function createMockHttpServer(overrides?: object): Server {
	const server = new Server();
	if (overrides) {
		Object.assign(server, overrides);
	}
	return server;
}

/**
 * Clones a test specification and ensures every operation under `paths` defines at least a default `200` response.
 *
 * @param spec - Input specification object.
 * @returns Normalized `SwaggerSpec`.
 */
export function ensureTestSpecResponses(spec: object): SwaggerSpec {
	const cloned = createTestSpec(JSON.parse(JSON.stringify(spec)) as object);
	if (!cloned.openapi && !cloned.swagger) {
		cloned.openapi = "3.0.0";
	}
	if (!cloned.info) {
		cloned.info = { title: "Test API", version: "1.0.0" };
	}
	if (!cloned.paths) return cloned;
	const methods = [
		"get",
		"post",
		"put",
		"delete",
		"options",
		"head",
		"patch",
		"trace",
		"query",
	] as const;

	for (const pathItem of Object.values(cloned.paths)) {
		if (!pathItem || typeof pathItem !== "object") continue;
		for (const method of methods) {
			const operation = pathItem[method];
			if (operation && operation.responses === undefined) {
				operation.responses = { "200": { description: "ok" } };
			}
		}
		if (pathItem.additionalOperations) {
			for (const operation of Object.values(pathItem.additionalOperations)) {
				if (operation && operation.responses === undefined) {
					operation.responses = { "200": { description: "ok" } };
				}
			}
		}
	}
	return cloned;
}

/**
 * Strongly typed exports structure for transpiled generated utility modules in unit tests.
 */
export interface CompiledModuleExports {
	API_INFO?: InfoObject & {
		extensions?: Record<string, unknown>;
		contact?: InfoObject["contact"] & { extensions?: Record<string, unknown> };
		license?: InfoObject["license"] & { extensions?: Record<string, unknown> };
		[key: string]: unknown;
	};
	API_EXTERNAL_DOCS?: {
		url?: string;
		description?: string;
		extensions?: Record<string, unknown>;
		[key: string]: unknown;
	};
	API_DOCUMENT?: {
		$self?: string;
		jsonSchemaDialect?: string;
		openapi?: string;
		swagger?: string;
	};
	API_DOCUMENT_META?: {
		$self?: string;
		jsonSchemaDialect?: string;
		openapi?: string;
		swagger?: string;
		extensions?: Record<string, unknown>;
	};
	API_DISCRIMINATORS?: Record<
		string,
		{
			propertyName?: string;
			defaultMapping?: string;
			mapping?: Record<string, string>;
		}
	>;
	API_TAGS_MAP?: Record<string, TagObject & Record<string, unknown>>;
	API_EXAMPLES?: Record<
		string,
		ExampleObject & { dataValue?: Record<string, unknown> }
	>;
	API_HEADERS?: Record<string, HeaderObject>;
	API_LINKS?: Record<string, Record<string, Record<string, LinkObject>>>;
	API_COMPONENT_LINKS?: Record<string, LinkObject>;
	API_MEDIA_TYPES?: Record<
		string,
		Omit<MediaTypeObject, "schema" | "itemSchema"> & {
			schema?: ObjectSchema;
			itemSchema?: ObjectSchema;
		}
	>;
	API_PARAMETERS?: Record<string, Parameter>;
	API_PATH_ITEMS?: Record<string, PathItem>;
	API_PATHS?: Record<string, PathItem & { get?: { operationId?: string } }>;
	API_REQUEST_BODIES?: Record<string, RequestBody>;
	API_RESPONSES?: Record<string, SwaggerResponse>;
	API_TAGS?: Array<TagObject & Record<string, unknown>>;
	API_SERVERS?: Array<
		ServerObject & {
			variables?: Record<string, { default?: string; enum?: string[] }>;
		}
	>;
	API_WEBHOOKS?: Array<{
		name: string;
		method: string;
		interfaceName: string;
		pathItem: PathItem & {
			post?: {
				operationId?: string;
				requestBody?: { content?: Record<string, unknown> };
			};
		};
		scope?: string;
	}>;
	API_CALLBACKS?: Array<{
		name: string;
		method: string;
		expression: string;
		interfaceName: string;
		pathItem: PathItem & {
			post?: {
				operationId?: string;
				requestBody?: { content?: Record<string, unknown> };
			};
		};
		scope?: string;
	}>;
	API_SECURITY_SCHEMES?: Record<
		string,
		SecurityScheme & {
			name?: string;
			in?: string;
			scheme?: string;
			flows?: {
				implicit?: {
					authorizationUrl?: string;
					scopes?: Record<string, string>;
				};
				clientCredentials?: {
					tokenUrl?: string;
					scopes?: Record<string, string>;
				};
				authorizationCode?: {
					authorizationUrl?: string;
					tokenUrl?: string;
					scopes?: Record<string, string>;
				};
				deviceAuthorization?: {
					deviceAuthorizationUrl?: string;
					tokenUrl?: string;
					scopes?: Record<string, string>;
				};
			};
		}
	>;
	API_SECURITY_REQUIREMENTS?: Array<Record<string, string[]>>;
	API_RESPONSE_HEADERS?: Record<string, Record<string, Record<string, string>>>;
	API_RESPONSE_HEADER_OBJECTS?: Record<
		string,
		Record<
			string,
			Record<string, Omit<HeaderObject, "schema"> & { schema?: ObjectSchema }>
		>
	>;
	API_HEADER_XML_CONFIGS?: Record<string, XmlConfigNode>;
	ContentDecoder?: {
		decode: (value: unknown, config?: unknown) => unknown;
	};
	ContentEncoder?: {
		encode: (
			value: unknown,
			config?: unknown,
		) => Record<string, unknown> & Array<Record<string, unknown>>;
	};
	XmlBuilder?: {
		serialize: (value: unknown, rootName?: string, config?: unknown) => string;
	};
	LinksetParser?: {
		parse: (input: string) => Record<string, unknown>;
	};
	ResponseHeaderService?: new () => CompiledResponseHeaderService;
	LinkService?: new () => CompiledLinkService;
	WebhookService?: new () => CompiledWebhookService;
}

/**
 * Recursive XML configuration node structure for test assertions.
 */
export interface XmlConfigNode {
	name?: string;
	namespace?: string;
	prefix?: string;
	attribute?: boolean;
	wrapped?: boolean;
	nodeType?: string;
	properties?: Record<string, XmlConfigNode>;
	items?: XmlConfigNode;
	prefixItems?: XmlConfigNode[];
}

/**
 * Narrows an unknown XML configuration object to `XmlConfigNode` for test assertions.
 *
 * @param val - Candidate XML config object.
 * @returns Typed `XmlConfigNode`.
 */
export function asXmlConfig(val: unknown): XmlConfigNode {
	const base: XmlConfigNode = {};
	if (val && typeof val === "object") {
		Object.assign(base, val);
	}
	return base;
}

/**
 * Transpiles and executes a generated TypeScript utility file from a `ts-morph` `Project`.
 *
 * @param project - The `ts-morph` `Project` containing the generated file.
 * @param filePath - Path of the generated source file inside `project`.
 * @returns Strongly typed `CompiledModuleExports` object.
 */
export function compileGeneratedModule(
	project: Project,
	filePath: string,
): CompiledModuleExports {
	const sourceFile = project.getSourceFileOrThrow(filePath);
	const code = sourceFile.getText().replace(/import.*;/g, "");
	const jsCode = ts.transpile(code, {
		target: ts.ScriptTarget.ES2020,
		module: ts.ModuleKind.CommonJS,
	});
	const exportsObj: CompiledModuleExports = {};
	new Function("exports", jsCode)(exportsObj);
	return exportsObj;
}

/**
 * Asserts that all generated TypeScript source files in the `ts-morph` `Project`
 * have zero syntactic diagnostics.
 *
 * @param project - The `ts-morph` `Project` containing generated files.
 */
export function expectZeroTypeScriptDiagnostics(project: Project): void {
	const program = project.getProgram().compilerObject;
	const syntaxErrors: string[] = [];
	for (const sf of project.getSourceFiles()) {
		const path = sf.getFilePath();
		if (!path.endsWith(".ts") && !path.endsWith(".tsx")) {
			continue;
		}
		const diags = program.getSyntacticDiagnostics(sf.compilerNode);
		for (const d of diags) {
			const msg =
				typeof d.messageText === "string"
					? d.messageText
					: d.messageText.messageText;
			syntaxErrors.push(`${path}: TS${d.code} ${msg}`);
		}
	}
	expect(syntaxErrors).toEqual([]);
}
