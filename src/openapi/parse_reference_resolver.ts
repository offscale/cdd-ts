/**
 * Resolves OpenAPI `$ref` and `$dynamicRef` references across local and external specifications.
 *
 * @module openapi/parse_reference_resolver
 */
import type {
	OpenApiValue,
	SwaggerDefinition,
	SwaggerSpec,
} from "../core/types/index.js";

/**
 * Internal representation of a standard JSON Reference object.
 */
interface RefObject {
	/** The target reference URI or JSON Pointer. */
	$ref: string;
	/** Optional summary override. */
	summary?: string;
	/** Optional description override. */
	description?: string;
}

/**
 * Internal representation of an OAS 3.1 `$dynamicRef` object.
 */
interface DynamicRefObject {
	/** The target dynamic reference URI or anchor. */
	$dynamicRef: string;
	/** Optional summary override. */
	summary?: string;
	/** Optional description override. */
	description?: string;
}

/**
 * Type guard checking whether a value is a `RefObject`.
 *
 * @param obj - Value to inspect.
 * @returns `true` if `obj` contains a string `$ref` property.
 */
const isRefObject = (obj: unknown): obj is RefObject =>
	typeof obj === "object" &&
	obj !== null &&
	"$ref" in obj &&
	typeof (obj as { $ref: unknown }).$ref === "string";

/**
 * Type guard checking whether a value is a `DynamicRefObject`.
 *
 * @param obj - Value to inspect.
 * @returns `true` if `obj` contains a string `$dynamicRef` property.
 */
const isDynamicRefObject = (obj: unknown): obj is DynamicRefObject =>
	typeof obj === "object" &&
	obj !== null &&
	"$dynamicRef" in obj &&
	typeof (
		obj as {
			$dynamicRef: unknown;
		}
	).$dynamicRef === "string";

/**
 * Narrow an `OpenApiValue` to the caller's target schema/component type `T`.
 *
 * @template T - Target resolved OpenAPI component type.
 * @param value - The resolved OpenAPI value.
 * @returns The typed value `T` or `undefined`.
 */
function narrowResolvedValue<T>(value: OpenApiValue): T | undefined {
	return value as T;
}

/**
 * Safely URL-decodes a JSON Pointer fragment.
 *
 * @param value - Raw fragment string.
 * @returns Decoded fragment string, or original string if malformed.
 */
const safeDecodeFragment = (value: string): string => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

/**
 * Removes any `#fragment` suffix from a URI string.
 *
 * @param value - Full URI string.
 * @returns Base URI without fragment.
 */
const stripFragment = (value: string): string =>
	value.split("#", 1)[0] ?? value;

/**
 * Resolves OpenAPI references ($ref and $dynamicRef) including context-aware resolution for OAS 3.1.
 */
export class ReferenceResolver {
	private static baseUriMap = new WeakMap<object, string>();

	private static documentUriMap = new WeakMap<object, string>();

	/**
	 * Creates a new `ReferenceResolver`.
	 *
	 * @param specCache - Map of document/anchor URIs to loaded `SwaggerSpec` objects.
	 * @param entryDocumentUri - The root entry document URI.
	 */
	constructor(
		private specCache: Map<string, SwaggerSpec>,

		private entryDocumentUri: string,
	) {}

	/**
	 * Retrieves the resolved base URI associated with a schema object via `$id`.
	 *
	 * @param obj - Schema or specification object.
	 * @returns The associated base URI, if indexed.
	 */
	public static getBaseUri(obj: object): string | undefined {
		return ReferenceResolver.baseUriMap.get(obj);
	}

	/**
	 * Retrieves the physical document URI from which a schema object originated.
	 *
	 * @param obj - Schema or specification object.
	 * @returns The document URI, if indexed.
	 */
	public static getDocumentUri(obj: object): string | undefined {
		return ReferenceResolver.documentUriMap.get(obj);
	}

	/**
	 * Recursively indexes `$id`, `$anchor`, and `$dynamicAnchor` declarations across a specification.
	 *
	 * @param spec - Specification or schema value to index.
	 * @param baseUri - Current base URI for relative `$id` resolution.
	 * @param cache - Spec cache to populate with discovered `$id` and anchor URIs.
	 * @param documentUri - Physical document URI owning `spec`.
	 */
	public static indexSchemaIds(
		spec: OpenApiValue,
		baseUri: string,
		cache: Map<string, SwaggerSpec>,
		documentUri: string = baseUri,
	): void {
		if (!spec || typeof spec !== "object") return;

		const traverse = (
			obj: OpenApiValue,
			currentBase: string,
			visited: Set<OpenApiValue>,
		) => {
			if (!obj || typeof obj !== "object" || visited.has(obj)) return;

			visited.add(obj);

			let nextBase = currentBase;

			const objRec = obj as Record<string, OpenApiValue>;

			if ("$id" in objRec && typeof objRec.$id === "string") {
				try {
					nextBase =
						typeof URL !== "undefined"
							? new URL(objRec.$id, currentBase).href
							: objRec.$id;

					if (!cache.has(nextBase)) {
						cache.set(nextBase, obj as SwaggerSpec);
					}
				} catch (_e) {
					// Ignore invalid $id
				}
			}

			ReferenceResolver.baseUriMap.set(obj, nextBase);

			ReferenceResolver.documentUriMap.set(obj, documentUri);

			if ("$anchor" in objRec && typeof objRec.$anchor === "string") {
				const anchorUri = `${nextBase}#${objRec.$anchor}`;

				if (!cache.has(anchorUri)) {
					cache.set(anchorUri, obj as SwaggerSpec);
				}
			}

			if (
				"$dynamicAnchor" in objRec &&
				typeof objRec.$dynamicAnchor === "string"
			) {
				const anchorUri = `${nextBase}#${objRec.$dynamicAnchor}`;

				if (!cache.has(anchorUri)) {
					cache.set(anchorUri, obj as SwaggerSpec);
				}
			}

			for (const key in objRec) {
				if (Object.hasOwn(objRec, key)) {
					traverse(objRec[key], nextBase, visited);
				}
			}
		};

		traverse(spec, baseUri, new Set());
	}

	/**
	 * Collects all `$ref` and `$dynamicRef` URI strings within an OpenAPI value tree.
	 *
	 * @param obj - Root OpenAPI value to scan.
	 * @returns Deduplicated array of reference strings.
	 */
	public static findRefs(obj: OpenApiValue): string[] {
		const refs = new Set<string>();

		function traverse(current: OpenApiValue) {
			if (!current || typeof current !== "object") return;

			if (isRefObject(current)) refs.add(current.$ref);

			if (isDynamicRefObject(current)) refs.add(current.$dynamicRef);

			for (const key in current as object) {
				if (Object.hasOwn(current, key)) {
					traverse((current as Record<string, OpenApiValue>)[key]);
				}
			}
		}

		traverse(obj);

		return Array.from(refs);
	}

	/**
	 * Resolves an object that may be a direct definition, a `$ref`, or a `$dynamicRef`.
	 *
	 * @template T - Expected resolved object type.
	 * @param obj - Object or reference to resolve.
	 * @param resolutionStack - Stack of previously visited reference URIs for cycle detection and dynamic scope.
	 * @returns The resolved target object of type `T`, or `undefined`.
	 */
	public resolve<T>(
		obj:
			| T
			| { $ref: string }
			| {
					$dynamicRef: string;
			  }
			| null
			| undefined,
		resolutionStack: string[] = [],
	): T | undefined {
		if (obj === null || obj === undefined) return undefined;

		let resolved: T | undefined;

		let refObj: RefObject | DynamicRefObject | null = null;

		if (isRefObject(obj)) {
			const baseUri =
				ReferenceResolver.getBaseUri(obj as object) ?? this.entryDocumentUri;

			resolved = this.resolveReference<T>(obj.$ref, baseUri, resolutionStack);

			refObj = obj;
		} else if (isDynamicRefObject(obj)) {
			const baseUri =
				ReferenceResolver.getBaseUri(obj as object) ?? this.entryDocumentUri;

			resolved = this.resolveReference<T>(
				obj.$dynamicRef,
				baseUri,
				resolutionStack,
			);

			refObj = obj;
		} else {
			return obj as T;
		}

		if (resolved && typeof resolved === "object" && refObj) {
			const { summary, description } = refObj;

			if (summary !== undefined || description !== undefined) {
				resolved = { ...resolved };

				if (summary !== undefined)
					(resolved as Record<string, OpenApiValue>).summary = summary;

				if (description !== undefined)
					(resolved as Record<string, OpenApiValue>).description = description;
			}
		}

		return resolved;
	}

	/**
	 * Resolves a reference string (`$ref` or `$dynamicRef`) against the specification cache.
	 *
	 * @template T - Expected resolved target type.
	 * @param ref - Reference string (URI, relative path, JSON Pointer, or anchor).
	 * @param currentDocUri - Base document URI from which the reference is resolved.
	 * @param resolutionStack - Stack of active scope URIs for dynamic anchor resolution.
	 * @returns The resolved target of type `T`, or `undefined` if unresolvable.
	 */
	public resolveReference<T = SwaggerDefinition>(
		ref: string,
		currentDocUri: string = this.entryDocumentUri,
		resolutionStack: string[] = [],
	): T | undefined {
		if (typeof ref !== "string") {
			return undefined;
		}

		const [filePath, jsonPointer] = ref.split("#", 2);

		const fragment =
			jsonPointer !== undefined ? safeDecodeFragment(jsonPointer) : undefined;

		const currentDocSpec = this.specCache.get(currentDocUri);

		let logicalBaseUri = currentDocUri;
		if (currentDocSpec?.$self) {
			if (typeof URL !== "undefined") {
				try {
					logicalBaseUri = new URL(currentDocSpec.$self, currentDocUri).href;
				} catch {
					logicalBaseUri = currentDocSpec.$self;
				}
			} else {
				logicalBaseUri = currentDocSpec.$self;
			}
		}

		let targetUri = logicalBaseUri;
		if (filePath) {
			if (typeof URL !== "undefined") {
				try {
					targetUri = new URL(filePath, logicalBaseUri).href;
				} catch {
					targetUri = filePath;
				}
			} else {
				targetUri = filePath;
			}
		}

		if (fragment && !fragment.startsWith("/")) {
			for (const scopeUri of resolutionStack) {
				const scopeBase = stripFragment(scopeUri);

				const dynamicKey = `${scopeBase}#${fragment}`;

				if (this.specCache.has(dynamicKey)) {
					return narrowResolvedValue<T>(this.specCache.get(dynamicKey));
				}
			}
		}

		const fullUriKey = fragment ? `${targetUri}#${fragment}` : targetUri;

		if (this.specCache.has(fullUriKey)) {
			return narrowResolvedValue<T>(this.specCache.get(fullUriKey));
		}

		const targetSpec = this.specCache.get(targetUri);

		if (!targetSpec) {
			if (filePath) {
				console.warn(
					`[Parser] Unresolved external file reference: ${targetUri}. File was not pre-loaded.`,
				);
			}

			return undefined;
		}

		let result: OpenApiValue = targetSpec;

		if (fragment) {
			if (fragment.startsWith("/")) {
				const pointerParts = fragment.split("/").filter((p) => p !== "");

				for (const part of pointerParts) {
					const decodedPart = part.replace(/~1/g, "/").replace(/~0/g, "~");

					if (
						typeof result === "object" &&
						result !== null &&
						Object.hasOwn(result, decodedPart)
					) {
						result = (result as Record<string, OpenApiValue>)[decodedPart];
					} else {
						console.warn(
							`[Parser] Failed to resolve reference part "${decodedPart}" in path "${ref}" within file ${targetUri}`,
						);

						return undefined;
					}
				}
			} else {
				console.warn(
					`[Parser] Failed to resolve anchor "${fragment}" in path "${ref}" within file ${targetUri}`,
				);

				return undefined;
			}
		}

		if (typeof result === "object" && result !== null) {
			const newStack = [...resolutionStack, fullUriKey];

			if (isRefObject(result)) {
				const nestedBase = ReferenceResolver.getBaseUri(result) ?? targetUri;

				return this.resolveReference(result.$ref, nestedBase, newStack);
			}

			if (isDynamicRefObject(result)) {
				const nestedBase = ReferenceResolver.getBaseUri(result) ?? targetUri;

				return this.resolveReference(result.$dynamicRef, nestedBase, newStack);
			}
		}

		return narrowResolvedValue<T>(result);
	}
}
