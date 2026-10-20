/**
 * Intermediate representation (IR) types for analyzed service methods, parameters, request bodies, and responses.
 *
 * @module functions/types
 */

import type { OptionalKind, ParameterDeclarationStructure } from "ts-morph";
import type { OpenApiValue, ServerObject } from "../core/types/index.js";

/**
 * Serialization metadata for a single operation parameter (path, query, header, or cookie).
 */
export interface ParamSerialization {
	/** Sanitized TypeScript parameter identifier. */
	paramName: string;
	/** Original parameter name in the OpenAPI specification. */
	originalName: string;
	/** OpenAPI parameter serialization style (`simple`, `form`, `label`, `matrix`, `spaceDelimited`, `pipeDelimited`, `tabDelimited`, `deepObject`, `cookie`). */
	style?: string;
	/** Whether arrays and objects should generate separate parameter instances per value. */
	explode: boolean;
	/** Whether RFC 3986 reserved characters are allowed unencoded. */
	allowReserved: boolean;
	/** Whether empty values are allowed for query parameters. */
	allowEmptyValue?: boolean;
	/** Explicit media type for `content`-based parameter serialization. */
	contentType?: string;
	/** Property-level encoding map for complex parameter content. */
	encoding?: Record<string, OpenApiValue>;
	/** Content encoder configuration (`base64`, `base64url`, etc.). */
	contentEncoderConfig?: Record<string, OpenApiValue>;
	/** Special JSON serialization hint (`"json"` or `"json-subset"`). */
	serializationLink?: "json" | "json-subset" | undefined;
}

/**
 * Discriminated union representing how an operation's request body should be serialized.
 */
export type BodyVariant =
	| {
			/** Standard `application/json` request body. */
			type: "json";
			/** Parameter identifier holding the request body value. */
			paramName: string;
	  }
	| {
			/** Newline-delimited JSON (`application/jsonl`, `application/x-ndjson`) request body. */
			type: "json-lines";
			/** Parameter identifier holding the array of items. */
			paramName: string;
	  }
	| {
			/** RFC 7464 `application/json-seq` request body. */
			type: "json-seq";
			/** Parameter identifier holding the array of items. */
			paramName: string;
	  }
	| {
			/** XML request body (`application/xml`, `text/xml`). */
			type: "xml";
			/** Parameter identifier holding the XML payload object. */
			paramName: string;
			/** Root XML element name. */
			rootName: string;
			/** XML builder configuration derived from the schema. */
			config: Record<string, OpenApiValue>;
	  }
	| {
			/** Multipart request body (`multipart/form-data`, `multipart/mixed`, `multipart/byteranges`). */
			type: "multipart";
			/** Parameter identifier holding the multipart payload. */
			paramName: string;
			/** Multipart builder configuration. */
			config: Record<string, OpenApiValue>;
	  }
	| {
			/** URL-encoded form body (`application/x-www-form-urlencoded`). */
			type: "urlencoded";
			/** Parameter identifier holding the form payload. */
			paramName: string;
			/** Encoding configuration map per form property. */
			config: Record<string, OpenApiValue>;
	  }
	| {
			/** Raw binary or text request body. */
			type: "raw";
			/** Parameter identifier holding the raw payload. */
			paramName: string;
	  }
	| {
			/** Legacy Swagger 2.0 `in: "formData"` parameters combined into a form body. */
			type: "encoded-form-data";
			/** Parameter identifier or synthetic name. */
			paramName: string;
			/** Property mapping expressions. */
			mappings: string[];
	  };

/**
 * Response deserialization strategy for an operation.
 */
export type ResponseSerialization =
	| "json"
	| "text"
	| "blob"
	| "arraybuffer"
	| "sse"
	| "json-seq"
	| "json-lines"
	| "xml";

/**
 * Describes a single response media-type variant for content-negotiated operations.
 */
export interface ResponseVariant {
	/** Media type string (e.g., `"application/json"`, `"application/xml"`). */
	mediaType: string;
	/** Resolved TypeScript return type for this media type. */
	type: string;
	/** Response deserialization mode. */
	serialization: ResponseSerialization;
	/** Optional XML parser configuration when `serialization === "xml"`. */
	xmlConfig?: Record<string, OpenApiValue>;
	/** Optional content decoder configuration (`base64`, etc.). */
	decodingConfig?: Record<string, OpenApiValue>;
	/** Server-Sent Events parsing mode (`"event"` or `"data"`). */
	sseMode?: "event" | "data";
	/** Whether this variant is the primary/default response variant. */
	isDefault: boolean;
}

/**
 * Metadata for a documented error HTTP status code (`4xx`, `5xx`, or `default`) on an operation.
 */
export interface ErrorResponseInfo {
	/** HTTP status code or `"default"`. */
	code: string;
	/** Resolved TypeScript type for the error payload. */
	type: string;
	/** Human-readable error response description. */
	description?: string;
}

/**
 * Complete intermediate representation (IR) model of an analyzed service method.
 */
export interface ServiceMethodModel {
	/** Generated TypeScript method name. */
	methodName: string;
	/** Uppercase HTTP verb (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`, `TRACE`, `QUERY`). */
	httpMethod: string;
	/** OpenAPI path template (e.g., `"/users/{id}"`). */
	urlTemplate: string;

	/** Formatted JSDoc comment body for the method. */
	docs?: string;
	/** Whether the operation is marked `deprecated: true`. */
	isDeprecated: boolean;

	/** Ordered `ts-morph` parameter declarations for the generated method signature. */
	parameters: OptionalKind<ParameterDeclarationStructure>[];

	/** Primary TypeScript return type of the operation. */
	responseType: string;
	/** Primary response deserialization strategy. */
	responseSerialization: ResponseSerialization;
	/** XML parser configuration if the primary response is XML. */
	responseXmlConfig?: Record<string, OpenApiValue>;
	/** Content decoder configuration for the primary response. */
	responseDecodingConfig?: Record<string, OpenApiValue>;
	/** SSE mode if the primary response is `text/event-stream`. */
	sseMode?: "event" | "data";

	/** All supported response media-type variants for content negotiation. */
	responseVariants: ResponseVariant[];

	/** Optional content encoder configuration for the request payload. */
	requestEncodingConfig?: Record<string, OpenApiValue>;

	/** Documented error responses (`4xx`, `5xx`, `default`). */
	errorResponses: ErrorResponseInfo[];

	/** Path parameter serialization rules. */
	pathParams: ParamSerialization[];
	/** Query parameter serialization rules. */
	queryParams: ParamSerialization[];
	/** Header parameter serialization rules. */
	headerParams: ParamSerialization[];
	/** Cookie parameter serialization rules. */
	cookieParams: ParamSerialization[];

	/** Request body serialization variant, if the operation accepts a body. */
	body?: BodyVariant;
	/** Primary `Content-Type` header value for the request body. */
	requestContentType?: string;

	/** Effective OpenAPI security requirement objects for this operation. */
	security: Record<string, string[]>[];
	/** Vendor extensions (`x-*`) attached to the operation. */
	extensions: Record<string, OpenApiValue>;
	/** Whether operation-level or path-level `servers` overrides exist. */
	hasServers: boolean;
	/** Static base path override when operation servers have no variables. */
	basePath?: string;
	/** Operation-level `ServerObject` definitions. */
	operationServers?: ServerObject[];
}
