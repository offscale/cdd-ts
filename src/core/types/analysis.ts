/**
 * Intermediate representation types for analyzed OpenAPI operations and Admin UI resources.
 *
 * @module core/types/analysis
 */
import type {
	ExternalDocumentationObject,
	OpenApiValue,
	Parameter,
	PathItem,
	ReferenceObject,
	RequestBody,
	ServerObject,
	SwaggerDefinition,
	SwaggerResponse,
} from "./openapi.js";

// ===================================================================================
// Derived Types for Admin UI Generation & Parsing
// ===================================================================================

/** A processed, unified representation of a single API operation (e.g., GET /users/{id}). */
export interface PathInfo {
	/** URL path template (e.g., `"/users/{id}"`). */
	path: string;
	/** Uppercase or lowercase HTTP method (e.g., `"GET"`, `"POST"`). */
	method: string;
	/** Unique OpenAPI operation identifier. */
	operationId?: string | undefined;
	/** Short summary of the operation. */
	summary?: string;
	/** Detailed description of the operation. */
	description?: string;
	/** Whether the operation is marked as deprecated. */
	deprecated?: boolean;
	/** External documentation reference for the operation. */
	externalDocs?: ExternalDocumentationObject;
	/** Tags grouping the operation into controllers. */
	tags?: string[];
	/** Consumed media types (Swagger 2.0 compatibility). */
	consumes?: string[];
	/** Produced media types (Swagger 2.0 compatibility). */
	produces?: string[];
	/** Merged path-item and operation parameters. */
	parameters?: Parameter[] | undefined;
	/** Operation request body definition. */
	requestBody?: RequestBody;
	/** Map of status codes to response definitions. */
	responses?: Record<string, SwaggerResponse>;
	/** Sanitized TypeScript method name for the operation. */
	methodName?: string;
	/** Operation-level security requirements. */
	security?: Record<string, string[]>[];
	/** Operation-level or path-level server overrides. */
	servers?: ServerObject[] | undefined;
	/** Operation-level callbacks map. */
	callbacks?: Record<string, PathItem | ReferenceObject>;

	/** Additional OpenAPI specification or vendor extension properties. */
	[key: string]: OpenApiValue;
}

/** A processed representation of an API operation, classified for UI generation. */
export interface ResourceOperation {
	/** The classified action (e.g., `'list'`, `'create'`, `'getById'`, `'update'`, `'delete'`). */
	action: "list" | "create" | "getById" | "update" | "delete" | string;
	/** URL path template for the operation. */
	path: string;
	/** HTTP method for the operation. */
	method: string;
	/** Original OpenAPI operationId. */
	operationId?: string;
	/** The safe, generated method name for the service. */
	methodName?: string;
	/** Parameters accepted by the generated service method. */
	methodParameters?: Parameter[];
	/** True if this is a custom action on a single item (e.g., POST /users/{id}/reset-password). */
	isCustomItemAction?: boolean;
	/** True if this is a custom action on a collection (e.g., POST /users/export). */
	isCustomCollectionAction?: boolean;
}

/** Represents a logical API resource (e.g., "Users"), derived by grouping related paths. */
export interface Resource {
	/** The machine-friendly name of the resource (e.g., `'users'`). */
	name: string;
	/** The human-friendly, singular, PascalCase name for the data model (e.g., `'User'`). */
	modelName: string;
	/** All operations associated with this resource. */
	operations: ResourceOperation[];
	/** True if the resource has any operations that modify data. */
	isEditable: boolean;
	/** All properties of the model, used for generating the create/edit form. */
	formProperties: FormProperty[];
	/** A subset of properties suitable for display in a list or table view. */
	listProperties: FormProperty[];
}

/** A simple wrapper for a property's name and its underlying schema, used for templating. */
export interface FormProperty {
	/** Property identifier on the model. */
	name: string;
	/** OpenAPI schema definition or boolean schema for the property. */
	schema: SwaggerDefinition | boolean;
}
