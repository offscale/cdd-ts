/**
 * Emits `openapi.snapshot.json` and `openapi.snapshot.yaml` files into the generated SDK output directory.
 *
 * @module openapi/emit_snapshot
 */
import type { Project } from "ts-morph";
import type { OpenApiValue } from "../core/types/index.js";
import type { SwaggerParser } from "./parse.js";
import {
	type SnapshotFileSystem,
	writeOpenApiSnapshot,
} from "./parse_snapshot.js";

/**
 * Writes OpenAPI specification snapshots (`openapi.snapshot.json` and `openapi.snapshot.yaml`) to the target directory.
 */
export class SpecSnapshotGenerator {
	/**
	 * Creates a new `SpecSnapshotGenerator`.
	 *
	 * @param parser - The parsed OpenAPI specification.
	 * @param project - The `ts-morph` project providing the virtual/physical file system.
	 */
	constructor(
		private readonly parser: SwaggerParser,

		private readonly project: Project,
	) {}

	/**
	 * Writes the OpenAPI snapshots to `outputDir`.
	 *
	 * @param outputDir - Target SDK output directory.
	 */
	public generate(outputDir: string): void {
		writeOpenApiSnapshot(
			this.parser.getSpec(),
			outputDir,
			this.project.getFileSystem() as OpenApiValue as SnapshotFileSystem,
		);
	}
}
