/**
 * Naming and Angular `InjectionToken` identifier helpers for generated client SDKs.
 *
 * @module functions/utils_naming
 */
import type { MethodDeclaration } from "ts-morph";

/**
 * Checks for duplicate method names in an array of ts-morph `MethodDeclaration` objects.
 *
 * @param methods - Array of `MethodDeclaration` nodes to inspect.
 * @returns `true` if any two methods share the same name; otherwise `false`.
 */
export function hasDuplicateFunctionNames(
	methods: MethodDeclaration[],
): boolean {
	const names = methods.map((m) => m.getName());

	return new Set(names).size !== names.length;
}

/**
 * Normalizes a security scheme key.
 * If the key is a JSON pointer/URI, it extracts the simple name. Otherwise returns the key as is.
 *
 * @param key - Raw security scheme name or URI reference.
 * @returns Normalized security scheme identifier.
 */
export function normalizeSecurityKey(key: string): string {
	const withoutQuery = key.split("?")[0] as string;

	const [, fragment] = withoutQuery.split("#");

	const target = fragment ?? withoutQuery;

	const parts = target.split("/").filter(Boolean);

	return parts.length > 0 ? (parts[parts.length - 1] as string) : key;
}

/**
 * Returns the constant identifier for the `BASE_PATH` Angular `InjectionToken`.
 *
 * @param clientName - Client name identifier (defaults to `"default"`).
 * @returns Uppercase token constant name (e.g., `"BASE_PATH_DEFAULT"`).
 */
export function getBasePathTokenName(clientName = "default"): string {
	const clientSuffix = clientName.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

	return `BASE_PATH_${clientSuffix}`;
}

/**
 * Returns the constant identifier for the `CLIENT_CONTEXT_TOKEN` Angular `HttpContextToken`.
 *
 * @param clientName - Client name identifier (defaults to `"default"`).
 * @returns Uppercase token constant name (e.g., `"CLIENT_CONTEXT_TOKEN_DEFAULT"`).
 */
export function getClientContextTokenName(clientName = "default"): string {
	const clientSuffix = clientName.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

	return `CLIENT_CONTEXT_TOKEN_${clientSuffix}`;
}

/**
 * Returns the constant identifier for the `SERVER_VARIABLES` Angular `InjectionToken`.
 *
 * @param clientName - Client name identifier (defaults to `"default"`).
 * @returns Uppercase token constant name (e.g., `"SERVER_VARIABLES_DEFAULT"`).
 */
export function getServerVariablesTokenName(clientName = "default"): string {
	const clientSuffix = clientName.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

	return `SERVER_VARIABLES_${clientSuffix}`;
}

/**
 * Returns the constant identifier for the `HTTP_INTERCEPTORS` token for a named client.
 *
 * @param clientName - Client name identifier (defaults to `"default"`).
 * @returns Uppercase token constant name (e.g., `"HTTP_INTERCEPTORS_DEFAULT"`).
 */
export function getInterceptorsTokenName(clientName = "default"): string {
	const clientSuffix = clientName.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

	return `HTTP_INTERCEPTORS_${clientSuffix}`;
}
