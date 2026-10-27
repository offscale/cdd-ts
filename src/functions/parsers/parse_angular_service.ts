/**
 * Extracts HTTP method, return type metadata, service DI metadata, and Angular v22+ best-practices audit diagnostics from Angular service and component sources.
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
 * Extracted Angular service decorator and dependency-injection metadata.
 */
export interface AngularServiceMetadata {
	/** Detected Angular service decorator (`"Service"` for Angular v22+ or `"Injectable"`). */
	decorator?: "Service" | "Injectable";
	/** Detected `providedIn` scope (`"root"` for `@Service()` or `@Injectable({ providedIn: 'root' })`). */
	providedIn?: string;
	/** Whether the service uses Angular's `inject()` function for dependency injection. */
	usesInjectFunction: boolean;
	/** Whether the service uses legacy constructor parameter injection. */
	usesConstructorInjection: boolean;
	/** Property name holding the injected `HttpClient` instance (defaults to `"http"`). */
	httpClientProperty: string;
}

/**
 * Identifier for an Angular best-practice rule violation.
 */
export type AngularBestPracticeRuleId =
	| "no-explicit-standalone-true"
	| "no-explicit-onpush"
	| "prefer-service-decorator"
	| "prefer-inject-function"
	| "prefer-signal-inputs-outputs"
	| "no-host-decorators"
	| "no-common-module"
	| "no-ng-class-or-style"
	| "prefer-native-control-flow"
	| "no-signal-mutate"
	| "no-any-type"
	| "no-testing-ngmodules"
	| "no-unoptimized-static-img"
	| "no-template-global-date";

/**
 * Represents a single Angular best-practice violation detected during static source inspection.
 */
export interface AngularBestPracticeViolation {
	/** Machine-readable rule identifier. */
	rule: AngularBestPracticeRuleId;
	/** Human-readable explanation of the violation and recommended remediation. */
	message: string;
}

/**
 * Result of auditing an Angular TypeScript or HTML source string against Angular v22+ best practices.
 */
export interface AngularBestPracticesAuditResult {
	/** `true` when zero violations were found. */
	compliant: boolean;
	/** List of detected Angular best-practice violations. */
	violations: AngularBestPracticeViolation[];
}

/**
 * Extracts Angular service decorator (`@Service` vs `@Injectable`) and `HttpClient` DI metadata from source text.
 *
 * @param sourceText - TypeScript source text of a service class or file.
 * @returns Parsed `AngularServiceMetadata` descriptor.
 */
export function extractAngularServiceMetadata(
	sourceText: string,
): AngularServiceMetadata {
	let decorator: "Service" | "Injectable" | undefined;
	let providedIn: string | undefined;

	if (/@Service\s*\(/.test(sourceText)) {
		decorator = "Service";
		providedIn = "root";
	} else if (/@Injectable\s*\(/.test(sourceText)) {
		decorator = "Injectable";
		const providedInMatch =
			/@Injectable\s*\(\s*\{[\s\S]*?providedIn\s*:\s*['"]([^'"]+)['"][\s\S]*?\}\s*\)/.exec(
				sourceText,
			);
		if (providedInMatch?.[1]) {
			providedIn = providedInMatch[1];
		}
	}

	const usesInjectFunction = /\binject\s*\(/.test(sourceText);
	const usesConstructorInjection =
		/\bconstructor\s*\([^)]*\b(?:private|protected|public|readonly)\s+\w+/.test(
			sourceText,
		);

	const injectHttpMatch =
		/\b(?:private|protected|public|readonly|\s)*(\w+)\s*(?::\s*HttpClient)?\s*=\s*inject\(\s*HttpClient\b/.exec(
			sourceText,
		);
	const ctorHttpMatch =
		/\bconstructor\s*\([^)]*\b(?:private|protected|public|readonly)\s+(?:readonly\s+)?(\w+)\s*:\s*HttpClient\b/.exec(
			sourceText,
		);

	const httpClientProperty =
		injectHttpMatch?.[1] ?? ctorHttpMatch?.[1] ?? "http";

	return {
		...(decorator !== undefined ? { decorator } : {}),
		...(providedIn !== undefined ? { providedIn } : {}),
		usesInjectFunction,
		usesConstructorInjection,
		httpClientProperty,
	};
}

/**
 * Inspects a generated Angular service method body and return type annotation to extract the HTTP verb and response type hint.
 *
 * @param methodBody - Body text of the service method.
 * @param returnTypeFull - Optional raw return type annotation string (e.g. `"Observable<Pet>"`).
 * @param httpPropertyName - Optional property name for the injected `HttpClient` (defaults to `"http"`).
 * @returns Matched `AngularHttpCallMatch`, or `undefined` if the method is not an Angular `HttpClient` method.
 */
export function extractAngularHttpCall(
	methodBody: string,
	returnTypeFull?: string,
	httpPropertyName = "http",
): AngularHttpCallMatch | undefined {
	const safeProp = httpPropertyName.replace(/\W/g, "");

	const directRegex = new RegExp(
		String.raw`this\.${safeProp}\.(get|post|put|delete|patch|head|options)(?:<([^>]+)>)?\(([^,]+)`,
	);
	const requestRegex = new RegExp(
		String.raw`this\.${safeProp}\.request(?:<([^>]+)>)?\('([^']+)',\s*([^,]+)`,
	);

	const directMatch = directRegex.exec(methodBody);
	const requestMatch = requestRegex.exec(methodBody);

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
	if (directMatch?.[1]) {
		httpMethod = directMatch[1].toUpperCase();
		if (!returnTypeHint && directMatch[2]) {
			returnTypeHint = directMatch[2];
		}
	} else {
		const reqMatch = requestMatch as RegExpExecArray;
		httpMethod = (reqMatch[2] as string).toUpperCase();
		if (!returnTypeHint && reqMatch[1]) {
			returnTypeHint = reqMatch[1];
		}
	}

	return {
		httpMethod,
		...(returnTypeHint !== undefined ? { returnTypeHint } : {}),
	};
}

/**
 * Audits an Angular TypeScript or HTML template source string against Angular v22+ best practices.
 *
 * @param sourceText - TypeScript or HTML template source text to inspect.
 * @returns `AngularBestPracticesAuditResult` listing any detected violations.
 */
export function auditAngularSourceBestPractices(
	sourceText: string,
): AngularBestPracticesAuditResult {
	const violations: AngularBestPracticeViolation[] = [];

	if (/\bstandalone\s*:\s*true\b/.test(sourceText)) {
		violations.push({
			rule: "no-explicit-standalone-true",
			message:
				"Do not set `standalone: true` inside Angular decorators; standalone is the default in Angular v20+.",
		});
	}

	if (
		/\bchangeDetection\s*:\s*ChangeDetectionStrategy\.OnPush\b/.test(sourceText)
	) {
		violations.push({
			rule: "no-explicit-onpush",
			message:
				"Do not set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly; OnPush is the default in Angular v22+.",
		});
	}

	if (
		/@Injectable\s*\(\s*\{\s*providedIn\s*:\s*['"]root['"]\s*\}\s*\)/.test(
			sourceText,
		)
	) {
		violations.push({
			rule: "prefer-service-decorator",
			message:
				"Prefer `@Service()` over `@Injectable({ providedIn: 'root' })` for singleton services in Angular v22+.",
		});
	}

	if (
		/\bconstructor\s*\([^)]*\b(?:private|protected|public|readonly)\s+\w+/.test(
			sourceText,
		)
	) {
		violations.push({
			rule: "prefer-inject-function",
			message:
				"Use the `inject()` function instead of constructor parameter injection.",
		});
	}

	if (/@(?:Input|Output)\s*\(/.test(sourceText)) {
		violations.push({
			rule: "prefer-signal-inputs-outputs",
			message:
				"Use `input()`, `output()`, or `model()` functions instead of `@Input()` and `@Output()` decorators.",
		});
	}

	if (/@(?:HostBinding|HostListener)\s*\(/.test(sourceText)) {
		violations.push({
			rule: "no-host-decorators",
			message:
				"Do not use `@HostBinding` or `@HostListener` decorators; configure host bindings in the `host` metadata object.",
		});
	}

	if (/\bCommonModule\b/.test(sourceText)) {
		violations.push({
			rule: "no-common-module",
			message:
				"Do not import `CommonModule`; use native control flow and import only specific pipes or directives needed.",
		});
	}

	if (/\b(?:ngClass|ngStyle)\b|\[(?:ngClass|ngStyle)\]/.test(sourceText)) {
		violations.push({
			rule: "no-ng-class-or-style",
			message:
				"Do not use `ngClass` or `ngStyle`; use native `[class]` and `[style]` bindings instead.",
		});
	}

	if (/\*ng(?:If|For|Switch)\b/.test(sourceText)) {
		violations.push({
			rule: "prefer-native-control-flow",
			message:
				"Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`.",
		});
	}

	if (/\.mutate\s*\(/.test(sourceText)) {
		violations.push({
			rule: "no-signal-mutate",
			message:
				"Do not use `.mutate()` on signals; use `.update()` or `.set()` instead.",
		});
	}

	if (/:\s*any\b|<any>|as\s+any\b/.test(sourceText)) {
		violations.push({
			rule: "no-any-type",
			message:
				"Avoid the `any` type; use strict types or `unknown` when the type is uncertain.",
		});
	}

	if (/\b(?:HttpClientTestingModule|NoopAnimationsModule)\b/.test(sourceText)) {
		violations.push({
			rule: "no-testing-ngmodules",
			message:
				"Use standalone provider functions (`provideHttpClient()`, `provideHttpClientTesting()`, `provideNoopAnimations()`) instead of testing NgModules.",
		});
	}

	if (
		/<img\b(?![^>]*\bngSrc\b)[^>]*\bsrc\s*=\s*['"](?!data:)[^'"]+['"]/.test(
			sourceText,
		)
	) {
		violations.push({
			rule: "no-unoptimized-static-img",
			message:
				"Use `NgOptimizedImage` (`ngSrc`) for static images instead of `src` (excluding inline base64 `data:` images).",
		});
	}

	if (/\{\{[^}]*\bnew\s+Date\s*\(/.test(sourceText)) {
		violations.push({
			rule: "no-template-global-date",
			message:
				"Do not assume globals like `new Date()` are available inside Angular templates.",
		});
	}

	return {
		compliant: violations.length === 0,
		violations,
	};
}
