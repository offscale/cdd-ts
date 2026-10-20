/**
 * Domain models and analysis result types for framework-agnostic Admin UI form generation.
 *
 * @module core/admin/form-types
 */
import type { SwaggerDefinition } from "../types/index.js";
import type { ValidationRule } from "./validation-types.js";

/** Reactive form control structural classification. */
export type ControlType = "control" | "group" | "array" | "map";

/** Dictionary of JSON values indexed by string key. */
export interface JsonObject {
	/** JSON property value. */
	[key: string]: JsonValue;
}

/** Recursive JSON value type used for form default values and schema constraints. */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonObject
	| JsonValue[];

/** Analyzed metadata for a single reactive form control, group, array, or map. */
export interface FormControlModel {
	/** Control name used in the form group. */
	name: string;
	/** Original schema property name. */
	propertyName: string;
	/** TypeScript data type string for the control value. */
	dataType: string;
	/** Structural kind of the form control. */
	controlType: ControlType;
	/** Initial default value for the control. */
	defaultValue: JsonValue;
	/** Validation rules attached to the control. */
	validationRules: ValidationRule[];

	/** Name of the generated TypeScript interface for nested form groups. */
	nestedFormInterface?: string | undefined;
	/** Child form controls when `controlType` is `"group"` or `"array"`. */
	nestedControls?: FormControlModel[] | undefined;

	/** Value control model when `controlType` is `"map"`. */
	mapValueControl?: FormControlModel | undefined;
	/** Regex pattern constraining map keys. */
	keyPattern?: string | undefined;
	/** Minimum string length for map keys. */
	keyMinLength?: number | undefined;
	/** Maximum string length for map keys. */
	keyMaxLength?: number | undefined;

	/** Underlying OpenAPI schema definition for the property. */
	schema?: SwaggerDefinition | undefined;
}

/** Represents a single polymorphic sub-form option for a discriminated union. */
export interface PolymorphicOptionModel {
	/** Discriminator literal value identifying this variant. */
	discriminatorValue: string;
	/** Generated sub-form group name. */
	subFormName: string;
	/** Controls belonging to this polymorphic variant. */
	controls: FormControlModel[];
	/** PascalCase model name for this variant. */
	modelName: string;
}

/** Configuration for a polymorphic (`oneOf`/`anyOf`) property on a form. */
export interface PolymorphicPropertyConfig {
	/** Name of the discriminator property. */
	propertyName: string;
	/** Allowed discriminator string values. */
	discriminatorOptions: string[];
	/** Analyzed polymorphic variant models. */
	options: PolymorphicOptionModel[];
	/** Default discriminator value if specified by the schema. */
	defaultOption?: string | undefined;
}

/** Conditional field dependency rule derived from `dependentRequired`. */
export interface DependencyRule {
	/** Source field name that triggers the dependency when populated. */
	triggerField: string;
	/** Target field name that becomes required. */
	targetField: string;
	/** Dependency rule type. */
	type: "required";
}

/** Property entry inside a generated form interface descriptor. */
export interface FormInterfaceProperty {
	/** Property identifier name. */
	name: string;
}

/** Descriptor for a generated form group TypeScript interface. */
export interface FormInterfaceDescriptor {
	/** Interface name. */
	name: string;
	/** Properties belonging to the interface. */
	properties: FormInterfaceProperty[];
	/** Whether this is the top-level resource form interface. */
	isTopLevel: boolean;
}

/** Complete analysis result for generating an admin form component. */
export interface FormAnalysisResult {
	/** Form group interfaces to emit. */
	interfaces: FormInterfaceDescriptor[];
	/** Top-level form control models. */
	topLevelControls: FormControlModel[];
	/** True when custom JSON Schema validators are required. */
	usesCustomValidators: boolean;
	/** True when the form contains one or more `FormArray` controls. */
	hasFormArrays: boolean;
	/** True when the form includes binary file upload controls. */
	hasFileUploads: boolean;
	/** True when the form includes dynamic key-value map controls. */
	hasMaps?: boolean;
	/** True when the resource schema is polymorphic (`oneOf`/`anyOf`). */
	isPolymorphic: boolean;
	/** Polymorphic property configurations. */
	polymorphicProperties: PolymorphicPropertyConfig[];
	/** Field-to-field dependency rules. */
	dependencyRules: DependencyRule[];
}
