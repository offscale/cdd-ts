import type { Resource } from "@src/core/types/index.js";
import type {
	FormAnalysisResult,
	FormControlModel,
} from "@src/vendors/angular/admin/analysis/form-types.js";
import { generateFormComponentHtml } from "@src/vendors/angular/admin/html/form-component-html.builder.js";
import { buildFormControl } from "@src/vendors/angular/admin/html/form-controls-html.builder.js";
import { describe, expect, it } from "vitest";
import { testCast } from "../shared/helpers.js";

describe("Admin: Form HTML Builders", () => {
	const baseControl = {
		propertyName: "name",
		dataType: "string | null",
		defaultValue: null,
		validationRules: [],
		controlType: "control",
	} as const;

	it("should return null when control or schema is missing", () => {
		expect(buildFormControl(testCast(null))).toBeNull();
		expect(
			buildFormControl(
				testCast({ ...baseControl, name: "missing", schema: undefined }),
			),
		).toBeNull();
	});

	it("should render a readonly textarea", () => {
		const control: FormControlModel = testCast({
			...baseControl,
			name: "notes",
			schema: { type: "string", format: "textarea", readOnly: true },
		});
		const html = buildFormControl(control)?.render();
		expect(html).toContain("textarea");
		expect(html).toContain("[readonly]");
	});

	it("should skip null nested controls in form groups and arrays", () => {
		const nullNested: FormControlModel = testCast({
			...baseControl,
			name: "nested",
			schema: { type: "object" },
			controlType: "control",
		});

		const groupControl: FormControlModel = testCast({
			...baseControl,
			name: "group",
			schema: { type: "object" },
			controlType: "group",
			nestedControls: [nullNested],
		});

		const groupHtml = buildFormControl(groupControl)?.render();
		expect(groupHtml).not.toContain("nested");

		const arrayControl: FormControlModel = testCast({
			...baseControl,
			name: "items",
			schema: { type: "array", items: { type: "object" } },
			controlType: "array",
			nestedControls: [nullNested],
		});

		const arrayHtml = buildFormControl(arrayControl)?.render();
		expect(arrayHtml).not.toContain("nested");
	});

	it("should handle map editor without value control and with null value builder", () => {
		const mapControlNoValue: FormControlModel = testCast({
			...baseControl,
			name: "meta",
			schema: { type: "object" },
			controlType: "map",
			mapValueControl: undefined,
		});

		const mapHtml = buildFormControl(mapControlNoValue)?.render();
		expect(mapHtml).not.toContain("map-key-field");
		expect(mapHtml).not.toContain('formControlName="value"');

		const mapControlNullValue: FormControlModel = testCast({
			...baseControl,
			name: "meta2",
			schema: { type: "object" },
			controlType: "map",

			mapValueControl: testCast({
				...baseControl,
				name: "value",
				schema: { type: "object" },
			}),
		});

		const mapHtmlNullValue = buildFormControl(mapControlNullValue)?.render();
		expect(mapHtmlNullValue).not.toContain("map-key-field");
		expect(mapHtmlNullValue).not.toContain('formControlName="value"');
	});

	it("should tolerate polymorphic analysis without selector control or options", () => {
		const analysis: FormAnalysisResult = {
			interfaces: [],
			topLevelControls: [
				testCast({
					...baseControl,
					name: "kind",
					schema: { type: "object" },
					controlType: "group",
				}),
			],
			usesCustomValidators: false,
			hasFormArrays: false,
			hasFileUploads: false,
			isPolymorphic: true,
			polymorphicProperties: [
				testCast({
					propertyName: "kind",
					discriminatorOptions: [],

					options: testCast(undefined),
				}),
			],
			dependencyRules: [],
		};

		const resource = { name: "test", modelName: "Test" } as Resource;
		const html = generateFormComponentHtml(resource, analysis);

		expect(html).toContain("Create Test");
	});
});
