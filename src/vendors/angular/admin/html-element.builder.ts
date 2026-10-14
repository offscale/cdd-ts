/**
 * Fluent HTML template fragment builder for Angular component templates.
 *
 * @module vendors/angular/admin/html-element.builder
 */

/**
 * A simple, fluent, string-based builder for creating HTML-like template fragments.
 * This completely avoids using a DOM parser (like jsdom), which is too strict for
 * Angular's template syntax (e.g., `@if`, `[prop]`, `(event)`).
 */
export class HtmlElementBuilder {
	private tagName: string;

	private attributes: Map<string, string> = new Map();

	private children: (HtmlElementBuilder | string)[] = [];

	private innerHtml: string | null = null;

	private textContent: string | null = null;

	private isSelfClosing: boolean = false;

	/**
	 * Creates a new `HtmlElementBuilder` for the given HTML tag.
	 *
	 * @param tagName - HTML or Angular component tag name.
	 */
	private constructor(tagName: string) {
		this.tagName = tagName;
	}

	/**
	 * Factory method creating a new `HtmlElementBuilder` for `tagName`.
	 *
	 * @param tagName - HTML or Angular element tag name.
	 * @returns A new `HtmlElementBuilder` instance.
	 */
	public static create(tagName: string): HtmlElementBuilder {
		return new HtmlElementBuilder(tagName);
	}

	/**
	 * Marks this element as self-closing (`<tag />`).
	 *
	 * @returns This builder instance for chaining.
	 */
	public selfClosing(): this {
		this.isSelfClosing = true;

		return this;
	}

	/**
	 * Sets an HTML or Angular template attribute on the element.
	 *
	 * @param name - Attribute name (e.g. `"[formGroup]"`).
	 * @param value - Attribute value string.
	 * @returns This builder instance for chaining.
	 */
	public setAttribute(name: string, value: string): this {
		this.attributes.set(name, value);

		return this;
	}

	/**
	 * Appends a CSS class name to the element's `class` attribute.
	 *
	 * @param className - CSS class name to add.
	 * @returns This builder instance for chaining.
	 */
	public addClass(className: string): this {
		const existingClass = this.attributes.get("class");

		this.attributes.set(
			"class",
			existingClass ? `${existingClass} ${className}` : className,
		);

		return this;
	}

	/**
	 * Appends a child element builder or raw string node.
	 *
	 * @param child - Child `HtmlElementBuilder` or raw template string.
	 * @returns This builder instance for chaining.
	 */
	public appendChild(child: HtmlElementBuilder | string): this {
		this.children.push(child);

		return this;
	}

	/**
	 * Sets plain inline text content for the element.
	 *
	 * @param text - Text content string.
	 * @returns This builder instance for chaining.
	 */
	public setTextContent(text: string): this {
		this.textContent = text;

		return this;
	}

	/**
	 * Sets raw inner HTML / Angular template markup for the element.
	 *
	 * @param html - Raw inner HTML string.
	 * @returns This builder instance for chaining.
	 */
	public setInnerHtml(html: string): this {
		this.innerHtml = html;

		return this;
	}

	/**
	 * Renders the element and its children as an indented HTML template string.
	 *
	 * @param indentationLevel - Current 2-space indentation depth.
	 * @returns Formatted HTML string.
	 */
	public render(indentationLevel = 0): string {
		const indent = "  ".repeat(indentationLevel);

		const attrs = Array.from(this.attributes.entries())

			.map(([key, value]) => `${key}="${value}"`)
			.join(" ");

		const openingTagFirstPart = `${indent}<${this.tagName}${attrs ? ` ${attrs}` : ""}`;

		if (this.isSelfClosing) {
			return `${openingTagFirstPart} />`;
		}

		const openingTag = `${openingTagFirstPart}>`;

		let content = "";

		if (this.innerHtml) {
			content = `
${this.innerHtml
	.split(/\r?\n/)
	.map((line) => `${"  ".repeat(indentationLevel + 1)}${line.trim()}`)
	.join(`
`)}
${indent}`;
		} else if (this.textContent) {
			content = this.textContent;
		} else if (this.children.length > 0) {
			content = `
${this.children
	.map((child) =>
		child instanceof HtmlElementBuilder
			? child.render(indentationLevel + 1)
			: `${"  ".repeat(indentationLevel + 1)}${child}`,
	)
	.join(`
`)}
${indent}`;
		}

		return `${openingTag}${content}</${this.tagName}>`;
	}
}
