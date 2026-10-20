import type { IServerFrameworkGenerator } from "@src/core/server/index.js";
import type { GeneratorConfig } from "@src/core/types/config.js";
import { SwaggerParser } from "@src/openapi/parse.js";
import { ExpressServerGenerator } from "@src/vendors/express/express-server.generator.js";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

describe("Core Server Contracts (IServerFrameworkGenerator)", () => {
	it("should emit Express server routes and entrypoint conforming to IServerFrameworkGenerator", () => {
		const config: GeneratorConfig = {
			input: "memory://spec.json",
			output: "/out",
			options: { framework: "vanilla", serverFramework: "express" },
		};
		const parser = new SwaggerParser(
			{
				openapi: "3.1.0",
				info: { title: "Server Contract Spec", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Widget: {
							type: "object",
							properties: { id: { type: "string" } },
						},
					},
				},
			},
			config,
		);

		const project = new Project({ useInMemoryFileSystem: true });
		const serverGen: IServerFrameworkGenerator = new ExpressServerGenerator();
		serverGen.generateEntityRoutes(
			project,
			"Widget",
			"/out/routes",
			"typeorm",
			config,
			parser,
		);
		serverGen.generateServerEntrypoint?.(project, ["Widget"], "/out", parser);

		const routeSf = project.getSourceFileOrThrow(
			"/out/routes/widget.routes.ts",
		);
		expect(routeSf.getFunction("createWidgetRouter")).toBeDefined();
		expect(routeSf.getFullText()).toContain("dataSource.getRepository(Widget)");

		const serverSf = project.getSourceFileOrThrow("/out/server.ts");
		expect(serverSf.getFunction("startServer")).toBeDefined();
		expect(serverSf.getFullText()).toContain("createWidgetRouter(dataSource)");
	});
});
