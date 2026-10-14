/**
 * Case conversion, pluralization, and URI/URL validation string utilities.
 *
 * @module functions/utils_string
 */

/**
 * A simple singularization function for English words. Handles common plural endings.
 *
 * @param str - The plural string to singularize.
 * @returns The singular form of the string.
 */
export function singular(str: string): string {
	if (str.endsWith("ies")) {
		return `${str.slice(0, -3)}y`;
	}

	if (str.endsWith("s")) {
		return str.slice(0, -1);
	}

	return str;
}

/**
 * Normalizes an arbitrary string into space-separated lowercase words.
 *
 * @param str - Input string to normalize.
 * @returns Normalized space-delimited lowercase words.
 */
function normalizeString(str: string): string {
	if (!str) return "";

	return str
		.replace(/[^a-zA-Z0-9\s_-]/g, " ")
		.replace(/^[_-]+|[-_]+$/g, "")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

/**
 * Converts a string to `camelCase`.
 *
 * @param str - Input string.
 * @returns The `camelCase` identifier (prefixed with `api` if starting with a digit).
 */
export function camelCase(str: string): string {
	const normalized = normalizeString(str);

	if (!normalized) return "";

	const result = normalized.replace(
		/\s(.)/g,
		(_: string, char: string): string => char.toUpperCase(),
	);

	if (/^[0-9]/.test(result)) {
		return `api${result}`;
	}
	return result;
}

/**
 * Converts a string to `snake_case`.
 *
 * @param str - Input string.
 * @returns The `snake_case` string.
 */
export function snakeCase(str: string): string {
	const normalized = normalizeString(str);
	if (!normalized) return "";
	return normalized.replace(/\s+/g, "_");
}

/**
 * Converts a string to `PascalCase` (`UpperCamelCase`).
 *
 * @param str - Input string.
 * @returns The `PascalCase` identifier (prefixed with `Api` if starting with a digit).
 */
export function pascalCase(str: string): string {
	const normalized = normalizeString(str);

	if (!normalized) return "";

	const result = normalized.replace(
		/(^|\s)(.)/g,
		(_: string, __: string, char: string): string => char.toUpperCase(),
	);

	if (/^[0-9]/.test(result)) {
		return `Api${result}`;
	}
	return result;
}

/**
 * Converts a string to `kebab-case`.
 *
 * @param str - Input string.
 * @returns The `kebab-case` string.
 */
export function kebabCase(str: string): string {
	if (!str) return "";

	return str
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Checks if a string is a valid absolute URL.
 *
 * @param input - String to test.
 * @returns `true` if `input` is a valid URL; otherwise `false`.
 */
export function isUrl(input: string): boolean {
	if (typeof URL !== "undefined") {
		try {
			new URL(input);
			return true;
		} catch {
			return false;
		}
	}

	// WASM / QuickJS Fallback
	return /^[a-zA-Z][a-zA-Z\d+\-.]*:(?:\/\/)?(?:[\w\-.~!$&'()*+,;=:@]+)?(?:[\w\-.~!$&'()*+,;=:@/?#]+)?$/i.test(
		input,
	);
}

/**
 * Checks if a string looks like a URI reference (absolute, fragment, or relative).
 * Useful for distinguishing Security Requirement keys from component names (OAS 3.2).
 *
 * @param input - Candidate string to inspect.
 * @returns `true` if `input` looks like a URI reference; otherwise `false`.
 */
export function isUriReference(input: string): boolean {
	if (!input) return false;

	const value = input.trim();

	if (!value) return false;

	if (
		value.startsWith("#") ||
		value.startsWith("./") ||
		value.startsWith("../")
	)
		return true;

	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return true;

	return /[/?#]/.test(value);
}
