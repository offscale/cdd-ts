/**
 * Loads, caches, and resolves Arazzo 1.1.0 documents and their linked `sourceDescriptions`
 * (OpenAPI 2.0/3.x, nested Arazzo, and AsyncAPI documents).
 *
 * @module arazzo/parse_loader
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import yaml from "js-yaml";

import {
	type ArazzoSpec,
	type GeneratorConfig,
	isArazzoSpec,
	type OpenApiValue,
	type SwaggerSpec,
} from "../core/types/index.js";
import { isUrl } from "../functions/utils.js";
import { SwaggerParser } from "../openapi/parse.js";
import { validateArazzoSpec } from "./parse_validator.js";

/**
 * Normalized AsyncAPI channel entry extracted from a `type: "asyncapi"` source description.
 */
export interface AsyncApiChannelRecord {
	/** Channel address or key path (e.g. `"/user/signedup"`). */
	channelPath: string;
	/** Optional summary or description of the channel. */
	description?: string | undefined;
	/** Raw AsyncAPI channel object. */
	raw: Record<string, OpenApiValue>;
}

/**
 * Bundle returned when loading an Arazzo document and its linked source descriptions.
 */
export interface LoadedArazzoBundle {
	/** Validated root `ArazzoSpec`. */
	entrySpec: ArazzoSpec;
	/** Canonical base URI of the entry Arazzo document. */
	documentUri: string;
	/** Map of `sourceDescription.name` to resolved `SwaggerParser` instances. */
	openApiSources: Map<string, SwaggerParser>;
	/** Map of `sourceDescription.name` to resolved nested `ArazzoSpec` documents. */
	arazzoSources: Map<string, ArazzoSpec>;
	/** Map of `sourceDescription.name` to extracted AsyncAPI channel registries. */
	asyncApiSources: Map<string, Map<string, AsyncApiChannelRecord>>;
	/** Map of `sourceDescription.name` to resolved canonical URL string. */
	resolvedSourceUrls: Map<string, string>;
}

/**
 * Multi-specification loader for Arazzo 1.1.0 documents and their linked `sourceDescriptions`.
 */
export class ArazzoLoader {
	/**
	 * Parses a raw JSON or YAML string into an untyped specification value.
	 *
	 * @param content - Raw JSON or YAML string.
	 * @param uri - Diagnostic URI or file path.
	 * @returns Parsed value.
	 * @throws {Error} When neither JSON nor YAML parsing succeeds into a non-null object.
	 */
	public static parseSpecContent(content: string, uri: string): unknown {
		const trimmed = content.trim();
		const parsed: unknown = trimmed.startsWith("{")
			? JSON.parse(trimmed)
			: yaml.load(content);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error(`Invalid specification document at ${uri}`);
		}
		return parsed;
	}

	/**
	 * Resolves a local path or URL against a base document URI.
	 *
	 * @param targetUrl - Relative or absolute path/URL.
	 * @param baseUri - Canonical base URI (e.g. `file:///.../arazzo.yaml` or `https://...`).
	 * @returns Resolved canonical URI string.
	 */
	public static resolveUri(targetUrl: string, baseUri: string): string {
		if (isUrl(targetUrl) || targetUrl.startsWith("file://")) {
			return targetUrl;
		}
		try {
			return new URL(targetUrl, baseUri).href;
		} catch {
			return pathToFileURL(path.resolve(process.cwd(), targetUrl)).href;
		}
	}

	/**
	 * Reads raw text content synchronously from a `file://` URI or local path.
	 *
	 * @param uriOrPath - File URI or local filesystem path.
	 * @returns Raw UTF-8 file content.
	 */
	public static readContentSync(uriOrPath: string): string {
		const filePath = uriOrPath.startsWith("file://")
			? fileURLToPath(uriOrPath)
			: uriOrPath;
		return fs.readFileSync(filePath, "utf-8");
	}

	/**
	 * Extracts AsyncAPI channels from a raw AsyncAPI 2.x / 3.x document object.
	 *
	 * @param doc - Parsed AsyncAPI document object.
	 * @returns Map of channel path/key to `AsyncApiChannelRecord`.
	 */
	public static extractAsyncApiChannels(
		doc: Record<string, OpenApiValue>,
	): Map<string, AsyncApiChannelRecord> {
		const map = new Map<string, AsyncApiChannelRecord>();
		const channels = doc.channels;
		if (channels && typeof channels === "object" && !Array.isArray(channels)) {
			for (const [key, val] of Object.entries(
				channels as Record<string, OpenApiValue>,
			)) {
				if (val && typeof val === "object" && !Array.isArray(val)) {
					const rec = val as Record<string, OpenApiValue>;
					const address = typeof rec.address === "string" ? rec.address : key;
					const entry: AsyncApiChannelRecord = {
						channelPath: key,
						description:
							typeof rec.description === "string" ? rec.description : undefined,
						raw: rec,
					};
					map.set(key, entry);
					if (address !== key) {
						map.set(address, entry);
					}
				}
			}
		}
		return map;
	}

	/**
	 * Synchronously loads an Arazzo 1.1.0 specification and resolves all `sourceDescriptions` that exist on disk.
	 *
	 * @param inputPathOrSpec - File path to an Arazzo document or an in-memory `ArazzoSpec`.
	 * @param config - Generator configuration options.
	 * @param preloadedSpecs - Optional map of sourceDescription `name` or `url` to in-memory `SwaggerSpec | ArazzoSpec | Record<string, OpenApiValue>`.
	 * @param visitedUris - Internal cycle-detection set of canonical URIs.
	 * @returns Loaded and validated `LoadedArazzoBundle`.
	 */
	public static loadSync(
		inputPathOrSpec: string | ArazzoSpec,
		config: GeneratorConfig,
		preloadedSpecs?: Record<
			string,
			SwaggerSpec | ArazzoSpec | Record<string, OpenApiValue>
		>,
		visitedUris: Set<string> = new Set<string>(),
	): LoadedArazzoBundle {
		let entrySpec: ArazzoSpec;
		let documentUri: string;
		const defaultBase = pathToFileURL(
			path.resolve(process.cwd(), "arazzo.json"),
		).href;

		if (typeof inputPathOrSpec === "string") {
			documentUri = ArazzoLoader.resolveUri(inputPathOrSpec, defaultBase);
			const rawContent = ArazzoLoader.readContentSync(documentUri);
			const parsed = ArazzoLoader.parseSpecContent(rawContent, documentUri);
			validateArazzoSpec(parsed);
			entrySpec = parsed;
		} else {
			validateArazzoSpec(inputPathOrSpec);
			entrySpec = inputPathOrSpec;
			documentUri = defaultBase;
		}

		const baseUri = entrySpec.$self
			? ArazzoLoader.resolveUri(entrySpec.$self, documentUri)
			: documentUri;

		visitedUris.add(documentUri);
		visitedUris.add(baseUri);

		const openApiSources = new Map<string, SwaggerParser>();
		const arazzoSources = new Map<string, ArazzoSpec>();
		const asyncApiSources = new Map<
			string,
			Map<string, AsyncApiChannelRecord>
		>();
		const resolvedSourceUrls = new Map<string, string>();

		for (const src of entrySpec.sourceDescriptions) {
			const resolvedUrl = ArazzoLoader.resolveUri(src.url, baseUri);
			resolvedSourceUrls.set(src.name, resolvedUrl);

			const preloaded =
				preloadedSpecs?.[src.name] ??
				preloadedSpecs?.[src.url] ??
				preloadedSpecs?.[resolvedUrl];

			let rawDoc: unknown = preloaded;
			if (!rawDoc && resolvedUrl.startsWith("file://")) {
				const fsPath = fileURLToPath(resolvedUrl);
				if (fs.existsSync(fsPath)) {
					const text = fs.readFileSync(fsPath, "utf-8");
					rawDoc = ArazzoLoader.parseSpecContent(text, resolvedUrl);
				}
			}

			if (!rawDoc || typeof rawDoc !== "object" || Array.isArray(rawDoc)) {
				continue;
			}

			const docObj = rawDoc as Record<string, OpenApiValue>;
			const effectiveType =
				src.type ??
				(isArazzoSpec(docObj)
					? "arazzo"
					: typeof docObj.asyncapi === "string"
						? "asyncapi"
						: "openapi");

			if (effectiveType === "arazzo") {
				if (visitedUris.has(resolvedUrl)) {
					throw new Error(
						`Cyclic Arazzo sourceDescription reference detected at ${resolvedUrl}`,
					);
				}
				validateArazzoSpec(docObj);
				arazzoSources.set(src.name, docObj);
			} else if (effectiveType === "asyncapi") {
				asyncApiSources.set(
					src.name,
					ArazzoLoader.extractAsyncApiChannels(docObj),
				);
			} else {
				const parser = new SwaggerParser(
					docObj as unknown as SwaggerSpec,
					config,
					undefined,
					resolvedUrl,
				);
				openApiSources.set(src.name, parser);
			}
		}

		return {
			entrySpec,
			documentUri: baseUri,
			openApiSources,
			arazzoSources,
			asyncApiSources,
			resolvedSourceUrls,
		};
	}
}
