/**
 * Represents the parsed output of a JSDoc comment block.
 */
export interface ParsedJSDoc {
    /** The main description parsed from the JSDoc block. */
    description?: string;
    /** The JSDoc tags parsed from the block. */
    tags?: Array<{
        /** The tag name without the @ symbol. */
        tagName: string;
        /** The text associated with the tag. */
        text?: string;
    }>;
}

/**
 * Parses a raw JSDoc comment string into its constituent description and tags.
 *
 * @param docComment - The raw JSDoc comment string, starting with '/**' and ending with '*\/'.
 * @returns An object containing the extracted description and tags.
 */
export function parseJSDoc(docComment: string): ParsedJSDoc {
    if (!docComment || typeof docComment !== 'string') {
        return {};
    }

    const lines = docComment.split('\n');
    const descriptionLines: string[] = [];
    const tags: Array<{ tagName: string; text?: string }> = [];

    let currentTag: { tagName: string; textLines: string[] } | null = null;

    for (const rawLine of lines) {
        // Strip the leading '/**', '*/', or '*' characters
        const cleanLine = rawLine
            .replace(/^\s*\/\*\*?/, '')
            .replace(/\*\/\s*$/, '')
            .replace(/^\s*\*\s?/, '');

        // Skip purely empty wrapper lines like '/**' and ' */'
        if (rawLine.trim() === '/**' || rawLine.trim() === '*/') {
            continue;
        }

        // Check if the line starts a new tag
        const tagMatch = cleanLine.match(/^\s*@([\w.-]+)(?:\s+(.*))?$/);

        if (tagMatch) {
            if (currentTag) {
                const textStr = currentTag.textLines.join('\n').trim();
                tags.push({
                    tagName: currentTag.tagName,
                    ...(textStr ? { text: textStr } : {}),
                });
            }
            currentTag = {
                tagName: tagMatch[1],
                textLines: tagMatch[2] ? [tagMatch[2]] : [],
            };
        } else if (currentTag) {
            // Append continuation lines to the current tag
            currentTag.textLines.push(cleanLine);
        } else {
            // Otherwise, it's part of the main description
            descriptionLines.push(cleanLine);
        }
    }

    if (currentTag) {
        const textStr = currentTag.textLines.join('\n').trim();
        tags.push({
            tagName: currentTag.tagName,
            ...(textStr ? { text: textStr } : {}),
        });
    }

    const description = descriptionLines.join('\n').trim();

    return {
        ...(description ? { description } : {}),
        ...(tags.length > 0 ? { tags } : {}),
    };
}
