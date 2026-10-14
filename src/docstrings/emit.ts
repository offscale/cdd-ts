/**
 * Emits sanitized JSDoc comment blocks from structured descriptions and tags.
 *
 * @module docstrings/emit
 */
import { sanitizeComment } from "../functions/utils_sanitizer.js";

/**
 * Represents a single JSDoc tag entry to emit.
 */
export interface JSDocTag {
	/** The tag name without the @ symbol (e.g., 'param'). */
	tagName: string;
	/** The text/description associated with the tag. */
	text?: string;
}

/**
 * Options for generating a JSDoc comment block.
 */
export interface JSDocEmitOptions {
	/** The summary or main description for the JSDoc block. */
	description?: string;
	/** Array of JSDoc tags (e.g., param, returns) to include. */
	tags?: JSDocTag[];
	/** Whether to format as a single-line comment if possible. */
	singleLine?: boolean;
}

/**
 * Emits a properly formatted JSDoc string based on the provided options.
 * It automatically sanitizes the input to prevent injection attacks.
 *
 * @param options - Configuration for the JSDoc generation.
 * @returns The formatted JSDoc string, or an empty string if no content is provided.
 */
export function emitJSDoc(options: JSDocEmitOptions): string {
	const lines: string[] = [];

	if (options.description) {
		const sanitizedDesc = sanitizeComment(options.description);
		if (sanitizedDesc) {
			lines.push(...sanitizedDesc.split("\n"));
		}
	}

	if (options.tags && options.tags.length > 0) {
		if (lines.length > 0) {
			lines.push(""); // Blank line between description and tags
		}
		for (const tag of options.tags) {
			const sanitizedText = sanitizeComment(tag.text);
			const textPart = sanitizedText ? ` ${sanitizedText}` : "";
			lines.push(`@${tag.tagName}${textPart}`);
		}
	}

	if (lines.length === 0) {
		return "";
	}

	if (options.singleLine && lines.length === 1) {
		return `/** ${lines[0]} */`;
	}

	const formattedLines = lines.map((line) => (line ? ` * ${line}` : ` *`));
	return ["/**", ...formattedLines, " */"].join("\n");
}
