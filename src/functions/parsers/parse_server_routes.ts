/**
 * Express route handler and decorated controller AST extraction and OpenAPI parameter/requestBody/response assembly.
 *
 * @module functions/parsers/parse_server_routes
 */
import type {
	ArrowFunction,
	CallExpression,
	Decorator,
	Expression,
	FunctionDeclaration,
	FunctionExpression,
	MethodDeclaration,
	ObjectBindingPattern,
	ParameterDeclaration,
	PropertyAccessExpression,
	SourceFile,
	VariableDeclaration,
} from "ts-morph";
import { Node, SyntaxKind } from "ts-morph";
import type {
	ExampleObject,
	OpenApiValue,
	Parameter,
	RequestBody,
	SwaggerDefinition,
	SwaggerResponse,
} from "../../core/types/index.js";
import type {
	CodeScanOperation,
	CodeScanParam,
	CodeScanParamLocation,
	CodeScanRequestBody,
	CodeScanResponse,
} from "../parse.js";
import { camelCase } from "../utils_string.js";
import {
	addParam,
	applyParamDocs,
	applyParamExamples,
	applyParamSchemas,
	applyQuerystringMeta,
	applyRequestExamples,
	applyResponseExamples,
	extractDocMeta,
	extractLiteralText,
	extractStringLiteral,
	inferExpressSchemaHints,
	inferReturnSchemaFromSignature,
	inferSchemaFromTypeNode,
	isReservedHeaderParam,
	mergeResponseHints,
	stripInternalDocMeta,
	trimQuotes,
	unwrapExampleCarrier,
} from "./parse_operation_jsdoc.js";

/** Standard HTTP methods supported directly on an OpenAPI PathItem. */
export const STANDARD_HTTP_METHODS: Set<string> = new Set([
	"get",
	"post",
	"put",
	"patch",
	"delete",
	"options",
	"head",
	"trace",
	"query",
]);

const EXTRA_HTTP_METHODS = new Set([
	"copy",
	"move",
	"lock",
	"unlock",
	"propfind",
	"proppatch",
	"mkcol",
	"report",
]);

const HTTP_METHODS = new Set([...STANDARD_HTTP_METHODS, ...EXTRA_HTTP_METHODS]);

const DECORATOR_METHODS: Record<string, string> = {
	Get: "GET",
	Post: "POST",
	Put: "PUT",
	Patch: "PATCH",
	Delete: "DELETE",
	Options: "OPTIONS",
	Head: "HEAD",
	Trace: "TRACE",
	Query: "QUERY",
};

const CONTROLLER_DECORATORS = new Set(["Controller", "Route"]);

const BINDING_MAP: Record<string, keyof RequestBindings> = {
	params: "paramsName",
	query: "queryName",
	headers: "headersName",
	cookies: "cookiesName",
	body: "bodyName",
};

const REQ_PROP_LOCATION_MAP: Record<string, CodeScanParamLocation | "body"> = {
	params: "path",
	query: "query",
	headers: "header",
	cookies: "cookie",
	body: "body",
};

const DECORATOR_PARAM_LOCATIONS: Record<string, CodeScanParamLocation> = {
	Param: "path",
	Path: "path",
	PathParam: "path",
	Query: "query",
	Header: "header",
	Headers: "header",
	Cookie: "cookie",
	Cookies: "cookie",
};

/**
 * Scans an AST `SourceFile` for Express-style route registrations (`app.get`, `router.post`, `router.route(...).get`, etc.).
 *
 * @param sourceFile - The TypeScript `SourceFile` to scan.
 * @returns Discovered `CodeScanOperation` descriptors.
 */
export function scanExpressRoutes(sourceFile: SourceFile): CodeScanOperation[] {
	const operations: CodeScanOperation[] = [];
	const callExpressions = sourceFile.getDescendantsOfKind(
		SyntaxKind.CallExpression,
	) as CallExpression[];

	for (const call of callExpressions) {
		const routeInfo = extractRouteCall(call);
		if (!routeInfo) continue;

		const handler = extractHandler(call, routeInfo.handlerOffset);
		const operation = buildExpressOperation(
			routeInfo.method,
			routeInfo.path,
			handler,
			sourceFile.getFilePath(),
		);
		operations.push(operation);
	}

	return operations;
}

/**
 * Scans an AST `SourceFile` for NestJS/routing-controllers `@Controller` / `@Route` classes and HTTP method decorators.
 *
 * @param sourceFile - The TypeScript `SourceFile` to scan.
 * @returns Discovered `CodeScanOperation` descriptors.
 */
export function scanDecoratedControllers(
	sourceFile: SourceFile,
): CodeScanOperation[] {
	const operations: CodeScanOperation[] = [];

	for (const cls of sourceFile.getClasses()) {
		const controllerDecorator = cls
			.getDecorators()
			.find((dec) => CONTROLLER_DECORATORS.has(dec.getName()));
		if (!controllerDecorator) continue;

		const basePath = extractDecoratorPath(controllerDecorator) ?? "";

		for (const method of cls.getMethods()) {
			const httpDecorators = method
				.getDecorators()
				.map((dec) => ({ dec, method: DECORATOR_METHODS[dec.getName()] }))
				.filter((entry): entry is { dec: Decorator; method: string } =>
					Boolean(entry.method),
				);

			for (const entry of httpDecorators) {
				const methodPath = extractDecoratorPath(entry.dec) ?? "";
				const fullPath = joinPaths(basePath, methodPath);
				const paramMap = new Map<string, CodeScanParam>();

				extractDecoratorParams(method, paramMap);
				addPathParams(fullPath, paramMap);

				const docMeta = extractDocMeta(method);
				applyQuerystringMeta(docMeta, paramMap);
				applyParamDocs(paramMap, docMeta.paramDocs);
				applyParamExamples(paramMap, docMeta.paramExamples);
				applyParamSchemas(paramMap, docMeta.paramSchemas);

				const statusCode = extractHttpCode(method) ?? "200";
				const responseSchema = inferReturnSchemaFromSignature(method);
				const requestBody = buildRequestBodyFromDecoratorParams(method);
				applyRequestExamples(requestBody, docMeta.requestExamples);

				const responses = mergeResponseHints(
					[
						{
							status: statusCode,
							description: "Response",
							contentTypes: ["application/json"],
							...(responseSchema !== undefined
								? { schema: responseSchema }
								: {}),
						},
					],
					docMeta.responses,
				).map((response) =>
					responseSchema !== undefined &&
					response.contentTypes.length > 0 &&
					response.schema === undefined
						? { ...response, schema: responseSchema }
						: response,
				);

				applyResponseExamples(responses, docMeta.responseExamples);

				operations.push({
					operationId: docMeta.operationId ?? method.getName(),
					method: entry.method,
					path: fullPath,
					filePath: sourceFile.getFilePath(),
					params: Array.from(paramMap.values()),
					...(requestBody ? { requestBody } : {}),
					responses,
					...stripInternalDocMeta(docMeta),
				});
			}
		}
	}

	return operations;
}

type RouteCallInfo = {
	method: string;
	path: string;
	handlerOffset: number;
};

function extractRouteCall(call: CallExpression): RouteCallInfo | undefined {
	const callee = call.getExpression();
	const method = resolveHttpMethodName(callee);
	if (!method) return undefined;

	const firstArg = call.getArguments()[0] as Expression | undefined;
	const directPath = extractPathFromExpression(firstArg);

	if (directPath) {
		return {
			method,
			path: normalizeRoutePath(directPath),
			handlerOffset: 1,
		};
	}

	const target = (callee as PropertyAccessExpression).getExpression();
	if (Node.isCallExpression(target)) {
		const chainedPath = extractRouteChainPath(target);
		if (chainedPath) {
			return {
				method,
				path: normalizeRoutePath(chainedPath),
				handlerOffset: 0,
			};
		}
	}

	return undefined;
}

function extractRouteChainPath(call: CallExpression): string | undefined {
	const callee = call.getExpression();
	if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "route")
		return undefined;
	return extractPathFromExpression(
		call.getArguments()[0] as Expression | undefined,
	);
}

function resolveHttpMethodName(expression: Expression): string | undefined {
	if (!Node.isPropertyAccessExpression(expression)) return undefined;
	const name = expression.getName().toLowerCase();
	return HTTP_METHODS.has(name) ? name.toUpperCase() : undefined;
}

function extractHandler(
	call: CallExpression,
	offset: number,
): Node | undefined {
	const args = call.getArguments().slice(offset);
	for (let i = args.length - 1; i >= 0; i -= 1) {
		const handler = resolveFunctionLike(args[i] as Node);
		if (handler) return handler;
	}
	return undefined;
}

function resolveFunctionLike(node: Node): Node | undefined {
	if (
		Node.isArrowFunction(node) ||
		Node.isFunctionExpression(node) ||
		Node.isFunctionDeclaration(node)
	) {
		return node;
	}

	if (Node.isIdentifier(node)) {
		for (const definition of node.getDefinitions()) {
			const decl = definition.getDeclarationNode();
			if (
				decl &&
				(Node.isFunctionDeclaration(decl) || Node.isMethodDeclaration(decl))
			) {
				return decl;
			}
			if (decl && Node.isVariableDeclaration(decl)) {
				const init = decl.getInitializer();
				if (
					init &&
					(Node.isArrowFunction(init) || Node.isFunctionExpression(init))
				) {
					return init;
				}
			}
		}
	}

	if (Node.isArrayLiteralExpression(node)) {
		const elements = node.getElements();
		for (let i = elements.length - 1; i >= 0; i -= 1) {
			const handler = resolveFunctionLike(elements[i] as Node);
			if (handler) return handler;
		}
	}

	return undefined;
}

function buildExpressOperation(
	method: string,
	pathValue: string,
	handler: Node | undefined,
	filePath: string,
): CodeScanOperation {
	const paramMap = new Map<string, CodeScanParam>();
	addPathParams(pathValue, paramMap);

	const operationId = inferOperationId(handler, method, pathValue);
	const docMeta = handler ? extractDocMeta(handler) : {};

	applyQuerystringMeta(docMeta, paramMap);

	const analysis = handler
		? analyzeExpressHandler(handler, paramMap)
		: {
				requestBody: undefined,
				responses: [
					{ status: "200", description: "Response", contentTypes: [] },
				],
				responseSchema: undefined,
			};

	applyParamDocs(paramMap, docMeta.paramDocs);
	applyParamExamples(paramMap, docMeta.paramExamples);
	applyParamSchemas(paramMap, docMeta.paramSchemas);
	applyRequestExamples(analysis.requestBody, docMeta.requestExamples);

	const responses = mergeResponseHints(
		analysis.responses,
		docMeta.responses,
	).map((response) =>
		analysis.responseSchema !== undefined &&
		response.contentTypes.length > 0 &&
		response.schema === undefined
			? { ...response, schema: analysis.responseSchema }
			: response,
	);

	applyResponseExamples(responses, docMeta.responseExamples);

	return {
		operationId: docMeta.operationId ?? operationId,
		method,
		path: pathValue,
		filePath,
		params: Array.from(paramMap.values()),
		...(analysis.requestBody ? { requestBody: analysis.requestBody } : {}),
		responses,
		...stripInternalDocMeta(docMeta),
	};
}

function analyzeExpressHandler(
	handler: Node,
	paramMap: Map<string, CodeScanParam>,
): {
	requestBody?: CodeScanRequestBody;
	responses: CodeScanResponse[];
	responseSchema?: SwaggerDefinition | boolean;
} {
	const bindings = extractRequestBindings(handler);
	const body = getFunctionBody(handler);
	const requestContentTypes = new Set<string>();
	let bodyUsed = Boolean(bindings.bodyName);
	const responseIndex = new Map<string, Set<string>>();
	const inferredSchemas = inferExpressSchemaHints(handler);

	const visit = (node: Node) => {
		if (Node.isCallExpression(node)) {
			const responseHint = extractResponseHint(node, bindings.resName);
			if (responseHint) {
				recordResponse(
					responseIndex,
					responseHint.status,
					responseHint.contentType,
				);
			}

			if (bindings.reqName) {
				const requestType = extractRequestContentType(node, bindings.reqName);
				if (requestType) {
					requestContentTypes.add(requestType);
					bodyUsed = true;
				}

				const headerName = extractRequestHeaderName(node, bindings.reqName);
				if (headerName) {
					addParam(paramMap, { name: headerName, in: "header" });
				}
			}
		}

		if (
			Node.isPropertyAccessExpression(node) ||
			Node.isElementAccessExpression(node)
		) {
			const access = extractRequestAccess(node, bindings);
			if (access) {
				if (access.location === "body") {
					bodyUsed = true;
				} else if (access.name) {
					addParam(paramMap, { name: access.name, in: access.location });
				}
			}
		}

		if (Node.isVariableDeclaration(node)) {
			const destructured = extractDestructuredParams(node, bindings);
			if (destructured.bodyUsed) bodyUsed = true;
			destructured.params.forEach((param) => {
				addParam(paramMap, param);
			});
		}
	};

	visit(body);
	body.forEachDescendant((descendant) => visit(descendant));

	if (inferredSchemas.requestSchema !== undefined) {
		bodyUsed = true;
	}

	const responses = finalizeResponses(responseIndex, "200");

	if (inferredSchemas.responseSchema !== undefined) {
		responses.forEach((response) => {
			if (response.contentTypes.length > 0) {
				response.schema = inferredSchemas.responseSchema as
					| SwaggerDefinition
					| boolean;
			}
		});
	}

	const requestBody = bodyUsed
		? {
				required: true,
				contentTypes:
					requestContentTypes.size > 0
						? Array.from(requestContentTypes)
						: ["application/json"],
				...(inferredSchemas.requestSchema !== undefined
					? { schema: inferredSchemas.requestSchema }
					: {}),
			}
		: undefined;

	return {
		...(requestBody ? { requestBody } : {}),
		responses,
		...(inferredSchemas.responseSchema !== undefined
			? { responseSchema: inferredSchemas.responseSchema }
			: {}),
	};
}

function getFunctionBody(handler: Node): Node {
	return (handler as Node & { getBody(): Node }).getBody();
}

function extractRequestBindings(handler: Node): RequestBindings {
	const bindings: RequestBindings = {};
	const params = (
		handler as Node & {
			getParameters(): ParameterDeclaration[];
		}
	).getParameters();

	const reqParam = params[0];
	const resParam = params[1];

	if (reqParam) {
		const nameNode = reqParam.getNameNode();
		if (Node.isIdentifier(nameNode)) {
			bindings.reqName = nameNode.getText();
		} else {
			for (const element of (nameNode as ObjectBindingPattern).getElements()) {
				const propertyName =
					element.getPropertyNameNode()?.getText() ?? element.getName();
				const targetKey = BINDING_MAP[propertyName];
				if (targetKey) {
					bindings[targetKey] = element.getName();
				}
			}
		}
	}

	if (resParam) {
		const nameNode = resParam.getNameNode();
		if (Node.isIdentifier(nameNode)) {
			bindings.resName = nameNode.getText();
		}
	}

	return bindings;
}

type RequestBindings = {
	reqName?: string;
	resName?: string;
	paramsName?: string;
	queryName?: string;
	headersName?: string;
	cookiesName?: string;
	bodyName?: string;
};

type RequestAccess = {
	location: CodeScanParamLocation | "body";
	name?: string;
};

function extractRequestAccess(
	node: Node,
	bindings: RequestBindings,
): RequestAccess | undefined {
	if (Node.isPropertyAccessExpression(node)) {
		const name = node.getName();
		const nestedLocation = resolveRequestLocation(
			node.getExpression(),
			bindings,
		);
		if (nestedLocation) {
			return { location: nestedLocation, name };
		}

		const rootLocation = resolveRequestLocation(node, bindings);
		return rootLocation === "body" ? { location: rootLocation } : undefined;
	}

	const argExpr = (
		node as Node & { getArgumentExpression: () => Expression | undefined }
	).getArgumentExpression();
	const name = extractStringLiteral(argExpr);
	const location = resolveRequestLocation(
		(node as Node & { getExpression: () => Expression }).getExpression(),
		bindings,
	);
	return location ? { location, ...(name ? { name } : {}) } : undefined;
}

function extractDestructuredParams(
	node: VariableDeclaration,
	bindings: RequestBindings,
): { params: CodeScanParam[]; bodyUsed: boolean } {
	const params: CodeScanParam[] = [];
	const nameNode = node.getNameNode();
	const initializer = node.getInitializer();

	if (!initializer || !Node.isObjectBindingPattern(nameNode)) {
		return { params, bodyUsed: false };
	}

	const location = resolveRequestLocation(initializer, bindings);
	if (!location) return { params, bodyUsed: false };

	if (location === "body") {
		return { params, bodyUsed: true };
	}

	for (const element of nameNode.getElements()) {
		const propName =
			element.getPropertyNameNode()?.getText() ?? element.getName();
		params.push({ name: trimQuotes(propName), in: location });
	}

	return { params, bodyUsed: false };
}

function resolveRequestLocation(
	expression: Expression,
	bindings: RequestBindings,
): CodeScanParamLocation | "body" | undefined {
	if (Node.isIdentifier(expression)) {
		const name = expression.getText();
		if (name === bindings.paramsName) return "path";
		if (name === bindings.queryName) return "query";
		if (name === bindings.headersName) return "header";
		if (name === bindings.cookiesName) return "cookie";
		if (name === bindings.bodyName) return "body";
		return undefined;
	}

	if (Node.isPropertyAccessExpression(expression)) {
		const base = expression.getExpression();
		if (!Node.isIdentifier(base) || base.getText() !== bindings.reqName)
			return undefined;
		return REQ_PROP_LOCATION_MAP[expression.getName()];
	}

	return undefined;
}

type ResponseHint = {
	status: string;
	contentType?: string;
};

function extractResponseHint(
	call: CallExpression,
	resName?: string,
): ResponseHint | undefined {
	if (!resName) return undefined;

	const callee = call.getExpression();
	if (!Node.isPropertyAccessExpression(callee)) return undefined;

	const method = callee.getName();
	if (!isResponseChain(callee.getExpression(), resName)) return undefined;

	if (method === "sendStatus") {
		const status =
			extractLiteralText(call.getArguments()[0] as Expression | undefined) ??
			"200";
		return { status };
	}

	if (method === "json" || method === "send" || method === "end") {
		const chainMeta = extractResponseChainMeta(callee.getExpression());
		let contentType = chainMeta.contentType;

		if (method === "json") {
			contentType = "application/json";
		} else if (method === "send" && !contentType) {
			contentType = inferContentTypeFromSend(
				call.getArguments()[0] as Expression | undefined,
			);
		}

		return {
			status: chainMeta.status ?? "200",
			...(contentType ? { contentType } : {}),
		};
	}

	return undefined;
}

function extractResponseChainMeta(expression: Expression): {
	status?: string;
	contentType?: string;
} {
	let current: Expression = expression;
	let status: string | undefined;
	let contentType: string | undefined;

	while (
		Node.isCallExpression(current) &&
		Node.isPropertyAccessExpression(current.getExpression())
	) {
		const propAccessExpr = current.getExpression() as PropertyAccessExpression;
		const method = propAccessExpr.getName();
		const target = propAccessExpr.getExpression();

		if (method === "status") {
			status =
				extractLiteralText(
					current.getArguments()[0] as Expression | undefined,
				) ?? status;
		} else if (method === "type") {
			contentType =
				extractStringLiteral(
					current.getArguments()[0] as Expression | undefined,
				) ?? contentType;
		} else if (method === "set" || method === "header") {
			const [nameArg, valueArg] = current.getArguments();
			const headerName = extractStringLiteral(
				nameArg as Expression | undefined,
			);
			if (headerName?.toLowerCase() === "content-type") {
				contentType =
					extractStringLiteral(valueArg as Expression | undefined) ??
					contentType;
			}
		}

		current = target;
	}

	return {
		...(status ? { status } : {}),
		...(contentType ? { contentType } : {}),
	};
}

function isResponseChain(expression: Expression, resName: string): boolean {
	if (Node.isIdentifier(expression)) {
		return expression.getText() === resName;
	}

	if (
		Node.isCallExpression(expression) &&
		Node.isPropertyAccessExpression(expression.getExpression())
	) {
		const propAccess = expression.getExpression() as PropertyAccessExpression;
		return isResponseChain(propAccess.getExpression(), resName);
	}

	return false;
}

function inferContentTypeFromSend(arg?: Expression): string | undefined {
	if (!arg) return undefined;
	if (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
		return "text/plain";
	}
	if (
		Node.isObjectLiteralExpression(arg) ||
		Node.isArrayLiteralExpression(arg)
	) {
		return "application/json";
	}
	return undefined;
}

function extractRequestContentType(
	call: CallExpression,
	reqName: string,
): string | undefined {
	const callee = call.getExpression();
	if (
		!Node.isPropertyAccessExpression(callee) ||
		callee.getName() !== "is" ||
		!Node.isIdentifier(callee.getExpression()) ||
		callee.getExpression().getText() !== reqName
	) {
		return undefined;
	}
	return extractStringLiteral(call.getArguments()[0] as Expression | undefined);
}

function extractRequestHeaderName(
	call: CallExpression,
	reqName: string,
): string | undefined {
	const callee = call.getExpression();
	if (!Node.isPropertyAccessExpression(callee)) return undefined;
	const method = callee.getName();
	if (
		(method !== "get" && method !== "header") ||
		!Node.isIdentifier(callee.getExpression()) ||
		callee.getExpression().getText() !== reqName
	) {
		return undefined;
	}
	return extractStringLiteral(call.getArguments()[0] as Expression | undefined);
}

function recordResponse(
	responseIndex: Map<string, Set<string>>,
	status: string,
	contentType: string | undefined,
): void {
	const entry = responseIndex.get(status) ?? new Set<string>();
	if (contentType) entry.add(contentType);
	responseIndex.set(status, entry);
}

function finalizeResponses(
	responseIndex: Map<string, Set<string>>,
	defaultStatus: string,
): CodeScanResponse[] {
	if (responseIndex.size === 0) {
		return [
			{
				status: defaultStatus,
				description: "Response",
				contentTypes: [],
			},
		];
	}

	return Array.from(responseIndex.entries()).map(([status, types]) => ({
		status,
		description: "Response",
		contentTypes: Array.from(types),
	}));
}

function addPathParams(
	pathValue: string,
	paramMap: Map<string, CodeScanParam>,
): void {
	for (const name of extractPathParams(pathValue)) {
		addParam(paramMap, { name, in: "path", required: true });
	}
}

function extractPathParams(pathValue: string): string[] {
	const params: string[] = [];
	const regex = /\{([^}]+)\}/g;
	let match: RegExpExecArray | null = regex.exec(pathValue);
	while (match !== null) {
		params.push(match[1] as string);
		match = regex.exec(pathValue);
	}
	return params;
}

function inferOperationId(
	handler: Node | undefined,
	method: string,
	pathValue: string,
): string {
	const name = handler ? getFunctionLikeName(handler) : undefined;
	return name || camelCase(`${method} ${pathValue}`);
}

function getFunctionLikeName(handler: Node): string | undefined {
	if (
		Node.isFunctionDeclaration(handler) ||
		Node.isMethodDeclaration(handler)
	) {
		return (handler as FunctionDeclaration | MethodDeclaration).getName();
	}

	const parent = (handler as FunctionExpression | ArrowFunction).getParent();
	if (Node.isVariableDeclaration(parent)) {
		return (parent as VariableDeclaration).getName();
	}

	return undefined;
}

function extractDecoratorPath(decorator: Decorator): string | undefined {
	return extractPathFromExpression(
		decorator.getArguments()[0] as Expression | undefined,
	);
}

function extractDecoratorParams(
	method: MethodDeclaration,
	paramMap: Map<string, CodeScanParam>,
): void {
	for (const param of method.getParameters()) {
		const required = !param.hasQuestionToken();
		for (const decorator of param.getDecorators()) {
			const loc = DECORATOR_PARAM_LOCATIONS[decorator.getName()];
			if (!loc) continue;

			const arg = decorator.getArguments()[0] as Expression | undefined;
			const paramName = trimQuotes(
				extractStringLiteral(arg) ?? param.getName(),
			);
			addParam(paramMap, {
				name: paramName,
				in: loc,
				required: loc === "path" ? true : required,
			});
		}
	}
}

function buildRequestBodyFromDecoratorParams(
	method: MethodDeclaration,
): CodeScanRequestBody | undefined {
	for (const param of method.getParameters()) {
		for (const decorator of param.getDecorators()) {
			if (
				decorator.getName() === "Body" ||
				decorator.getName() === "BodyParam"
			) {
				const schema = inferSchemaFromTypeNode(param.getTypeNode());
				return {
					required: !param.hasQuestionToken(),
					contentTypes: ["application/json"],
					...(schema !== undefined ? { schema } : {}),
				};
			}
		}
	}
	return undefined;
}

function extractHttpCode(method: MethodDeclaration): string | undefined {
	const decorator = method
		.getDecorators()
		.find((dec) => ["HttpCode", "Status", "Code"].includes(dec.getName()));
	return decorator
		? extractLiteralText(decorator.getArguments()[0] as Expression | undefined)
		: undefined;
}

function extractPathFromExpression(
	expression?: Expression,
): string | undefined {
	if (!expression) return undefined;
	if (
		Node.isStringLiteral(expression) ||
		Node.isNoSubstitutionTemplateLiteral(expression)
	) {
		return expression.getLiteralText();
	}

	if (Node.isTemplateExpression(expression)) {
		let value = expression.getHead().getLiteralText();
		for (const span of expression.getTemplateSpans()) {
			const placeholder = placeholderForExpression(span.getExpression());
			value += `{${placeholder}}${span.getLiteral().getLiteralText()}`;
		}
		return value;
	}

	return undefined;
}

function placeholderForExpression(expression: Expression): string {
	if (Node.isIdentifier(expression)) return expression.getText();
	if (Node.isPropertyAccessExpression(expression)) return expression.getName();
	return extractStringLiteral(expression) ?? "param";
}

function normalizeRoutePath(value: string): string {
	let normalized = value.trim();
	if (!normalized) return "/";
	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`;
	}
	normalized = normalized.replace(/(^|\/):([A-Za-z0-9_]+)/g, "$1{$2}");
	return normalized;
}

function joinPaths(basePath: string, methodPath: string): string {
	const base = basePath.replace(/^\/+|\/+$/g, "");
	const tail = methodPath.replace(/^\/+|\/+$/g, "");
	const joined = [base, tail].filter(Boolean).join("/");
	return normalizeRoutePath(joined);
}

/**
 * Converts scanned `CodeScanParam` entries into OpenAPI `Parameter` objects.
 *
 * @param params - Scanned operation parameters.
 * @returns Array of OpenAPI `Parameter` definitions.
 */
export function buildParameters(params: CodeScanParam[]): Parameter[] {
	return params
		.filter(
			(param) => !(param.in === "header" && isReservedHeaderParam(param.name)),
		)
		.map((param) => {
			if (param.in === "querystring") {
				const contentType =
					param.contentType ?? "application/x-www-form-urlencoded";
				const contentEntry: {
					schema: SwaggerDefinition;
					encoding?: Record<string, OpenApiValue>;
					example?: OpenApiValue;
					examples?: Record<string, ExampleObject>;
				} = {
					schema: guessSchemaForContentType(contentType),
				};

				if (param.encoding) contentEntry.encoding = param.encoding;

				if (param.example !== undefined) {
					const wrapped = unwrapExampleCarrier(param.example);
					if (wrapped) {
						contentEntry.examples = { example: wrapped };
					} else {
						contentEntry.example = param.example;
					}
				}

				return {
					name: param.name,
					in: param.in as Parameter["in"],
					...(param.required !== undefined ? { required: param.required } : {}),
					description: param.description,
					content: {
						[contentType]: contentEntry,
					},
				} as Parameter;
			}

			const wrapped =
				param.example !== undefined
					? unwrapExampleCarrier(param.example)
					: undefined;

			return {
				name: param.name,
				in: param.in as Parameter["in"],
				...(param.in === "path"
					? { required: true }
					: param.required !== undefined
						? { required: param.required }
						: {}),
				description: param.description,
				schema: param.schema ?? { type: "string" },
				...(param.example !== undefined && !wrapped
					? { example: param.example }
					: {}),
				...(wrapped ? { examples: { example: wrapped } } : {}),
			} as Parameter;
		});
}

/**
 * Converts a scanned `CodeScanRequestBody` into an OpenAPI `RequestBody` object.
 *
 * @param requestBody - Optional scanned request body.
 * @returns OpenAPI `RequestBody` or `undefined`.
 */
export function buildRequestBody(
	requestBody?: CodeScanRequestBody,
): RequestBody | undefined {
	if (!requestBody || requestBody.contentTypes.length === 0) return undefined;

	const content = Object.fromEntries(
		requestBody.contentTypes.map((contentType) => [
			contentType,
			{ schema: requestBody.schema ?? guessSchemaForContentType(contentType) },
		]),
	);

	if (requestBody.examples) {
		Object.entries(content).forEach(([contentType, entry]) => {
			const example =
				requestBody.examples?.[contentType] ?? requestBody.examples?.["*"];
			if (example !== undefined) {
				const wrapped = unwrapExampleCarrier(example);
				if (wrapped) {
					(entry as { examples?: Record<string, ExampleObject> }).examples = {
						example: wrapped,
					};
				} else {
					(entry as { example?: OpenApiValue }).example = example;
				}
			}
		});
	}

	return {
		required: requestBody.required,
		content,
	} as RequestBody;
}

/**
 * Converts scanned `CodeScanResponse` entries into an OpenAPI `responses` map.
 *
 * @param responses - Scanned operation responses.
 * @returns Map of HTTP status codes to `SwaggerResponse` objects.
 */
export function buildResponses(
	responses: CodeScanResponse[],
): Record<string, SwaggerResponse> {
	const responseMap: Record<string, SwaggerResponse> = {};
	const normalized =
		responses.length > 0 ? responses : [{ status: "200", contentTypes: [] }];

	for (const response of normalized) {
		const description = response.description ?? "Response";

		const entry: SwaggerResponse = {
			description,
			...(response.summary ? { summary: response.summary } : {}),
		};

		if (response.contentTypes.length > 0) {
			entry.content = Object.fromEntries(
				response.contentTypes.map((contentType) => [
					contentType,
					{ schema: response.schema ?? guessSchemaForContentType(contentType) },
				]),
			);

			if (response.examples) {
				const examples = response.examples;
				Object.entries(entry.content).forEach(([contentType, media]) => {
					const example = examples[contentType] ?? examples["*"];
					if (example !== undefined) {
						const wrapped = unwrapExampleCarrier(example);
						if (wrapped) {
							(media as { examples?: Record<string, ExampleObject> }).examples =
								{ example: wrapped };
						} else {
							(media as { example?: OpenApiValue }).example = example;
						}
					}
				});
			}
		}

		responseMap[response.status] = entry;
	}

	return responseMap;
}

function guessSchemaForContentType(contentType: string): SwaggerDefinition {
	const normalized = contentType.toLowerCase();
	if (
		normalized.includes("json") ||
		normalized === "application/x-www-form-urlencoded" ||
		normalized === "multipart/form-data"
	) {
		return { type: "object" };
	}
	if (normalized === "application/octet-stream") {
		return { type: "string", format: "binary" };
	}
	return { type: "string" };
}
