import type { OpenApiValue } from "@src/core/types/index.js";
import type { SwaggerParser } from "@src/openapi/parse.js";
import { writeOpenApiSnapshot } from "@src/openapi/parse_snapshot.js";
import type { Project } from "ts-morph";

export class SpecSnapshotGenerator {
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	public generate(outputDir: string): void {
		writeOpenApiSnapshot(
			this.parser.getSpec(),
			outputDir,
			this.project.getFileSystem() as OpenApiValue as import("@src/openapi/parse_snapshot.js").SnapshotFileSystem,
		);
	}
}
