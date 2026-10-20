/**
 * Extracts HTTP method and return type metadata from Fetch, Axios, and Node Promise-based service methods.
 *
 * @module functions/parsers/parse_promise_service
 */

/**
 * Extracted HTTP method and return type hint from a Promise-based (`fetch` / `axios` / `http.request`) service method.
 */
export interface PromiseHttpCallMatch {
	/** Normalized uppercase HTTP method (e.g. `"GET"`, `"POST"`). */
	httpMethod: string;
	/** Extracted inner TypeScript return type hint. */
	returnTypeHint?: string;
}

/**
 * Inspects a generated Fetch, Axios, or Node service method body and return type annotation to extract the HTTP verb and response type hint.
 *
 * @param methodBody - Body text of the service method.
 * @param returnTypeFull - Optional raw return type annotation string (e.g. `"Promise<Pet>"` or `"Observable<Pet>"`).
 * @returns Matched `PromiseHttpCallMatch`, or `undefined` if no Fetch/Axios/Node call is detected.
 */
export function extractPromiseHttpCall(
	methodBody: string,
	returnTypeFull?: string,
): PromiseHttpCallMatch | undefined {
	const fetchMatch = /fetch\(([^)]+)\)/.exec(methodBody);
	const axiosMatch = /axiosInstance\.request(?:<([^>]+)>)?\(/.exec(methodBody);
	const nodeMatch = /request\s*\(\s*requestOptions/.exec(methodBody);

	if (!fetchMatch && !axiosMatch && !nodeMatch) {
		return undefined;
	}

	let returnTypeHint: string | undefined;
	if (
		returnTypeFull?.startsWith("Observable<") &&
		returnTypeFull.endsWith(">")
	) {
		returnTypeHint = returnTypeFull.slice(11, -1);
	} else if (
		returnTypeFull?.startsWith("Promise<") &&
		returnTypeFull.endsWith(">")
	) {
		returnTypeHint = returnTypeFull.slice(8, -1);
	}

	let httpMethod = "GET";
	if (fetchMatch) {
		const fOpts = /fetch\([^,]+,\s*([^)]+)\)/.exec(methodBody);
		if (fOpts?.[1]) {
			const methodM = /method:\s*['"]([^'"]+)['"]/.exec(fOpts[1]);
			if (methodM?.[1]) httpMethod = methodM[1].toUpperCase();
		}
		if (!returnTypeHint) {
			const obsMatch = /new Observable<([^>]+)>/.exec(methodBody);
			if (obsMatch) {
				returnTypeHint = obsMatch[1];
			}
		}
	} else {
		const methodM = /method:\s*['"]([^'"]+)['"]/.exec(methodBody);
		if (methodM?.[1]) {
			httpMethod = methodM[1].toUpperCase();
		}
		if (!returnTypeHint && axiosMatch?.[1]) {
			returnTypeHint = axiosMatch[1];
		}
	}

	return {
		httpMethod,
		...(returnTypeHint !== undefined ? { returnTypeHint } : {}),
	};
}
