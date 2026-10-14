import { parseFrameworkOption, parseServerFrameworkOption } from "@src/cli.js";
import { getGeneratorFactory } from "@src/index.js";
import { AngularClientGenerator } from "@src/vendors/angular/angular-client.generator.js";
import { AxiosClientGenerator } from "@src/vendors/axios/axios-client.generator.js";
import { FetchClientGenerator } from "@src/vendors/fetch/fetch-client.generator.js";
import { NodeClientGenerator } from "@src/vendors/node/node-client.generator.js";
import { ReactClientGenerator } from "@src/vendors/react/react-client.generator.js";
import { VueClientGenerator } from "@src/vendors/vue/vue-client.generator.js";
import { describe, expect, it } from "vitest";

describe("Index", () => {
	it("should return correct factories", () => {
		expect(getGeneratorFactory("angular")).toBeInstanceOf(
			AngularClientGenerator,
		);
		expect(getGeneratorFactory("react")).toBeInstanceOf(ReactClientGenerator);
		expect(getGeneratorFactory("react", "axios")).toBeInstanceOf(
			ReactClientGenerator,
		);
		expect(getGeneratorFactory("vue")).toBeInstanceOf(VueClientGenerator);
		expect(getGeneratorFactory("vue", "node")).toBeInstanceOf(
			VueClientGenerator,
		);
		expect(getGeneratorFactory("vanilla")).toBeInstanceOf(FetchClientGenerator);
		expect(getGeneratorFactory("vanilla js")).toBeInstanceOf(
			FetchClientGenerator,
		);
		expect(getGeneratorFactory("vanillajs")).toBeInstanceOf(
			FetchClientGenerator,
		);
		expect(getGeneratorFactory("unknown")).toBeInstanceOf(
			AngularClientGenerator,
		);

		expect(getGeneratorFactory("angular", "fetch")).toBeInstanceOf(
			FetchClientGenerator,
		);
		expect(getGeneratorFactory("angular", "axios")).toBeInstanceOf(
			AxiosClientGenerator,
		);
		expect(getGeneratorFactory("angular", "node")).toBeInstanceOf(
			NodeClientGenerator,
		);
	});

	it("should validate framework and serverFramework options", () => {
		expect(parseFrameworkOption("angular")).toBe("angular");
		expect(parseFrameworkOption("react")).toBe("react");
		expect(parseFrameworkOption("vue")).toBe("vue");
		expect(parseFrameworkOption("vanilla")).toBe("vanilla");
		expect(parseFrameworkOption("Vanilla JS")).toBe("Vanilla JS");
		expect(parseFrameworkOption("other")).toBe("vanilla");

		expect(parseServerFrameworkOption("express")).toBe("express");
		expect(parseServerFrameworkOption("other")).toBe("express");
	});
});
