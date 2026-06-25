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
		expect(getGeneratorFactory("vue")).toBeInstanceOf(VueClientGenerator);
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
});
