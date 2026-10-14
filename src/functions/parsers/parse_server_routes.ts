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
	ParameterDeclaration,
	PropertyAccessExpression,
	PropertyAssignment,
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

				.filter((entry) => entry.method);

			if (httpDecorators.length === 0) continue;

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

				// Execute closure pattern for request body variable processing to match interfaces correctly

				const processRequestBody = () => {
					const rb = buildRequestBodyFromDecoratorParams(method);

					applyRequestExamples(rb, docMeta.requestExamples);

					return rb;
				};

				const requestBody = processRequestBody();

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
					method: entry.method!,
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

	const args = call.getArguments();

	const firstArg = args[0];

	const directPath = firstArg
		? extractPathFromExpression(firstArg as Expression)
		: undefined;

	if (directPath) {
		return {
			method,
			path: normalizeRoutePath(directPath),
			handlerOffset: 1,
		};
	}

	if (Node.isPropertyAccessExpression(callee)) {
		const target = callee.getExpression();

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
	}

	return undefined;
}

function extractRouteChainPath(call: CallExpression): string | undefined {
	const callee = call.getExpression();

	if (!Node.isPropertyAccessExpression(callee)) return undefined;

	if (callee.getName() !== "route") return undefined;

	const arg = call.getArguments()[0];

	return arg ? extractPathFromExpression(arg as Expression) : undefined;
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

			if (!decl) continue;

			if (Node.isFunctionDeclaration(decl)) return decl;

			if (Node.isMethodDeclaration(decl)) return decl;

			if (Node.isVariableDeclaration(decl)) {
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
			const element = elements[i];

			if (!Node.isExpression(element)) continue;

			const handler = resolveFunctionLike(element);

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

	const docMeta = handler ? extractDocMeta(handler as Node) : {};

	applyQuerystringMeta(docMeta, paramMap);

	applyParamDocs(paramMap, docMeta.paramDocs);

	applyParamExamples(paramMap, docMeta.paramExamples);

	const analysis = handler
		? analyzeExpressHandler(handler as Node, paramMap)
		: {
				requestBody: undefined,
				responses: [
					{ status: "200", description: "Response", contentTypes: [] },
				],
				responseSchema: undefined,
			};

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

	if (body) {
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
				const destructured = extractDestructuredParams(
					node as VariableDeclaration,
					bindings,
				);

				if (destructured.bodyUsed) {
					bodyUsed = true;
				}

				destructured.params.forEach((param) => addParam(paramMap, param));
			}
		};

		visit(body);

		body.forEachDescendant((descendant) => visit(descendant));
	}

	if (inferredSchemas.requestSchema !== undefined) {
		bodyUsed = true;
	}

	const responses = finalizeResponses(responseIndex, "200", false);

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

function getFunctionBody(handler: Node): Node | undefined {
	return (handler as OpenApiValue as { getBody?(): Node }).getBody?.();
}

function extractRequestBindings(handler: Node): RequestBindings {
	const bindings: RequestBindings = {};

	const params =
		(
			handler as OpenApiValue as {
				getParameters?(): ParameterDeclaration[];
			}
		).getParameters?.() ?? [];

	const reqParam = params[0];

	const resParam = params[1];

	if (reqParam) {
		const nameNode = reqParam.getNameNode();

		if (Node.isIdentifier(nameNode)) {
			bindings.reqName = nameNode.getText();
		} else if (Node.isObjectBindingPattern(nameNode)) {
			for (const element of nameNode.getElements()) {
				const propertyName =
					element.getPropertyNameNode()?.getText() ?? element.getName();

				const boundName = element.getName();

				switch (propertyName) {
					case "params":
						bindings.paramsName = boundName;

						break;
					case "query":
						bindings.queryName = boundName;

						break;
					case "headers":
						bindings.headersName = boundName;

						break;

					case "cookies":
						bindings.cookiesName = boundName;

						break;

					case "body":
						bindings.bodyName = boundName;

						break;
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
			return { location: nestedLocation, ...(name ? { name } : {}) };
		}

		const rootLocation = resolveRequestLocation(node, bindings);

		if (rootLocation === "body") {
			return { location: rootLocation };
		}

		return undefined;
	}

	if (Node.isElementAccessExpression(node)) {
		const argExpr = node.getArgumentExpression();

		const name = argExpr ? extractStringLiteral(argExpr) : undefined;

		const location = resolveRequestLocation(node.getExpression(), bindings);

		if (!location) return undefined;

		return { location: location, ...(name ? { name } : {}) };
	}

	return undefined;
}

function extractDestructuredParams(
	node: VariableDeclaration,
	bindings: RequestBindings,
): { params: CodeScanParam[]; bodyUsed: boolean } {
	const params: CodeScanParam[] = [];

	let bodyUsed = false;

	const nameNode = node.getNameNode();

	const initializer = node.getInitializer();

	if (!initializer || !Node.isObjectBindingPattern(nameNode)) {
		return { params, bodyUsed };
	}

	const location = resolveRequestLocation(initializer as Expression, bindings);

	if (!location) return { params, bodyUsed };

	if (location === "body") {
		bodyUsed = true;

		return { params, bodyUsed };
	}

	for (const element of nameNode.getElements()) {
		const propName =
			element.getPropertyNameNode()?.getText() ?? element.getName();

		params.push({ name: trimQuotes(propName), in: location });
	}

	return { params, bodyUsed };
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

		if (!Node.isIdentifier(base)) return undefined;

		if (base.getText() !== bindings.reqName) return undefined;

		const name = expression.getName();

		if (name === "params") return "path";

		if (name === "query") return "query";

		if (name === "headers") return "header";

		if (name === "cookies") return "cookie";

		if (name === "body") return "body";
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
		const arg0 = call.getArguments()[0];

		const status =
			(arg0 ? extractLiteralText(arg0 as Expression) : undefined) ?? "200";

		return { status };
	}

	if (method === "json" || method === "send" || method === "end") {
		const chainMeta = extractResponseChainMeta(callee.getExpression(), resName);

		let contentType = chainMeta.contentType;

		if (method === "json") {
			contentType = "application/json";
		}

		if (method === "send" && !contentType) {
			const arg0 = call.getArguments()[0];

			contentType = inferContentTypeFromSend(
				arg0 ? (arg0 as Expression) : undefined,
			);
		}

		return {
			status: chainMeta.status ?? "200",
			...(contentType ? { contentType } : {}),
		};
	}

	return undefined;
}

function extractResponseChainMeta(
	expression: Expression,
	resName: string,
): { status?: string; contentType?: string } {
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

		if (!isResponseChain(target, resName)) break;

		if (method === "status") {
			const arg0 = current.getArguments()[0];

			status =
				(arg0 ? extractLiteralText(arg0 as Expression) : undefined) ?? status;
		}

		if (method === "type") {
			const arg0 = current.getArguments()[0];

			contentType =
				(arg0 ? extractStringLiteral(arg0 as Expression) : undefined) ??
				contentType;
		}

		if (method === "set" || method === "header") {
			const [nameArg, valueArg] = current.getArguments();

			const headerName = nameArg
				? extractStringLiteral(nameArg as Expression)
				: undefined;

			if (headerName && headerName.toLowerCase() === "content-type") {
				contentType =
					(valueArg
						? extractStringLiteral(valueArg as Expression)
						: undefined) ?? contentType;
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

	if (Node.isPropertyAccessExpression(expression)) {
		return isResponseChain(expression.getExpression(), resName);
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

	if (!Node.isPropertyAccessExpression(callee)) return undefined;

	if (callee.getName() !== "is") return undefined;

	if (!Node.isIdentifier(callee.getExpression())) return undefined;

	if (callee.getExpression().getText() !== reqName) return undefined;

	const arg0 = call.getArguments()[0];

	return arg0 ? extractStringLiteral(arg0 as Expression) : undefined;
}

function extractRequestHeaderName(
	call: CallExpression,
	reqName: string,
): string | undefined {
	const callee = call.getExpression();

	if (!Node.isPropertyAccessExpression(callee)) return undefined;

	const method = callee.getName();

	if (method !== "get" && method !== "header") return undefined;

	if (!Node.isIdentifier(callee.getExpression())) return undefined;

	if (callee.getExpression().getText() !== reqName) return undefined;

	const arg0 = call.getArguments()[0];

	return arg0 ? extractStringLiteral(arg0 as Expression) : undefined;
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
	assumeJson: boolean,
): CodeScanResponse[] {
	if (responseIndex.size === 0) {
		return [
			{
				status: defaultStatus,
				description: "Response",

				contentTypes: assumeJson ? ["application/json"] : [],
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
	let match: RegExpExecArray | null;

	while ((match = regex.exec(pathValue)) !== null) {
		params.push(match[1]);
	}

	return params;
}

function inferOperationId(
	handler: Node | undefined,
	method: string,
	pathValue: string,
): string {
	if (handler) {
		const name = getFunctionLikeName(handler);

		if (name) return name;
	}

	return (
		camelCase(`${method} ${pathValue}`) || `${method.toLowerCase()}Operation`
	);
}

function getFunctionLikeName(handler: Node): string | undefined {
	if (
		Node.isFunctionDeclaration(handler) ||
		Node.isMethodDeclaration(handler)
	) {
		return (handler as FunctionDeclaration | MethodDeclaration).getName();
	}

	if (Node.isFunctionExpression(handler) || Node.isArrowFunction(handler)) {
		const parent = (handler as FunctionExpression | ArrowFunction).getParent();

		if (Node.isVariableDeclaration(parent)) {
			return (parent as VariableDeclaration).getName();
		}

		if (Node.isPropertyAssignment(parent)) {
			return (parent as PropertyAssignment).getName();
		}
	}

	return undefined;
}

function extractDecoratorPath(decorator: Decorator): string | undefined {
	const arg = decorator.getArguments()[0];

	return arg ? extractPathFromExpression(arg as Expression) : undefined;
}

function extractDecoratorParams(
	method: MethodDeclaration,
	paramMap: Map<string, CodeScanParam>,
): void {
	for (const param of method.getParameters()) {
		const required = !param.hasQuestionToken();

		for (const decorator of param.getDecorators()) {
			const name = decorator.getName();

			const arg = decorator.getArguments()[0];

			const paramName = trimQuotes(
				(arg ? extractStringLiteral(arg as Expression) : undefined) ??
					param.getName(),
			);

			if (name === "Param" || name === "Path" || name === "PathParam") {
				addParam(paramMap, { name: paramName, in: "path", required: true });

				continue;
			}

			if (name === "Query") {
				addParam(paramMap, { name: paramName, in: "query", required });

				continue;
			}

			if (name === "Header" || name === "Headers") {
				if (paramName) {
					addParam(paramMap, { name: paramName, in: "header", required });
				}

				continue;
			}

			if (name === "Cookie" || name === "Cookies") {
				if (paramName) {
					addParam(paramMap, { name: paramName, in: "cookie", required });
				}
			}
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

	if (!decorator) return undefined;

	const arg = decorator.getArguments()[0];

	return arg ? extractLiteralText(arg as Expression) : undefined;
}

function extractPathFromExpression(expression: Expression): string | undefined {
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

	if (
		Node.isStringLiteral(expression) ||
		Node.isNoSubstitutionTemplateLiteral(expression)
	) {
		return expression.getLiteralText();
	}

	return "param";
}

function normalizeRoutePath(value: string): string {
	let normalized = value.trim();

	if (!normalized) return "/";

	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`;
	}

	normalized = normalized.replace(/(^|\/):([A-Za-z0-9_]+)/g, "$1{$2}");

	return normalized || "/";
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

				if (param.encoding) {
					contentEntry.encoding = param.encoding;
				}

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
				...(param.example !== undefined && !unwrapExampleCarrier(param.example)
					? { example: param.example }
					: {}),

				...(param.example !== undefined && unwrapExampleCarrier(param.example)
					? {
							examples: {
								example: unwrapExampleCarrier(param.example) as ExampleObject,
							},
						}
					: {}),
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
	if (!requestBody) return undefined;

	if (requestBody.contentTypes.length === 0) return undefined;

	const content = Object.fromEntries(
		requestBody.contentTypes.map((contentType) => [
			contentType,
			{ schema: requestBody.schema ?? guessSchemaForContentType(contentType) },
		]),
	);

	if (requestBody.examples && Object.keys(requestBody.examples).length > 0) {
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
		...(requestBody.required !== undefined
			? { required: requestBody.required }
			: { required: true }),

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
		const description =
			response.description ??
			(response.status === "default" ? "Default response" : "Response");

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

			if (response.examples && Object.keys(response.examples).length > 0) {
				Object.entries(entry.content).forEach(([contentType, media]) => {
					const example =
						response.examples?.[contentType] ?? response.examples?.["*"];

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

	if (normalized.includes("json")) {
		return { type: "object" };
	}

	if (normalized.startsWith("text/")) {
		return { type: "string" };
	}

	if (normalized.includes("xml")) {
		return { type: "string" };
	}

	if (normalized === "application/octet-stream") {
		return { type: "string", format: "binary" };
	}

	if (normalized === "application/x-www-form-urlencoded") {
		return { type: "object" };
	}

	if (normalized === "multipart/form-data") {
		return { type: "object" };
	}

	return { type: "string" };
}
