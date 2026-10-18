/**
 * Emits `arazzo.snapshot.json` and `arazzo.snapshot.yaml` files into a generated output directory.
 *
 * @module arazzo/emit_snapshot
 */
import type { Project } from "ts-morph";
import type { ArazzoParser } from "./parse.js";
import {
	type ArazzoSnapshotFileSystem,
	writeArazzoSnapshot,
} from "./parse_snapshot.js";

/**
 * Generator that writes lossless Arazzo 1.1.0 snapshots into a ts-morph `Project` output directory.
 */
export class ArazzoSnapshotGenerator {
	/**
	 * Creates a new `ArazzoSnapshotGenerator`.
	 *
	 * @param project - Target `ts-morph` Project.
	 * @param parser - Initialized `ArazzoParser`.
	 */
	public constructor(
		private readonly project: Project,
		private readonly parser: ArazzoParser,
	) {}

	/**
	 * Emits `arazzo.snapshot.json` and `arazzo.snapshot.yaml` into `outputDir`.
	 *
	 * @param outputDir - Target output directory path.
	 */
	public generate(outputDir: string): void {
		writeArazzoSnapshot(
			this.parser.getSpec(),
			outputDir,
			this.project.getFileSystem() as unknown as ArazzoSnapshotFileSystem,
		);
	}
}
