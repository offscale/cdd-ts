/**
 * Renders Angular `Validators` and `FormControl`/`FormGroup`/`FormArray` initializers from analyzed form models.
 *
 * @module vendors/angular/admin/form.renderer
 */

import type { FormControlModel } from "./analysis/form-types.js";
import type { ValidationRule } from "./analysis/validation-types.js";

/**
 * Renders an array of `ValidationRule` descriptors into an Angular validator array expression string.
 */
export class ValidationRenderer {
	/**
	 * Renders a list of validation rules into a bracketed TypeScript array expression (e.g. `[Validators.required]`).
	 *
	 * @param rules - Validation rules to render.
	 * @returns Rendered validator array expression, or `""` when `rules` is empty.
	 */
	public static render(rules?: ValidationRule[] | null): string {
		if (!rules || rules.length === 0) {
			return "";
		}

		const renderedRules = rules.map((rule) =>
			ValidationRenderer.renderRule(rule),
		);

		return `[${renderedRules.join(", ")}]`;
	}

	private static renderRule(rule: ValidationRule): string {
		switch (rule.type) {
			case "required":
				return "Validators.required";
			case "email":
				return "Validators.email";
			case "minLength":
				return `Validators.minLength(${rule.value})`;
			case "maxLength":
				return `Validators.maxLength(${rule.value})`;
			case "min":
				return `Validators.min(${rule.value})`;
			case "max":
				return `Validators.max(${rule.value})`;
			case "pattern":
				return `Validators.pattern(/${rule.value}/)`;
			case "multipleOf":
				return `CustomValidators.multipleOf(${rule.value})`;
			case "exclusiveMinimum":
				return `CustomValidators.exclusiveMinimum(${rule.value})`;
			case "exclusiveMaximum":
				return `CustomValidators.exclusiveMaximum(${rule.value})`;
			case "uniqueItems":
				return `CustomValidators.uniqueItems()`;
			case "minItems":
				return `Validators.minLength(${rule.value})`;
			case "maxItems":
				return `Validators.maxLength(${rule.value})`;
			case "minProperties":
				return `CustomValidators.minProperties(${rule.value})`;
			case "maxProperties":
				return `CustomValidators.maxProperties(${rule.value})`;
			case "contains": {
				const schemaLiteral = JSON.stringify(rule.schema ?? true);

				const minArg = rule.min !== undefined ? `${rule.min}` : "undefined";

				const maxArg = rule.max !== undefined ? `${rule.max}` : "undefined";

				return `CustomValidators.contains(${schemaLiteral}, ${minArg}, ${maxArg})`;
			}
			case "const": {
				const val =
					typeof rule.value === "string"
						? `'${rule.value}'`
						: JSON.stringify(rule.value);

				return `CustomValidators.constValidator(${val})`;
			}
			case "not": {
				const innerValidatorsArrayString = ValidationRenderer.render(
					rule.rules,
				);

				return `CustomValidators.notValidator(Validators.compose(${innerValidatorsArrayString})!)`;
			}
		}
	}
}

/**
 * Renders TypeScript initializer expressions for Angular `FormControl`, `FormGroup`, and `FormArray` instances.
 */
export class FormInitializerRenderer {
	/**
	 * Renders a control initializer expression for the given `FormControlModel`.
	 *
	 * @param control - Analyzed form control model.
	 * @param useFormBuilder - Whether to emit `this.fb.group`/`this.fb.array` instead of `new FormGroup`/`new FormArray`.
	 * @returns TypeScript initializer expression string.
	 */
	public static renderControlInitializer(
		control: FormControlModel,
		useFormBuilder: boolean = true,
	): string {
		const validationString = ValidationRenderer.render(control.validationRules);

		const fbValidatorOptions = validationString
			? `{ validators: ${validationString} }`
			: "";

		switch (control.controlType) {
			case "control": {
				const dataType = control.dataType;

				const defaultValue =
					control.defaultValue !== null
						? JSON.stringify(control.defaultValue)
						: "null";

				const fcValidationString = validationString
					? `, ${validationString}`
					: "";

				return `new FormControl<${dataType}>(${defaultValue}${fcValidationString})`;
			}
			case "group": {
				const nestedInits = (control.nestedControls || [])
					.map(
						(c) =>
							`'${c.name}': ${FormInitializerRenderer.renderControlInitializer(c, useFormBuilder)}`,
					)
					.join(`,
      `);

				if (useFormBuilder) {
					const finalValidatorString = fbValidatorOptions
						? `, ${fbValidatorOptions}`
						: "";

					return `this.fb.group({${nestedInits}}${finalValidatorString})`;
				}

				const finalValidatorString = fbValidatorOptions
					? `, ${fbValidatorOptions}`
					: "";

				return `new FormGroup({${nestedInits}}${finalValidatorString})`;
			}
			case "array": {
				const fbValidationString = validationString
					? `, ${validationString}`
					: "";

				if (useFormBuilder) {
					return `this.fb.array([]${fbValidationString})`;
				}

				return `new FormArray([]${fbValidationString})`;
			}
			case "map": {
				const fbValidationString = validationString
					? `, ${validationString}`
					: "";

				if (useFormBuilder) {
					return `this.fb.array([]${fbValidationString})`;
				}

				return `new FormArray([]${fbValidationString})`;
			}
		}
	}

	/**
	 * Renders a `new FormGroup({ ... })` initializer for an item inside a `FormArray`.
	 *
	 * @param controls - Child form controls of the array item group.
	 * @returns TypeScript expression string creating the `FormGroup`.
	 */
	public static renderFormArrayItemInitializer(
		controls?: FormControlModel[],
	): string {
		const formControls = (controls || [])
			.map((c) => {
				const validationString = ValidationRenderer.render(c.validationRules);

				const finalValidationString = validationString
					? `, ${validationString}`
					: "";

				const defaultValueString =
					c.defaultValue !== null ? JSON.stringify(c.defaultValue) : "null";

				const itemAccess = `item?.${c.name} ?? ${defaultValueString}`;

				const dataType = c.dataType;

				return `'${c.name}': new FormControl<${dataType}>(${itemAccess}${finalValidationString})`;
			})
			.join(`,
      `);

		return `new FormGroup({
      ${formControls}
    })`;
	}

	/**
	 * Renders a `new FormGroup({ 'key': ..., 'value': ... })` initializer for a dynamic map entry.
	 *
	 * @param valueControl - Control model for the map entry value.
	 * @param keyPattern - Optional regex pattern constraining the map entry key.
	 * @param keyMinLength - Optional minimum length for the map entry key.
	 * @param keyMaxLength - Optional maximum length for the map entry key.
	 * @returns TypeScript expression string creating the map entry `FormGroup`.
	 */
	public static renderMapItemInitializer(
		valueControl: FormControlModel,
		keyPattern?: string,
		keyMinLength?: number,
		keyMaxLength?: number,
	): string {
		const keyValidators = ["Validators.required"];

		if (keyPattern) {
			keyValidators.push(`Validators.pattern(/${keyPattern}/)`);
		}

		if (typeof keyMinLength === "number") {
			keyValidators.push(`Validators.minLength(${keyMinLength})`);
		}

		if (typeof keyMaxLength === "number") {
			keyValidators.push(`Validators.maxLength(${keyMaxLength})`);
		}

		const keyValidatorString = `[${keyValidators.join(", ")}]`;

		const keyInit = `new FormControl<string>(item?.key ?? '', ${keyValidatorString})`;

		const validationString = ValidationRenderer.render(
			valueControl.validationRules,
		);

		const finalValidationString = validationString
			? `, ${validationString}`
			: "";

		const dataType = valueControl.dataType;

		const valInit = `new FormControl<${dataType}>(item?.value ?? null${finalValidationString})`;

		return `new FormGroup({ 'key': ${keyInit}, 'value': ${valInit} })`;
	}
}
