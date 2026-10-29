/**
 * WebAssembly (Javy) virtual file system host polyfill and stdin payload runner.
 *
 * @module core/wasm-fs
 */
import * as fs from "node:fs";
import type { FileSystemHost } from "ts-morph";

/**
 * Callback signature for running the CLI program with an argument vector.
 */
export interface CliRunner {
	/**
	 * Parses and executes the CLI with `argv`.
	 * @param argv - Command-line arguments.
	 * @returns Promise resolving when execution finishes.
	 */
	(argv: string[]): Promise<void>;
}

/**
 * Virtual file status descriptor returned by `JavyFileSystemHost.statSync`.
 */
export interface JavyFileStat {
	/**
	 * Returns whether the entry is a directory.
	 * @returns `false` in virtual file polyfill.
	 */
	isDirectory(): boolean;
	/**
	 * Returns whether the entry is a regular file.
	 * @returns `true` in virtual file polyfill.
	 */
	isFile(): boolean;
}

/**
 * Extended `ts-morph` `FileSystemHost` polyfill returned in the Javy WebAssembly environment.
 */
export interface JavyFileSystemHost extends FileSystemHost {
	/**
	 * Synchronously reads directory entries.
	 * @param p - Directory path.
	 * @returns Empty directory entry list in virtual FS.
	 */
	readdirSync(p: string): string[];
	/**
	 * Synchronously returns virtual file status metadata.
	 * @param p - File or directory path.
	 * @returns File status descriptor.
	 */
	statSync(p: string): JavyFileStat;
}

/**
 * Creates a `ts-morph` `FileSystemHost` polyfill when running inside the Javy WebAssembly environment.
 *
 * @returns `JavyFileSystemHost` polyfill if `globalThis.__FsData` is defined; otherwise `undefined`.
 */
export function createJavyFsPolyfill(): JavyFileSystemHost | undefined {
	const isJavy = Boolean((globalThis as { __FsData?: unknown }).__FsData);
	if (!isJavy) {
		return undefined;
	}
	return {
		getCurrentDirectory: () => "/",
		directoryExistsSync: () => true,
		fileExistsSync: (p: string) => fs.existsSync(p),
		readFileSync: (p: string) => fs.readFileSync(p, "utf8"),
		readDirSync: () => [],
		readdirSync: () => [],
		statSync: () => ({ isDirectory: () => false, isFile: () => true }),
		realpathSync: (p: string) => p,
		mkdirSync: () => undefined,
		writeFileSync: (p: string, d: string) => {
			fs.writeFileSync(p, d);
		},
		deleteSync: () => undefined,
		moveSync: () => undefined,
		copySync: () => undefined,
		isCaseSensitive: () => true,
	} as Partial<JavyFileSystemHost> as JavyFileSystemHost;
}

/**
 * Reads JSON payload from Javy WebAssembly stdin (`Javy.IO.readSync`) when `globalThis.__FsData` is active.
 *
 * @param runFn - CLI runner callback to invoke with parsed arguments.
 */
export function runJavyStdinIfPresent(runFn: CliRunner): void {
	if (!(globalThis as { __FsData?: unknown }).__FsData) {
		return;
	}
	const Javy = (
		globalThis as {
			Javy?: { IO?: { readSync: (fd: number, buffer: Uint8Array) => number } };
		}
	).Javy;
	if (!Javy?.IO) {
		return;
	}
	const chunks: Uint8Array[] = [];
	let totalLength = 0;
	const readBuf = new Uint8Array(4096);
	try {
		while (true) {
			const bytesRead = Javy.IO.readSync(0, readBuf);
			if (!bytesRead || bytesRead === 0) break;
			chunks.push(readBuf.slice(0, bytesRead));
			totalLength += bytesRead;
		}
	} catch {
		// Ignore EOF errors
	}
	const buffer = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.length;
	}
	const stdinContent = new TextDecoder().decode(buffer);
	if (!stdinContent) {
		return;
	}
	try {
		const parsed = JSON.parse(stdinContent) as {
			input?: unknown;
			args?: string[];
		};
		if (parsed.input) {
			(globalThis as { __SPEC_JSON?: unknown }).__SPEC_JSON = parsed.input;
		}
		if (parsed.args) {
			const actualArgs =
				parsed.args[0] === "cdd-ts" ? parsed.args.slice(1) : parsed.args;
			if (actualArgs[0] === "to_openapi") {
				actualArgs[actualArgs.indexOf("-i") + 1] = "/input.service.ts";
			}
			const runArgs = ["node", "cdd-ts", ...actualArgs];
			process.argv = runArgs;
			runFn(runArgs)
				.then(() => {
					console.log(
						`JAVY_FS_DUMP:${JSON.stringify(
							(globalThis as { __FsData?: unknown }).__FsData,
						)}`,
					);
				})
				.catch((err: unknown) => {
					console.error(err);
				});
		}
	} catch (e: unknown) {
		console.error("Failed to parse stdin:", e);
	}
}
