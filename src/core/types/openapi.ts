/**
 * OpenAPI / Swagger Specification domain types and JSON value primitives.
 *
 * @module core/types/openapi
 */

/**
 * Primitive JSON value allowed in OpenAPI specifications.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Object dictionary of OpenAPI values.
 */
export interface OpenApiObject {
	/** OpenAPI property value. */
	[key: string]: OpenApiValue | undefined;
}

/**
 * Array of OpenAPI values.
 */
export type OpenApiArray = OpenApiValue[];

/**
 * Recursive union of all valid OpenAPI / JSON values.
 */
export type OpenApiValue =
	| JsonPrimitive
	| OpenApiObject
	| OpenApiArray
	| object
	| undefined;

// ===================================================================================
// OpenAPI / Swagger Specification Types
// ===================================================================================

/**
 * License information for the exposed API.
 */
export interface LicenseObject {
	/** The license name used for the API. */
	name: string;
	/** A URL to the license used for the API. */
	url?: string;
	/** An SPDX license expression for the API (OAS 3.1+). */
	identifier?: string;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Contact information for the exposed API.
 */
export interface ContactObject {
	/** The identifying name of the contact person/organization. */
	name?: string;
	/** The URL pointing to the contact information. */
	url?: string;
	/** The email address of the contact person/organization. */
	email?: string;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Metadata about the API.
 */
export interface InfoObject {
	/** The title of the API. */
	title: string;
	/** A short summary of the API (OAS 3.1+). */
	summary?: string;
	/** A description of the API. */
	description?: string;
	/** A URL to the Terms of Service for the API. */
	termsOfService?: string;
	/** The contact information for the exposed API. */
	contact?: ContactObject;
	/** The license information for the exposed API. */
	license?: LicenseObject;
	/** The version of the OpenAPI document. */
	version: string;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Allows referencing an external resource for extended documentation.
 */
export interface ExternalDocumentationObject {
	/** A description of the target documentation. */
	description?: string;
	/** The URL for the target documentation. */
	url: string;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * A simple object to allow referencing other components in the OpenAPI document.
 */
export interface ReferenceObject {
	/** The reference identifier URI. */
	$ref: string;
	/** A short summary which by default SHOULD override that of the referenced component. */
	summary?: string;
	/** A description which by default SHOULD override that of the referenced component. */
	description?: string;

	[key: string]: OpenApiValue;
}

/**
 * A JSON Schema 2020-12 dynamic reference object.
 */
export interface DynamicReferenceObject {
	/** The dynamic reference URI. */
	$dynamicRef: string;
	/** A short summary override. */
	summary?: string;
	/** A description override. */
	description?: string;

	[key: string]: OpenApiValue;
}

/**
 * Union of standard and dynamic reference objects.
 */
export type ReferenceLike = ReferenceObject | DynamicReferenceObject;

/**
 * Adds metadata to a single tag that is used by the Operation Object.
 */
export interface TagObject {
	/** The name of the tag. */
	name: string;
	/** A short summary of the tag (OAS 3.2). */
	summary?: string;
	/** A description for the tag. */
	description?: string;
	/** Additional external documentation for this tag. */
	externalDocs?: ExternalDocumentationObject;
	/** The name of a parent tag for hierarchical grouping (OAS 3.2). */
	parent?: string;
	/** Classification kind of the tag (OAS 3.2). */
	kind?: string;

	[key: string]: OpenApiValue;
}

/**
 * An object representing a Server Variable for server URL template substitution.
 */
export interface ServerVariableObject {
	/** An enumeration of string values to be used if the substitution options are from a limited set. */
	enum?: string[];
	/** The default value to use for substitution. */
	default: string;
	/** An optional description for the server variable. */
	description?: string;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * An object representing a Server.
 */
export interface ServerObject {
	/** A URL to the target host. */
	url: string;
	/** An optional string describing the host designated by the URL. */
	description?: string;
	/** An optional unique name for the server (OAS 3.2). */
	name?: string;
	/** A map between a variable name and its value. */
	variables?: Record<string, ServerVariableObject>;

	[key: string]: OpenApiValue;
}

/**
 * When request bodies or response payloads may be one of a number of different schemas,
 * a discriminator object can be used to aid in serialization, deserialization, and validation.
 */
export interface DiscriminatorObject {
	/** The name of the property in the payload that will hold the discriminator value. */
	propertyName: string;
	/** An object to hold mappings between payload values and schema names or references. */
	mapping?: Record<string, string>;
	/** The default schema reference when the discriminator value does not match any mapping (OAS 3.2). */
	defaultMapping?: string;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * A metadata object that allows for more fine-tuned XML model definitions.
 */
export interface XmlObject {
	/** Replaces the name of the element/attribute used for the described schema property. */
	name?: string;
	/** The URI of the namespace definition. */
	namespace?: string;
	/** The prefix to be used for the name. */
	prefix?: string;
	/** Declares whether the property definition translates to an attribute instead of an element. */
	attribute?: boolean;
	/** Signifies whether the array is wrapped. */
	wrapped?: boolean;
	/** OAS 3.2 XML node type classification. */
	nodeType?: "element" | "attribute" | "text" | "cdata" | "none" | string;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * The Link object represents a possible design-time link for a response.
 */
export interface LinkObject {
	/** A relative or absolute URI reference to an OAS operation. */
	operationRef?: string;
	/** The name of an existing, resolvable OAS operation, as defined with a unique operationId. */
	operationId?: string;
	/** A map representing parameters to pass to an operation as specified with operationId or identified via operationRef. */
	parameters?: Record<string, OpenApiValue | string>;
	/** A literal value or {expression} to use as a request body when calling the target operation. */
	requestBody?: OpenApiValue;
	/** A description of the link. */
	description?: string;
	/** A server object to be used by the target operation. */
	server?: ServerObject;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Reusable Example Object.
 */
export interface ExampleObject {
	/** Short description for the example. */
	summary?: string;
	/** Long description for the example. */
	description?: string;
	/**
	 * Embedded literal example. The `value` field and `externalValue` field are mutually exclusive.
	 * @deprecated for non-JSON serialization targets in OAS 3.2. Use `dataValue` and/or `serializedValue` instead.
	 */
	value?: OpenApiValue;
	/**
	 * A URI that identifies the literal example.
	 */
	externalValue?: string;
	/**
	 * An example of the data structure that MUST be valid according to the relevant Schema Object.
	 * If this field is present, `value` MUST be absent.
	 * (OAS 3.2)
	 */
	dataValue?: OpenApiValue;
	/**
	 * An example of the serialized form of the value.
	 * If `dataValue` is present, then this field SHOULD contain the serialization of the given data.
	 * (OAS 3.2)
	 */
	serializedValue?: string;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Header Object following the structure of the Parameter Object.
 */
export interface HeaderObject {
	/** A brief description of the header. */
	description?: string;
	/** Determines whether this header is mandatory. */
	required?: boolean;
	/** Specifies that a header is deprecated and SHOULD be transitioned out of usage. */
	deprecated?: boolean;
	/** The schema defining the type used for the header. */
	schema?: SwaggerDefinition | boolean;
	/** Swagger 2.0 primitive type. */
	type?: "string" | "number" | "integer" | "boolean" | "array" | string;
	/** Swagger 2.0 format modifier. */
	format?: string;
	/** Swagger 2.0 items definition for array headers. */
	items?: SwaggerDefinition | boolean;
	/** Describes how the header value will be serialized. */
	style?: string;
	/** When this is true, header values of type array or object generate separate parameters. */
	explode?: boolean;
	/** Determines whether the header value SHOULD allow reserved characters. */
	allowReserved?: boolean;
	/** A map containing the representations for the header. */
	content?: Record<string, MediaTypeObject>;
	/** Example of the header's potential value. */
	example?: OpenApiValue;
	/** Examples of the header's potential value. */
	examples?: Record<string, ExampleObject | ReferenceLike>;

	[key: string]: OpenApiValue;
}

/**
 * Describes a single operation parameter.
 */
export interface Parameter {
	/** The name of the parameter. */
	name: string;
	/** The location of the parameter. */
	in:
		| "query"
		| "path"
		| "header"
		| "cookie"
		| "formData"
		| "querystring"
		| string;
	/** Determines whether this parameter is mandatory. */
	required?: boolean;
	/** The schema defining the type used for the parameter. */
	schema?: SwaggerDefinition | boolean | undefined;
	/** Swagger 2.0 parameter type. */
	type?:
		| "string"
		| "number"
		| "integer"
		| "boolean"
		| "array"
		| "file"
		| string;
	/** Swagger 2.0 parameter format. */
	format?: string;
	/** A brief description of the parameter. */
	description?: string;
	/** Describes how the parameter value will be serialized. */
	style?: string;
	/** When this is true, parameter values of type array or object generate separate parameters. */
	explode?: boolean;
	/** Determines whether the parameter value SHOULD allow reserved characters. */
	allowReserved?: boolean;
	/** Sets the ability to pass empty-valued parameters. */
	allowEmptyValue?: boolean;
	/** A map containing the representations for the parameter. */
	content?: Record<string, MediaTypeObject>;
	/** Specifies that a parameter is deprecated. */
	deprecated?: boolean;
	/** Example of the parameter's potential value. */
	example?: OpenApiValue;
	/** Examples of the parameter's potential value. */
	examples?: Record<string, ExampleObject | ReferenceLike>;

	[key: string]: OpenApiValue;
}

/**
 * A single encoding definition applied to a single schema property.
 */
export interface EncodingProperty {
	/** The Content-Type for encoding a specific property. */
	contentType?: string;
	/** A map allowing additional information to be provided as headers. */
	headers?: Record<string, OpenApiValue>;
	/** Describes how a specific property value will be serialized. */
	style?: string;
	/** When this is true, property values of type array or object generate separate parameters. */
	explode?: boolean;
	/** Determines whether the parameter value SHOULD allow reserved characters. */
	allowReserved?: boolean;
	/** Nested encoding map for multipart/form-urlencoded sub-properties (OAS 3.2). */
	encoding?: Record<string, EncodingProperty>;
	/** Positional encoding definitions for tuple arrays (OAS 3.2). */
	prefixEncoding?: EncodingProperty[];
	/** Encoding definition for array items (OAS 3.2). */
	itemEncoding?: EncodingProperty;

	/** Specification extension property (`x-*`). */
	[key: `x-${string}`]: OpenApiValue;
}

/**
 * Describes a single request body.
 */
export interface RequestBody {
	/** A brief description of the request body. */
	description?: string;
	/** Determines if the request body is required in the request. */
	required?: boolean;
	/** The content of the request body. */
	content?: Record<string, MediaTypeObject>;

	[key: string]: OpenApiValue;
}

/**
 * Each Media Type Object provides schema and examples for the media type identified by its key.
 */
export interface MediaTypeObject {
	/** Optional reference URI (OAS 3.2). */
	$ref?: string;
	/** Optional dynamic reference URI (OAS 3.2). */
	$dynamicRef?: string;
	/** The schema defining the content of the request, response, or parameter. */
	schema?: SwaggerDefinition | boolean | undefined;
	/** The schema for individual items in a streaming media type (OAS 3.2). */
	itemSchema?: SwaggerDefinition | boolean | undefined;
	/** Example of the media type. */
	example?: OpenApiValue;
	/** Examples of the media type. */
	examples?: Record<string, ExampleObject | ReferenceLike>;
	/** A map between a property name and its encoding information. */
	encoding?: Record<string, EncodingProperty>;
	/** Positional encoding definitions for array payloads (OAS 3.2). */
	prefixEncoding?: EncodingProperty[];
	/** Encoding definition for array items (OAS 3.2). */
	itemEncoding?: EncodingProperty;

	[key: string]: OpenApiValue;
}

/**
 * Describes a single response from an API Operation.
 */
export interface SwaggerResponse {
	/** A description of the response. */
	description?: string;
	/** A short summary of the response (OAS 3.2). */
	summary?: string;
	/** A map containing descriptions of potential response payloads. */
	content?: Record<string, MediaTypeObject>;
	/** A map of operations links that can be followed from the response. */
	links?: Record<string, LinkObject | ReferenceLike>;
	/** Maps a header name to its definition. */
	headers?: Record<string, HeaderObject | ReferenceLike>;

	[key: string]: OpenApiValue;
}

/**
 * The Schema Object allows the definition of input and output data types.
 */
export interface SwaggerDefinition {
	/** Data type or union of data types (JSON Schema 2020-12). */
	type?:
		| "string"
		| "number"
		| "integer"
		| "boolean"
		| "object"
		| "array"
		| "file"
		| "null"
		| string
		| (
				| "string"
				| "number"
				| "integer"
				| "boolean"
				| "object"
				| "array"
				| "null"
				| string
		  )[];
	/** Fine-tuned data type format modifier. */
	format?: string;
	/** Description of the schema. */
	description?: string;
	/** Title of the schema. */
	title?: string;
	/** Default value for the schema. */
	default?: OpenApiValue;
	/** Specifies that the schema is deprecated. */
	deprecated?: boolean;
	/** Constant value constraint (JSON Schema). */
	const?: OpenApiValue;
	/** Inclusive upper numeric bound. */
	maximum?: number;
	/** Exclusive upper numeric bound (boolean in Draft 4, number in Draft 2020-12). */
	exclusiveMaximum?: boolean | number;
	/** Inclusive lower numeric bound. */
	minimum?: number;
	/** Exclusive lower numeric bound (boolean in Draft 4, number in Draft 2020-12). */
	exclusiveMinimum?: boolean | number;
	/** Maximum string length. */
	maxLength?: number;
	/** Minimum string length. */
	minLength?: number;
	/** Regular expression pattern for string validation. */
	pattern?: string;
	/** Maximum array length. */
	maxItems?: number;
	/** Minimum array length. */
	minItems?: number;
	/** Whether array items must be unique. */
	uniqueItems?: boolean;
	/** Numeric multiple constraint. */
	multipleOf?: number;
	/** Minimum number of object properties. */
	minProperties?: number;
	/** Maximum number of object properties. */
	maxProperties?: number;
	/** Allowed enumerated values. */
	enum?: OpenApiValue[];
	/** Schema for array items. */
	items?: SwaggerDefinition | boolean | (SwaggerDefinition | boolean)[];
	/** Tuple item schemas (JSON Schema 2020-12). */
	prefixItems?: (SwaggerDefinition | boolean)[];
	/** Schema that at least one array element must match. */
	contains?: SwaggerDefinition | boolean;
	/** Minimum number of matching `contains` elements. */
	minContains?: number;
	/** Maximum number of matching `contains` elements. */
	maxContains?: number;
	/** Conditional `if` schema. */
	if?: SwaggerDefinition | boolean;
	/** Conditional `then` schema. */
	then?: SwaggerDefinition | boolean;
	/** Conditional `else` schema. */
	else?: SwaggerDefinition | boolean;
	/** Negated schema. */
	not?: SwaggerDefinition | boolean;
	/** Content encoding (e.g. base64, base64url). */
	contentEncoding?: string;
	/** Content MIME media type encoded inside a string. */
	contentMediaType?: string;
	/** Schema of the decoded content string. */
	contentSchema?: SwaggerDefinition | boolean;
	/** Schema for unevaluated object properties. */
	unevaluatedProperties?: SwaggerDefinition | boolean;
	/** Schema for unevaluated array items. */
	unevaluatedItems?: SwaggerDefinition | boolean;
	/** JSON Schema dialect URI. */
	$schema?: string;
	/** Schema resource identifier URI. */
	$id?: string;
	/** Schema plain-name fragment anchor. */
	$anchor?: string;
	/** Reference URI to another schema. */
	$ref?: string;
	/** Dynamic reference URI. */
	$dynamicRef?: string;
	/** Dynamic anchor name. */
	$dynamicAnchor?: string;
	/** Must validate against all subschemas. */
	allOf?: (SwaggerDefinition | boolean)[];
	/** Must validate against exactly one subschema. */
	oneOf?: (SwaggerDefinition | boolean)[];
	/** Must validate against one or more subschemas. */
	anyOf?: (SwaggerDefinition | boolean)[];
	/** Schema or boolean controlling extra object properties. */
	additionalProperties?: SwaggerDefinition | boolean;
	/** Object property definitions. */
	properties?: Record<string, SwaggerDefinition | boolean>;
	/** Regex-keyed property definitions. */
	patternProperties?: Record<string, SwaggerDefinition | boolean>;
	/** Schema validating property names. */
	propertyNames?: SwaggerDefinition | boolean;
	/** Schemas conditionally applied when a property is present. */
	dependentSchemas?: Record<string, SwaggerDefinition | boolean>;
	/** Required properties conditionally applied when a property is present. */
	dependentRequired?: Record<string, string[]>;
	/** Polymorphism discriminator metadata. */
	discriminator?: DiscriminatorObject;
	/** Declares the property as read-only. */
	readOnly?: boolean;
	/** Declares the property as write-only. */
	writeOnly?: boolean;
	/** OAS 3.0 nullable flag. */
	nullable?: boolean;
	/** List of required property names. */
	required?: string[];
	/** Example of the schema. */
	example?: OpenApiValue;
	/** Array of examples of the schema. */
	examples?: OpenApiValue[];
	/** XML serialization metadata. */
	xml?: XmlObject;
	/** Additional external documentation for this schema. */
	externalDocs?: ExternalDocumentationObject;

	[key: string]: OpenApiValue;
}

/**
 * Defines a security scheme that can be used by the operations.
 */
export interface SecurityScheme {
	/** The type of the security scheme. */
	type: "apiKey" | "http" | "oauth2" | "openIdConnect" | "mutualTLS" | string;
	/** A description for security scheme. */
	description?: string;
	/** The location of the API key. */
	in?: "header" | "query" | "cookie" | string;
	/** The name of the header, query or cookie parameter to be used. */
	name?: string;
	/** The name of the HTTP Authorization scheme to be used. */
	scheme?: "bearer" | string;
	/** A hint to the client to identify how the bearer token is formatted. */
	bearerFormat?: string;
	/** An object containing configuration information for the flow types supported. */
	flows?: Record<string, OpenApiValue>;
	/** OpenId Connect URL to discover OAuth2 configuration values. */
	openIdConnectUrl?: string;
	/** OAuth 2.0 Authorization Server Metadata URL (OAS 3.2). */
	oauth2MetadataUrl?: string;
	/** Specifies that the security scheme is deprecated (OAS 3.2). */
	deprecated?: boolean;

	[key: string]: OpenApiValue;
}

/**
 * Describes a single API operation on a path.
 */
export interface SpecOperation {
	/** A list of tags for API documentation control. */
	tags?: string[];
	/** A short summary of what the operation does. */
	summary?: string;
	/** A verbose explanation of the operation behavior. */
	description?: string;
	/** Additional external documentation for this operation. */
	externalDocs?: ExternalDocumentationObject;
	/** Unique string used to identify the operation. */
	operationId?: string;
	/** Swagger 2.0 MIME types the operation can consume. */
	consumes?: string[];
	/** Swagger 2.0 MIME types the operation can produce. */
	produces?: string[];
	/** A list of parameters that are applicable for this operation. */
	parameters?: OpenApiValue[];
	/** The request body applicable for this operation. */
	requestBody?: OpenApiValue;
	/** The list of possible responses as they are returned from executing this operation. */
	responses: Record<string, OpenApiValue>;
	/** Swagger 2.0 transfer protocols for the operation. */
	schemes?: string[];
	/** Declares this operation to be deprecated. */
	deprecated?: boolean;
	/** A declaration of which security mechanisms can be used for this operation. */
	security?: Record<string, string[]>[];
	/** An alternative server array to service this operation. */
	servers?: ServerObject[];
	/** A map of possible out-of band callbacks related to the parent operation. */
	callbacks?: Record<string, PathItem | ReferenceLike>;

	[key: string]: OpenApiValue;
}

/**
 * Describes the operations available on a single path.
 */
export interface PathItem {
	/** Allows for an external definition of this path item. */
	$ref?: string;
	/** An optional, string summary, intended to apply to all operations in this path. */
	summary?: string;
	/** An optional, string description, intended to apply to all operations in this path. */
	description?: string;
	/** A definition of a GET operation on this path. */
	get?: SpecOperation;
	/** A definition of a PUT operation on this path. */
	put?: SpecOperation;
	/** A definition of a POST operation on this path. */
	post?: SpecOperation;
	/** A definition of a DELETE operation on this path. */
	delete?: SpecOperation;
	/** A definition of an OPTIONS operation on this path. */
	options?: SpecOperation;
	/** A definition of a HEAD operation on this path. */
	head?: SpecOperation;
	/** A definition of a PATCH operation on this path. */
	patch?: SpecOperation;
	/** A definition of a TRACE operation on this path. */
	trace?: SpecOperation;
	/** A definition of a QUERY operation on this path (OAS 3.2). */
	query?: SpecOperation;
	/** Custom HTTP method operations on this path (OAS 3.2). */
	additionalOperations?: Record<string, SpecOperation>;
	/** A list of parameters that are applicable for all the operations described under this path. */
	parameters?: OpenApiValue[];
	/** An alternative server array to service all operations in this path. */
	servers?: ServerObject[];

	[key: string]: OpenApiValue;
}

/**
 * Reusable components container for an OpenAPI 3.x document.
 */
export interface ComponentsObject {
	/** Reusable Schema Objects. */
	schemas?: Record<string, SwaggerDefinition | boolean>;
	/** Reusable Response Objects. */
	responses?: Record<string, SwaggerResponse | ReferenceLike>;
	/** Reusable Security Scheme Objects. */
	securitySchemes?: Record<string, SecurityScheme | ReferenceLike>;
	/** Reusable Path Item Objects (OAS 3.1+). */
	pathItems?: Record<string, PathItem>;
	/** Reusable Callback Objects. */
	callbacks?: Record<string, PathItem | ReferenceLike>;
	/** Reusable Link Objects. */
	links?: Record<string, LinkObject | ReferenceLike>;
	/** Reusable Header Objects. */
	headers?: Record<string, HeaderObject | ReferenceLike>;
	/** Reusable Parameter Objects. */
	parameters?: Record<string, Parameter | ReferenceLike>;
	/** Reusable Request Body Objects. */
	requestBodies?: Record<string, RequestBody | ReferenceLike>;
	/** Reusable Example Objects. */
	examples?: Record<string, ExampleObject | ReferenceLike>;
	/** Reusable Media Type Objects (OAS 3.2). */
	mediaTypes?: Record<string, MediaTypeObject | ReferenceLike>;
	/** Reusable Webhook Path Item Objects. */
	webhooks?: Record<string, PathItem | ReferenceLike>;

	/** Additional vendor extension properties. */
	[key: string]: OpenApiValue;
}

/**
 * Root document object of the OpenAPI / Swagger specification.
 */
export interface SwaggerSpec {
	/** This string MUST be the version number of the OpenAPI Specification. */
	openapi?: string;
	/** Specifies the Swagger Specification version being used ("2.0"). */
	swagger?: string;
	/** Swagger 2.0: Hostname (and optional port) serving the API. */
	host?: string;
	/** Swagger 2.0: Base path prefix for all API endpoints. */
	basePath?: string;
	/** Swagger 2.0: Transfer protocols (e.g., http, https). */
	schemes?: string[];
	/** Swagger 2.0: Default request body media types. */
	consumes?: string[];
	/** Swagger 2.0: Default response media types. */
	produces?: string[];
	/** Base URI of the OpenAPI document (OAS 3.2). */
	$self?: string;
	/** Provides metadata about the API. */
	info: InfoObject;
	/** Additional external documentation. */
	externalDocs?: ExternalDocumentationObject;
	/** A list of tags used by the document with additional metadata. */
	tags?: TagObject[];
	/** A declaration of which security mechanisms can be used across the API. */
	security?: Record<string, string[]>[];
	/** The available paths and operations for the API. */
	paths?: Record<string, PathItem>;
	/** The incoming webhooks that MAY be received as part of this API (OAS 3.1+). */
	webhooks?: Record<string, PathItem>;
	/** The default value for the $schema keyword within Schema Objects (OAS 3.1+). */
	jsonSchemaDialect?: string;
	/** An array of Server Objects, which provide connectivity information to a target server. */
	servers?: ServerObject[];
	/** Swagger 2.0 schema definitions. */
	definitions?: Record<string, SwaggerDefinition | boolean>;
	/** An element to hold various schemas for the document. */
	components?: ComponentsObject;
	/** Swagger 2.0 security definitions. */
	securityDefinitions?: Record<string, SecurityScheme>;

	[key: string]: OpenApiValue;
}

/** Re-exports `isDynamicReferenceObject` from `../../openapi/type_guards.js`. */
/** Re-exports `isOpenApiObject` from `../../openapi/type_guards.js`. */
/** Re-exports `isParameterObject` from `../../openapi/type_guards.js`. */
/** Re-exports `isReferenceObject` from `../../openapi/type_guards.js`. */
/** Re-exports `isSwaggerDefinition` from `../../openapi/type_guards.js`. */
export {
	isDynamicReferenceObject,
	isOpenApiObject,
	isParameterObject,
	isReferenceObject,
	isSwaggerDefinition,
} from "../../openapi/type_guards.js";
