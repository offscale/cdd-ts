/**
 * Re-exports all core OpenAPI, configuration, and analysis types.
 *
 * @module core/types
 */

/** Re-exports `FormProperty` from `./analysis.js`. */
/** Re-exports `PathInfo` from `./analysis.js`. */
/** Re-exports `Resource` from `./analysis.js`. */
/** Re-exports `ResourceOperation` from `./analysis.js`. */
export type {
	FormProperty,
	PathInfo,
	Resource,
	ResourceOperation,
} from "./analysis.js";
/** Re-exports `GeneratorCompilerOptions` from `./config.js`. */
/** Re-exports `GeneratorConfig` from `./config.js`. */
/** Re-exports `GeneratorConfigOptions` from `./config.js`. */
/** Re-exports `TargetFramework` from `./config.js`. */
/** Re-exports `TargetImplementation` from `./config.js`. */
/** Re-exports `TargetServerFramework` from `./config.js`. */
export type {
	GeneratorCompilerOptions,
	GeneratorConfig,
	GeneratorConfigOptions,
	TargetFramework,
	TargetImplementation,
	TargetServerFramework,
} from "./config.js";
/** Re-exports `ComponentsObject` from `./openapi.js`. */
/** Re-exports `ContactObject` from `./openapi.js`. */
/** Re-exports `DiscriminatorObject` from `./openapi.js`. */
/** Re-exports `DynamicReferenceObject` from `./openapi.js`. */
/** Re-exports `EncodingProperty` from `./openapi.js`. */
/** Re-exports `ExampleObject` from `./openapi.js`. */
/** Re-exports `ExternalDocumentationObject` from `./openapi.js`. */
/** Re-exports `HeaderObject` from `./openapi.js`. */
/** Re-exports `InfoObject` from `./openapi.js`. */
/** Re-exports `JsonPrimitive` from `./openapi.js`. */
/** Re-exports `LicenseObject` from `./openapi.js`. */
/** Re-exports `LinkObject` from `./openapi.js`. */
/** Re-exports `MediaTypeObject` from `./openapi.js`. */
/** Re-exports `OpenApiArray` from `./openapi.js`. */
/** Re-exports `OpenApiObject` from `./openapi.js`. */
/** Re-exports `OpenApiValue` from `./openapi.js`. */
/** Re-exports `Parameter` from `./openapi.js`. */
/** Re-exports `PathItem` from `./openapi.js`. */
/** Re-exports `ReferenceLike` from `./openapi.js`. */
/** Re-exports `ReferenceObject` from `./openapi.js`. */
/** Re-exports `RequestBody` from `./openapi.js`. */
/** Re-exports `SecurityScheme` from `./openapi.js`. */
/** Re-exports `ServerObject` from `./openapi.js`. */
/** Re-exports `ServerVariableObject` from `./openapi.js`. */
/** Re-exports `SpecOperation` from `./openapi.js`. */
/** Re-exports `SwaggerDefinition` from `./openapi.js`. */
/** Re-exports `SwaggerResponse` from `./openapi.js`. */
/** Re-exports `SwaggerSpec` from `./openapi.js`. */
/** Re-exports `TagObject` from `./openapi.js`. */
/** Re-exports `XmlObject` from `./openapi.js`. */
export type {
	ComponentsObject,
	ContactObject,
	DiscriminatorObject,
	DynamicReferenceObject,
	EncodingProperty,
	ExampleObject,
	ExternalDocumentationObject,
	HeaderObject,
	InfoObject,
	JsonPrimitive,
	LicenseObject,
	LinkObject,
	MediaTypeObject,
	OpenApiArray,
	OpenApiObject,
	OpenApiValue,
	Parameter,
	PathItem,
	ReferenceLike,
	ReferenceObject,
	RequestBody,
	SecurityScheme,
	ServerObject,
	ServerVariableObject,
	SpecOperation,
	SwaggerDefinition,
	SwaggerResponse,
	SwaggerSpec,
	TagObject,
	XmlObject,
} from "./openapi.js";
/** Re-exports `isDynamicReferenceObject` from `./openapi.js`. */
/** Re-exports `isOpenApiObject` from `./openapi.js`. */
/** Re-exports `isParameterObject` from `./openapi.js`. */
/** Re-exports `isReferenceObject` from `./openapi.js`. */
/** Re-exports `isSwaggerDefinition` from `./openapi.js`. */
export {
	isDynamicReferenceObject,
	isOpenApiObject,
	isParameterObject,
	isReferenceObject,
	isSwaggerDefinition,
} from "./openapi.js";
