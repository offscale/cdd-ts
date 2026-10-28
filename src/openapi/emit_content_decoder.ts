/**
 * Generates `utils/content-decoder.ts` for decoding OAS 3.1 `contentSchema` and `contentEncoding` strings.
 *
 * @module openapi/emit_content_decoder
 */
import * as path from "node:path";
import { type Project, Scope } from "ts-morph";

/**
 * Generates the `utils/content-decoder.ts` utility file.
 */
export class ContentDecoderGenerator {
	/**
	 * Creates a new `ContentDecoderGenerator`.
	 *
	 * @param project - The `ts-morph` project to create `utils/content-decoder.ts` in.
	 */
	constructor(private project: Project) {}

	/**
	 * Generates `utils/content-decoder.ts` in the specified output directory.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		const utilsDir = path.join(outputDir, "utils");

		const filePath = path.join(utilsDir, "content-decoder.ts");

		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		// Add XmlParser import for XML decoding support

		sourceFile.addImportDeclaration({
			moduleSpecifier: "./xml-parser",
			namedImports: ["XmlParser"],
		});

		sourceFile.addImportDeclaration({
			moduleSpecifier: "./xml-builder",
			namedImports: ["XmlPropertyConfig"],
			isTypeOnly: true,
		});

		sourceFile.addInterface({
			name: "ContentDecoderConfig",
			isExported: true,
			properties: [
				{
					name: "decode",
					type: "'json' | 'xml' | boolean",
					hasQuestionToken: true,
					docs: [
						"If set, parse the string value. 'xml' uses XmlParser, 'json' or true uses JSON.parse.",
					],
				},
				{
					name: "contentEncoding",
					type: "'base64' | 'base64url' | string",
					hasQuestionToken: true,
					docs: [
						"If set, decodes base64/base64url strings to Uint8Array or string for parsing.",
					],
				},
				{
					name: "xmlConfig",
					type: "XmlPropertyConfig",
					hasQuestionToken: true,
					docs: ["Configuration for XmlParser when decode is 'xml'."],
				},
				{
					name: "properties",
					type: "Record<string, ContentDecoderConfig>",
					hasQuestionToken: true,
				},
				{ name: "items", type: "ContentDecoderConfig", hasQuestionToken: true },
			],
		});

		const classDeclaration = sourceFile.addClass({
			name: "ContentDecoder",
			isExported: true,
			docs: [
				"Utility to auto-decode encoded content strings (e.g. JSON or XML embedded in string) based on OAS 3.1 contentSchema.",
			],
		});

		classDeclaration.addMethod({
			name: "base64ToBytes",
			isStatic: true,
			scope: Scope.Private,
			parameters: [
				{ name: "input", type: "string" },
				{ name: "urlSafe", type: "boolean", hasQuestionToken: true },
			],
			returnType: "Uint8Array",
			statements: `
        let normalized = input;
        if (urlSafe) {
            normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');
            const pad = normalized.length % 4;
            if (pad === 2) normalized += '==';
            else if (pad === 3) normalized += '=';
        }

        const globalBuffer = (globalThis as { Buffer?: { from: (data: string, encoding: string) => Uint8Array } }).Buffer;
        if (typeof globalBuffer !== 'undefined') {
            return Uint8Array.from(globalBuffer.from(normalized, 'base64'));
        }
        const binary = atob(normalized);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;`,
		});

		classDeclaration.addMethod({
			name: "bytesToString",
			isStatic: true,
			scope: Scope.Private,
			parameters: [{ name: "bytes", type: "Uint8Array" }],
			returnType: "string",
			statements: `
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(bytes);
        }
        const globalBuffer = (globalThis as { Buffer?: { from: (data: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
        if (typeof globalBuffer !== 'undefined') {
            return globalBuffer.from(bytes).toString('utf-8');
        }
        let result = '';
        for (let i = 0; i < bytes.length; i++) {
            result += String.fromCharCode(bytes[i]);
        }
        return result;`,
		});

		classDeclaration.addMethod({
			name: "decode",
			isStatic: true,
			scope: Scope.Public,
			parameters: [
				{
					name: "data",
					type: "unknown",
				},
				{
					name: "config",
					type: "ContentDecoderConfig",
					hasQuestionToken: true,
				},
			],
			returnType: "unknown",
			statements: `
        if (data === null || data === undefined || !config) {
            return data;
        }

        let current: unknown = data;
        if (config.contentEncoding && typeof current === 'string') {
            const urlSafe = String(config.contentEncoding).toLowerCase() === 'base64url';
            const bytes = this.base64ToBytes(current, urlSafe);
            if (config.decode) {
                current = this.bytesToString(bytes);
            } else {
                return bytes;
            }
        }

        // 1. Auto-decode string
        if (config.decode && typeof current === 'string') {
            try {
                if (config.decode === 'xml') {
                    // Use XmlParser for XML content
                    return XmlParser.parse(current, config.xmlConfig || {});
                }

                // Default to JSON parsing
                const parsed: unknown = JSON.parse(current);
                if (config.properties || config.items) {
                    return this.decode(parsed, { ...config, decode: false });
                }
                return parsed;
            } catch (e) {
                console.warn('Failed to decode contentSchema string', e);
                return current;
            }
        }

        // 2. Arrays
        if (Array.isArray(current) && config.items) {
            return current.map(item => this.decode(item, config.items));
        }

        // 3. Objects
        if (typeof current === 'object' && current !== null) {
            if (config.properties) {
                const record = current as Record<string, unknown>;
                const result: Record<string, unknown> = { ...record };
                Object.keys(config.properties).forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(record, key)) {
                        result[key] = this.decode(record[key], config.properties![key]);
                    }
                });
                return result;
            }
        }

        return current;`,
		});

		sourceFile.formatText();
	}
}
