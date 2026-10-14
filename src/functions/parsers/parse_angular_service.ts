/**
 * Extracts HTTP method and return type metadata from Angular `@Injectable` / `HttpClient` service methods.
 *
 * @module functions/parsers/parse_angular_service
 */

/**
 * Extracted HTTP method and return type hint from an Angular `HttpClient` service method.
 */
export interface AngularHttpCallMatch {
	/** Normalized uppercase HTTP method (e.g. `"GET"`, `"POST"`). */
	httpMethod: string;
	/** Extracted inner TypeScript return type hint (unwrapped from `Observable<T>`). */
	returnTypeHint?: string;
}

/**
 * Inspects a generated Angular service method body and return type annotation to extract the HTTP verb and response type hint.
 *
 * @param methodBody - Body text of the service method.
 * @param returnTypeFull - Optional raw return type annotation string (e.g. `"Observable<Pet>"`).
 * @returns Matched `AngularHttpCallMatch`, or `undefined` if the method is not an Angular `HttpClient` method.
 */
export function extractAngularHttpCall(
	methodBody: string,
	returnTypeFull?: string,
): AngularHttpCallMatch | undefined {
	const directMatch =
		/this\.http\.(get|post|put|delete|patch|head|options)<([^>]+)>\(([^,]+)/.exec(
			methodBody,
		);

	const requestMatch =
		/this\.http\.request(?:<([^>]+)>)?\('([^']+)',\s*([^,]+)/.exec(methodBody);

	if (!directMatch && !requestMatch) {
		return undefined;
	}

	let returnTypeHint: string | undefined;
	if (
		returnTypeFull?.startsWith("Observable<") &&
		returnTypeFull.endsWith(">")
	) {
		returnTypeHint = returnTypeFull.slice(11, -1);
	}

	let httpMethod = "GET";
	if (directMatch) {
		httpMethod = directMatch[1]!.toUpperCase();
		if (!returnTypeHint) {
			returnTypeHint = directMatch[2];
		}
	} else if (requestMatch) {
		httpMethod = requestMatch[2]!.toUpperCase();
		if (!returnTypeHint) {
			returnTypeHint = requestMatch[1];
		}
	}

	return {
		httpMethod,
		...(returnTypeHint !== undefined ? { returnTypeHint } : {}),
	};
}
