import { describe, expect, it } from "vitest";
import {
	isArazzoExpressionTypeObject,
	isArazzoReusableObject,
	isArazzoSelectorObject,
	isArazzoSpec,
} from "../../src/core/types/arazzo.js";

describe("Arazzo 1.1.0 Type Guards", () => {
	describe("isArazzoSpec", () => {
		it("returns true for a valid ArazzoSpec object", () => {
			expect(
				isArazzoSpec({
					arazzo: "1.1.0",
					info: { title: "Petstore Workflows", version: "1.0.0" },
					sourceDescriptions: [{ name: "petstore", url: "./openapi.json" }],
					workflows: [{ workflowId: "buyPet", steps: [] }],
				}),
			).toBe(true);
		});

		it("returns false for null, primitives, arrays, or missing required fields", () => {
			expect(isArazzoSpec(null)).toBe(false);
			expect(isArazzoSpec(undefined)).toBe(false);
			expect(isArazzoSpec("1.1.0")).toBe(false);
			expect(isArazzoSpec([])).toBe(false);
			expect(isArazzoSpec({ arazzo: "" })).toBe(false);
			expect(
				isArazzoSpec({
					arazzo: "1.1.0",
					info: null,
					sourceDescriptions: [],
					workflows: [],
				}),
			).toBe(false);
			expect(
				isArazzoSpec({
					arazzo: "1.1.0",
					info: [],
					sourceDescriptions: [],
					workflows: [],
				}),
			).toBe(false);
			expect(
				isArazzoSpec({
					arazzo: "1.1.0",
					info: { title: "T", version: "1" },
					sourceDescriptions: "not-array",
					workflows: [],
				}),
			).toBe(false);
			expect(
				isArazzoSpec({
					arazzo: "1.1.0",
					info: { title: "T", version: "1" },
					sourceDescriptions: [],
					workflows: "not-array",
				}),
			).toBe(false);
		});
	});

	describe("isArazzoReusableObject", () => {
		it("returns true for valid reusable object with reference and optional value", () => {
			expect(
				isArazzoReusableObject({
					reference: "$components.parameters.petId",
					value: 42,
				}),
			).toBe(true);
		});

		it("returns false for non-objects, arrays, empty reference, or objects with name", () => {
			expect(isArazzoReusableObject(null)).toBe(false);
			expect(isArazzoReusableObject([])).toBe(false);
			expect(isArazzoReusableObject({ reference: "   " })).toBe(false);
			expect(
				isArazzoReusableObject({
					name: "petId",
					reference: "$components.parameters.petId",
				}),
			).toBe(false);
		});
	});

	describe("isArazzoExpressionTypeObject", () => {
		it("returns true for jsonpath, xpath, and jsonpointer expression type objects", () => {
			expect(
				isArazzoExpressionTypeObject({
					type: "jsonpath",
					version: "rfc9535",
				}),
			).toBe(true);
			expect(
				isArazzoExpressionTypeObject({
					type: "xpath",
					version: "xpath-31",
				}),
			).toBe(true);
			expect(
				isArazzoExpressionTypeObject({
					type: "jsonpointer",
					version: "rfc6901",
				}),
			).toBe(true);
		});

		it("returns false for invalid types, empty version, or non-objects", () => {
			expect(isArazzoExpressionTypeObject(null)).toBe(false);
			expect(isArazzoExpressionTypeObject("jsonpath")).toBe(false);
			expect(isArazzoExpressionTypeObject([])).toBe(false);
			expect(
				isArazzoExpressionTypeObject({
					type: "simple",
					version: "1.0",
				}),
			).toBe(false);
			expect(
				isArazzoExpressionTypeObject({
					type: "jsonpath",
					version: "   ",
				}),
			).toBe(false);
		});
	});

	describe("isArazzoSelectorObject", () => {
		it("returns true for valid ArazzoSelectorObject", () => {
			expect(
				isArazzoSelectorObject({
					context: "$response.body",
					selector: "$.id",
					type: "jsonpath",
				}),
			).toBe(true);
		});

		it("returns false for non-objects, arrays, or missing context/selector", () => {
			expect(isArazzoSelectorObject(null)).toBe(false);
			expect(isArazzoSelectorObject("$response.body#/id")).toBe(false);
			expect(isArazzoSelectorObject([])).toBe(false);
			expect(
				isArazzoSelectorObject({
					context: "  ",
					selector: "$.id",
				}),
			).toBe(false);
			expect(
				isArazzoSelectorObject({
					context: "$response.body",
					selector: "",
				}),
			).toBe(false);
		});
	});
});
