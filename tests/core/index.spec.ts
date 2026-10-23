import { parseFrameworkOption, parseServerFrameworkOption } from "@src/cli.js";
import {
	buildOpenApiSpecFromScan,
	generateFromConfigSync,
	getGeneratorFactory,
	getOrmGeneratorFactory,
	getServerGeneratorFactory,
	scanTypeScriptSource,
} from "@src/index.js";
import { AngularClientGenerator } from "@src/vendors/angular/angular-client.generator.js";
import { AxiosClientGenerator } from "@src/vendors/axios/axios-client.generator.js";
import { ExpressServerGenerator } from "@src/vendors/express/express-server.generator.js";
import { FetchClientGenerator } from "@src/vendors/fetch/fetch-client.generator.js";
import { NodeClientGenerator } from "@src/vendors/node/node-client.generator.js";
import { ReactClientGenerator } from "@src/vendors/react/react-client.generator.js";
import { TypeOrmGenerator } from "@src/vendors/typeorm/emit.js";
import { VueClientGenerator } from "@src/vendors/vue/vue-client.generator.js";
import { describe, expect, it } from "vitest";
import {
	createTestConfig,
	createTestProject,
	createTestSpec,
	expectZeroTypeScriptDiagnostics,
} from "../shared/helpers.js";

describe("Index", () => {
	it("should return correct client, ORM, and server factories", () => {
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

		expect(getOrmGeneratorFactory("typeorm")).toBeInstanceOf(TypeOrmGenerator);
		expect(getOrmGeneratorFactory("other")).toBeUndefined();

		expect(getServerGeneratorFactory("express")).toBeInstanceOf(
			ExpressServerGenerator,
		);
		expect(getServerGeneratorFactory("other")).toBeUndefined();
	});

	it("should validate framework and serverFramework options", () => {
		expect(parseFrameworkOption("angular")).toBe("angular");
		expect(parseFrameworkOption("react")).toBe("react");
		expect(parseFrameworkOption("vue")).toBe("vue");
		expect(parseFrameworkOption("vanilla")).toBe("vanilla");
		expect(parseFrameworkOption("Vanilla JS")).toBe("vanilla");
		expect(parseFrameworkOption("other")).toBe("vanilla");

		expect(parseServerFrameworkOption("express")).toBe("express");
		expect(parseServerFrameworkOption("other")).toBe("express");
	});

	it("should support custom injectable GeneratorLogger in resolveLogger", async () => {
		const { resolveLogger } = await import("@src/core/types/index.js");
		const infos: string[] = [];
		const warns: string[] = [];
		const errors: string[] = [];
		const customConfig = createTestConfig();
		customConfig.logger = {
			info: (m) => infos.push(m),
			warn: (m) => warns.push(m),
			error: (m) => errors.push(m),
		};
		const customLogger = resolveLogger(customConfig);
		customLogger.info("i");
		customLogger.warn("w");
		customLogger.error("e");
		expect(infos).toEqual(["i"]);
		expect(warns).toEqual(["w"]);
		expect(errors).toEqual(["e"]);

		const errSpy = (await import("vitest")).vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		resolveLogger().error("default-err");
		expect(errSpy).toHaveBeenCalledWith("default-err");
		errSpy.mockRestore();
	});

	it("should execute generateFromConfigSync for SDK, CLI, and Server scopes without mutating caller config", () => {
		const spec = createTestSpec({
			openapi: "3.0.0",
			info: { title: "Test API", version: "1.0.0" },
			paths: {
				"/items": {
					get: {
						operationId: "listItems",
						responses: {
							"200": {
								description: "OK",
								content: {
									"application/json": {
										schema: { $ref: "#/components/schemas/Item" },
									},
								},
							},
						},
					},
				},
			},
			components: {
				schemas: {
					Item: {
						type: "object",
						required: ["id", "name"],
						properties: {
							id: { type: "integer" },
							name: { type: "string" },
						},
					},
				},
			},
		});

		const sdkProject = createTestProject();
		const sdkConfig = createTestConfig({
			output: "/sdk-out",
			options: {
				framework: "vanilla",
				implementation: "fetch",
				generateServices: true,
				mcp: true,
			},
		});
		generateFromConfigSync(sdkConfig, sdkProject, { spec }, "to_sdk_cli");
		expect(sdkProject.getSourceFile("/sdk-out/cli.ts")).toBeDefined();
		expect(sdkProject.getSourceFile("/sdk-out/mcp.ts")).toBeDefined();
		expectZeroTypeScriptDiagnostics(sdkProject);

		const serverProject = createTestProject();
		const serverConfig = createTestConfig({
			output: "/srv-out",
			options: {
				orm: "typeorm",
				serverFramework: "express",
				generateServices: true,
			},
		});
		generateFromConfigSync(serverConfig, serverProject, { spec }, "to_server");
		expect(serverConfig.options.generateServices).toBe(true);
		expect(
			serverProject.getSourceFile("/srv-out/entities/item.entity.ts"),
		).toBeDefined();
		expect(
			serverProject.getSourceFile("/srv-out/routes/item.routes.ts"),
		).toBeDefined();
		expect(serverProject.getSourceFile("/srv-out/server.ts")).toBeDefined();
		expectZeroTypeScriptDiagnostics(serverProject);
	});

	it("should reverse-scan TypeScript source into an OpenAPI specification", () => {
		const ir = scanTypeScriptSource(
			`
export interface Widget {
  id: string;
}
app.get('/widgets/:id', async (req, res) => {
  res.status(200).json({ id: req.params.id });
});
`,
			"widget.routes.ts",
		);
		const spec = buildOpenApiSpecFromScan(ir);
		expect(spec.paths?.["/widgets/{id}"]?.get).toBeDefined();
		expect(spec.components?.schemas?.Widget).toBeDefined();
	});

	it("should verify all markdown checklists and conformance tables are 100% checked with zero TODOs", async () => {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");
		const rootDir = process.cwd();
		const checklistFiles = [
			"FUTURE.md",
			"conformance/mock-server/mock-server-plan.md",
		];
		for (const relPath of checklistFiles) {
			const content = readFileSync(resolve(rootDir, relPath), "utf8");
			expect(content).not.toMatch(/\[\s*\]/);
		}

		const conformanceFiles = [
			"conformance/arazzo-1.1.0/client-sdk-cli.md",
			"conformance/arazzo-1.1.0/client-sdk.md",
			"conformance/arazzo-1.1.0/servers.md",
			"conformance/mcp-1.0.0/client-sdk-cli.md",
			"conformance/mcp-1.0.0/client-sdk.md",
			"conformance/mcp-1.0.0/servers.md",
			"conformance/openapi-3.2.0/client-sdk-cli.md",
			"conformance/openapi-3.2.0/client-sdk.md",
			"conformance/openapi-3.2.0/servers.md",
			"conformance/swagger-2.0/client-sdk-cli.md",
			"conformance/swagger-2.0/client-sdk.md",
			"conformance/swagger-2.0/servers.md",
		];
		for (const relPath of conformanceFiles) {
			const content = readFileSync(resolve(rootDir, relPath), "utf8");
			expect(content).not.toMatch(/\[\s*\]/);
			expect(content).not.toMatch(/\| TODO \|/);
			for (const line of content.split("\n")) {
				if (
					line.startsWith("|") &&
					line.includes("`[") &&
					!line.includes("Presence `[To, From]`")
				) {
					const columns = line.split("|").map((c) => c.trim());
					expect(columns[2]).toBe("`[x]` , `[x]`");
					expect(columns[3]).toBe("`[x]` , `[x]`");
					expect(columns[4]).toBe("`[x]` , `[x]`");
				}
			}
		}
	});
});
