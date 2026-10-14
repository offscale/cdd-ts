/**
 * Validation rule discriminated union types for Angular admin reactive forms.
 *
 * @module vendors/angular/admin/analysis/validation-types
 */
import type { JsonValue } from "./form-types.js";

/** Parameterless validation rule (`required`, `email`, or `uniqueItems`). */
export interface SimpleValidationRule {
	/** Validation rule discriminator kind. */
	type: "required" | "email" | "uniqueItems";
}

/** Numeric bound or length validation rule. */
export interface NumericValidationRule {
	/** Validation rule discriminator kind. */
	type:
		| "minLength"
		| "maxLength"
		| "min"
		| "max"
		| "exclusiveMinimum"
		| "exclusiveMaximum"
		| "multipleOf"
		| "minItems"
		| "maxItems"
		| "minProperties"
		| "maxProperties";
	/** Numeric threshold or divisor value. */
	value: number;
}

/** Regular expression pattern validation rule. */
export interface PatternValidationRule {
	/** Validation rule discriminator kind. */
	type: "pattern";
	/** Regular expression pattern string. */
	value: string;
	/** Optional regular expression flags. */
	flags?: string;
}

/** Array `contains` validation rule with optional min/max occurrence counts. */
export interface ContainsValidationRule {
	/** Validation rule discriminator kind. */
	type: "contains";
	/** JSON Schema that matching array items must satisfy. */
	schema: JsonValue;
	/** Minimum number of matching items (`minContains`). */
	min?: number;
	/** Maximum number of matching items (`maxContains`). */
	max?: number;
}

/** Exact constant value validation rule (`const`). */
export interface ConstValidationRule {
	/** Validation rule discriminator kind. */
	type: "const";
	/** Expected constant JSON value. */
	value: JsonValue;
}

/** Negated validation rule composition (`not`). */
export interface NotValidationRule {
	/** Validation rule discriminator kind. */
	type: "not";
	/** Inner validation rules that must not all pass. */
	rules: ValidationRule[];
}

/** Discriminated union of all supported reactive form validation rules. */
export type ValidationRule =
	| SimpleValidationRule
	| NumericValidationRule
	| PatternValidationRule
	| ContainsValidationRule
	| ConstValidationRule
	| NotValidationRule;
