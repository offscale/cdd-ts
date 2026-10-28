/**
 * WebAssembly (Javy QuickJS) bundle pruner and Wizer linear-memory snapshot optimizer.
 *
 * Reduces the Javy QuickJS `.wasm` binary from ~145 MB down to ~4.2 MB (~97% reduction) by:
 * 1. Stripping unused embedded TypeScript `lib.*.d.ts` declaration strings (`libFiles`) in `@ts-morph/common`.
 * 2. Pruning unused TypeScript compiler/IDE subsystems (`createTypeChecker`, `ts.server`, `codefix`, `refactor`,
 *    `Completions`, `FindAllReferences`, `GoToDefinition`, `InlayHints`, `Diagnostics` message catalogue, and
 *    downlevel ES transpilation transformers) while preserving AST parsing, manipulation, printing, and `ts.formatting`.
 * 3. Prepending QuickJS's `"use strip";` directive so function source strings are omitted from `JSFunctionBytecode`.
 * 4. Grafting the serialized QuickJS bytecode onto a clean Javy Wizer runtime snapshot (or zeroing freed `dlmalloc`
 *    heap chunks in place) and stripping the duplicate `javy_source` custom section.
 *
 * @module core/wasm-optimizer
 */

/**
 * Decoded LEB128 integer value and the byte offset immediately following it.
 */
export interface Leb128DecodeResult {
	/** Decoded unsigned integer value. */
	readonly value: number;
	/** Next byte index in the source buffer. */
	readonly nextPos: number;
}

/**
 * Raw WebAssembly binary section entry preserved during module reconstruction.
 */
export interface WasmSectionEntry {
	/** Numeric WebAssembly section ID (`0` = Custom, `5` = Memory, `11` = Data, etc.). */
	readonly id: number;
	/** Raw section payload bytes (excluding section ID and section length prefix). */
	readonly payload: Uint8Array;
}

/**
 * Contiguous non-zero linear memory slice to be emitted as an active WebAssembly Data segment.
 */
export interface WasmDataSegment {
	/** Linear memory byte offset where the segment begins. */
	readonly offset: number;
	/** Non-zero byte payload to initialize at `offset`. */
	readonly payload: Uint8Array;
}

/**
 * Parsed WebAssembly linear memory snapshot and section table extracted from a Wizer-initialized module.
 */
export interface ParsedWasmSnapshot {
	/** Reconstructed linear memory buffer populated from active Data segments. */
	readonly memory: Uint8Array;
	/** Highest linear memory byte address written by any active Data segment. */
	readonly maxEndOffset: number;
	/** Initial WebAssembly memory size in 64 KiB pages declared in the Memory section. */
	readonly initialPages: number;
	/** Ordered list of WebAssembly sections (with `javy_source` custom sections filtered out). */
	readonly sections: readonly WasmSectionEntry[];
}

/**
 * Static linear memory offsets used by Javy's QuickJS provider Wasm module.
 */
export interface JavyWasmLayoutConfig {
	/** Static memory address of the compiled bytecode `Vec<u8>` capacity field. */
	readonly bytecodeCapOffset?: number;
	/** Static memory address of the compiled bytecode `Vec<u8>` pointer field. */
	readonly bytecodePtrOffset?: number;
	/** Static memory address of the compiled bytecode `Vec<u8>` length field. */
	readonly bytecodeLenOffset?: number;
	/** Static memory address of `dlmalloc`'s `_gm_.top` chunk pointer. */
	readonly dlmallocTopOffset?: number;
	/** Linear memory address of the first `dlmalloc` heap chunk (`__heap_base`). */
	readonly heapBaseOffset?: number;
}

/**
 * Configuration options for `optimizeWasmJsBundle`.
 */
export interface WasmBundleOptimizeOptions {
	/** Optional runtime polyfill banner (e.g. `wasm-stubs/inject.js`) to prepend to the bundle. */
	readonly injectBanner?: string;
	/** Whether to prepend QuickJS's `"use strip";` directive to strip function source text from bytecode. */
	readonly useStripDirective?: boolean;
}

/**
 * Result of pruning and preparing a JavaScript bundle for Javy QuickJS compilation.
 */
export interface WasmBundleOptimizeResult {
	/** Optimized JavaScript source code ready for minification and Javy compilation. */
	readonly code: string;
	/** UTF-8 byte length of the input bundle before optimization. */
	readonly originalBytes: number;
	/** UTF-8 byte length of the optimized bundle. */
	readonly optimizedBytes: number;
	/** Total UTF-8 bytes saved by pruning unused compiler and library payloads. */
	readonly savedBytes: number;
}

/** Default static address of Javy 3.0.1's compiled bytecode `Vec<u8>` capacity field. */
export const DEFAULT_JAVY_BYTECODE_CAP_OFFSET = 1214644;

/** Default static address of Javy 3.0.1's compiled bytecode `Vec<u8>` pointer field. */
export const DEFAULT_JAVY_BYTECODE_PTR_OFFSET = 1214648;

/** Default static address of Javy 3.0.1's compiled bytecode `Vec<u8>` length field. */
export const DEFAULT_JAVY_BYTECODE_LEN_OFFSET = 1214652;

/** Default static address of `dlmalloc`'s `_gm_.top` pointer in Javy 3.0.1. */
export const DEFAULT_JAVY_DLMALLOC_TOP_OFFSET = 1215104;

/** Default linear memory start address of `dlmalloc` heap chunks in Javy 3.0.1. */
export const DEFAULT_JAVY_HEAP_BASE_OFFSET = 1216680;

/** WebAssembly page size in bytes (64 KiB). */
const WASM_PAGE_SIZE = 65536;

/** WebAssembly magic header and version 1 preamble (`\0asm\x01\x00\x00\x00`). */
const WASM_HEADER = new Uint8Array([
	0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
]);

/** Javy 3.0.1 `Runtime::has_pending_jobs` Wasm instruction sequence in `func[123]`. */
const JAVY_PENDING_JOBS_PATTERN = new Uint8Array([
	0x22, 0x00, 0x41, 0xa4, 0x01, 0x6a, 0x28, 0x02, 0x00, 0x20, 0x00, 0x41, 0xa0,
	0x01, 0x6a, 0x47,
]);

/** Replacement instruction sequence that evaluates `(&rt->job_list != &rt->job_list)` to `false` (0). */
const JAVY_PENDING_JOBS_REPLACEMENT = new Uint8Array([
	0x22, 0x00, 0x41, 0xa0, 0x01, 0x6a, 0x20, 0x00, 0x41, 0xa0, 0x01, 0x6a, 0x47,
	0x01, 0x01, 0x01,
]);

/** Unused TypeScript compiler and transpilation functions stubbed out for AST-only Wasm execution. */
const UNUSED_TS_FUNCTIONS: readonly string[] = [
	"createTypeChecker",
	"transformES2015",
	"transformClassFields",
	"transformESDecorators",
	"transformModule",
	"transformTypeScript",
	"transformDeclarations",
	"transformGenerators",
	"createSyntacticTypeNodeBuilder",
	"transformES2018",
	"transformSystemModule",
	"createWatchProgram",
	"transformES2017",
	"inferTypeFromReferences",
	"transformJsx",
];

/**
 * Decodes an unsigned LEB128 integer from a `Uint8Array` starting at `startPos`.
 *
 * @param data - Source byte buffer.
 * @param startPos - Starting byte offset.
 * @returns Decoded unsigned integer value and the next byte position.
 */
export function readUnsignedLeb128(
	data: Uint8Array,
	startPos: number,
): Leb128DecodeResult {
	let value = 0;
	let shift = 0;
	let pos = startPos;
	while (pos < data.length) {
		const byte = Number(data[pos]);
		pos += 1;
		value += (byte & 0x7f) * 2 ** shift;
		if ((byte & 0x80) === 0) {
			break;
		}
		shift += 7;
	}
	return { value, nextPos: pos };
}

/**
 * Encodes a non-negative integer as an unsigned LEB128 byte sequence.
 *
 * @param value - Non-negative integer to encode.
 * @returns Encoded unsigned LEB128 bytes.
 */
export function writeUnsignedLeb128(value: number): Uint8Array {
	const bytes: number[] = [];
	let remaining = Math.floor(Math.max(0, value));
	while (true) {
		const byte = remaining & 0x7f;
		remaining = Math.floor(remaining / 128);
		if (remaining === 0) {
			bytes.push(byte);
			break;
		}
		bytes.push(byte | 0x80);
	}
	return new Uint8Array(bytes);
}

/**
 * Encodes a 32-bit signed integer as a signed LEB128 byte sequence (used by `i32.const` in Wasm).
 *
 * @param value - Signed 32-bit integer to encode.
 * @returns Encoded signed LEB128 bytes.
 */
export function writeSignedLeb128(value: number): Uint8Array {
	const bytes: number[] = [];
	let remaining = value | 0;
	while (true) {
		const byte = remaining & 0x7f;
		remaining >>= 7;
		const signBitSet = (byte & 0x40) !== 0;
		if ((remaining === 0 && !signBitSet) || (remaining === -1 && signBitSet)) {
			bytes.push(byte);
			break;
		}
		bytes.push(byte | 0x80);
	}
	return new Uint8Array(bytes);
}

/**
 * Parses a WebAssembly binary, reconstructing its linear memory from active Data segments
 * and filtering out `javy_source` custom sections.
 *
 * @param wasmBytes - Raw `.wasm` binary bytes.
 * @param maxMemoryBytes - Maximum linear memory buffer capacity to allocate (defaults to 160 MiB).
 * @returns Parsed linear memory buffer, highest written offset, initial page count, and section list.
 */
export function extractWasmMemoryAndSections(
	wasmBytes: Uint8Array,
	maxMemoryBytes = 160 * 1024 * 1024,
): ParsedWasmSnapshot {
	const memory = new Uint8Array(maxMemoryBytes);
	const sections: WasmSectionEntry[] = [];
	let maxEndOffset = 0;
	let initialPages = 0;
	let pos = WASM_HEADER.length;

	while (pos < wasmBytes.length) {
		const sectionId = Number(wasmBytes[pos]);
		pos += 1;
		const { value: sectionSize, nextPos: payloadStart } = readUnsignedLeb128(
			wasmBytes,
			pos,
		);
		const sectionEnd = payloadStart + sectionSize;

		if (sectionId === 5) {
			const { nextPos: afterCount } = readUnsignedLeb128(
				wasmBytes,
				payloadStart,
			);
			const { nextPos: afterFlags } = readUnsignedLeb128(wasmBytes, afterCount);
			const { value: pages } = readUnsignedLeb128(wasmBytes, afterFlags);
			initialPages = pages;
			sections.push({
				id: sectionId,
				payload: wasmBytes.subarray(payloadStart, sectionEnd),
			});
		} else if (sectionId === 11) {
			const { value: segmentCount, nextPos: segCursorStart } =
				readUnsignedLeb128(wasmBytes, payloadStart);
			let cursor = segCursorStart;
			for (let i = 0; i < segmentCount; i++) {
				const { nextPos: afterFlags } = readUnsignedLeb128(wasmBytes, cursor);
				cursor = afterFlags + 1; // skip 0x41 (i32.const)
				const { value: offset, nextPos: afterOffset } = readUnsignedLeb128(
					wasmBytes,
					cursor,
				);
				cursor = afterOffset + 1; // skip 0x0b (end)
				const { value: segSize, nextPos: dataStart } = readUnsignedLeb128(
					wasmBytes,
					cursor,
				);
				memory.set(wasmBytes.subarray(dataStart, dataStart + segSize), offset);
				const segEnd = offset + segSize;
				if (segEnd > maxEndOffset) {
					maxEndOffset = segEnd;
				}
				cursor = dataStart + segSize;
			}
			sections.push({ id: sectionId, payload: new Uint8Array(0) });
		} else if (sectionId === 0) {
			const { value: nameLen, nextPos: nameStart } = readUnsignedLeb128(
				wasmBytes,
				payloadStart,
			);
			const sectionName = new TextDecoder().decode(
				wasmBytes.subarray(nameStart, nameStart + nameLen),
			);
			if (sectionName !== "javy_source") {
				sections.push({
					id: sectionId,
					payload: wasmBytes.subarray(payloadStart, sectionEnd),
				});
			}
		} else {
			sections.push({
				id: sectionId,
				payload: wasmBytes.subarray(payloadStart, sectionEnd),
			});
		}

		pos = sectionEnd;
	}

	return {
		memory,
		maxEndOffset,
		initialPages,
		sections,
	};
}

/**
 * Scans linear memory up to `maxEndOffset` and groups non-zero regions into active Data segments,
 * merging adjacent non-zero runs separated by at most `maxZeroGap` zero bytes.
 *
 * @param memory - Linear memory byte buffer.
 * @param maxEndOffset - Upper byte offset bound to scan.
 * @param maxZeroGap - Maximum consecutive zero bytes to coalesce inside a single segment (defaults to `16`).
 * @returns Array of coalesced non-zero `WasmDataSegment` entries.
 */
export function collectNonZeroMemorySegments(
	memory: Uint8Array,
	maxEndOffset: number,
	maxZeroGap = 16,
): WasmDataSegment[] {
	const segments: WasmDataSegment[] = [];
	const limit = Math.min(memory.length, maxEndOffset);
	let i = 0;

	while (i < limit) {
		if (memory[i] === 0) {
			i += 1;
			continue;
		}
		const segStart = i;
		let lastNonZero = i;
		let zeroRun = 0;
		i += 1;
		while (i < limit) {
			if (memory[i] !== 0) {
				lastNonZero = i;
				zeroRun = 0;
			} else {
				zeroRun += 1;
				if (zeroRun > maxZeroGap) {
					break;
				}
			}
			i += 1;
		}
		segments.push({
			offset: segStart,
			payload: memory.slice(segStart, lastNonZero + 1),
		});
	}

	return segments;
}

/**
 * Encodes an array of active `WasmDataSegment` entries into a WebAssembly Data section payload.
 *
 * @param segments - Active data segments to encode.
 * @returns Encoded Data section payload bytes.
 */
export function encodeWasmDataSection(
	segments: readonly WasmDataSegment[],
): Uint8Array {
	const countBytes = writeUnsignedLeb128(segments.length);
	const chunks: Uint8Array[] = [countBytes];
	let totalLen = countBytes.length;

	for (const seg of segments) {
		const offsetBytes = writeSignedLeb128(seg.offset);
		const lenBytes = writeUnsignedLeb128(seg.payload.length);
		const header = new Uint8Array(2 + offsetBytes.length + 1 + lenBytes.length);
		header[0] = 0x00; // active segment flags (memory 0)
		header[1] = 0x41; // i32.const
		header.set(offsetBytes, 2);
		header[2 + offsetBytes.length] = 0x0b; // end
		header.set(lenBytes, 3 + offsetBytes.length);

		chunks.push(header, seg.payload);
		totalLen += header.length + seg.payload.length;
	}

	const result = new Uint8Array(totalLen);
	let cursor = 0;
	for (const chunk of chunks) {
		result.set(chunk, cursor);
		cursor += chunk.length;
	}
	return result;
}

/**
 * Encodes a single-memory WebAssembly Memory section payload with the specified initial page count.
 *
 * @param initialPages - Initial memory size in 64 KiB pages.
 * @returns Encoded Memory section payload bytes.
 */
export function encodeWasmMemorySection(initialPages: number): Uint8Array {
	const pageBytes = writeUnsignedLeb128(initialPages);
	const out = new Uint8Array(2 + pageBytes.length);
	out[0] = 0x01; // 1 memory entry
	out[1] = 0x00; // flags = 0 (no maximum page limit)
	out.set(pageBytes, 2);
	return out;
}

/**
 * Assembles a complete `.wasm` binary from section entries, substituting updated Memory and Data sections.
 *
 * @param sections - Ordered WebAssembly section entries.
 * @param memorySectionPayload - Optional replacement Memory section payload (`id === 5`).
 * @param dataSectionPayload - Replacement Data section payload (`id === 11`).
 * @returns Assembled WebAssembly binary byte buffer.
 */
export function assembleWasmBinary(
	sections: readonly WasmSectionEntry[],
	memorySectionPayload: Uint8Array | undefined,
	dataSectionPayload: Uint8Array,
): Uint8Array {
	const parts: Uint8Array[] = [WASM_HEADER];
	let totalLength = WASM_HEADER.length;

	for (const sec of sections) {
		const payload =
			sec.id === 5 && memorySectionPayload !== undefined
				? memorySectionPayload
				: sec.id === 11
					? dataSectionPayload
					: sec.payload;
		const sizeBytes = writeUnsignedLeb128(payload.length);
		const secHeader = new Uint8Array(1 + sizeBytes.length);
		secHeader[0] = sec.id;
		secHeader.set(sizeBytes, 1);

		parts.push(secHeader, payload);
		totalLength += secHeader.length + payload.length;
	}

	const output = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		output.set(part, offset);
		offset += part.length;
	}
	return output;
}

/**
 * Patches Javy 3.0.1's post-execution `Runtime::has_pending_jobs` check in the Code section so
 * resolved `async` CLI promises do not trigger a `Pending jobs in the event queue` panic on exit.
 *
 * @param wasmBytes - Assembled `.wasm` binary bytes.
 * @returns Copy of `wasmBytes` with the `has_pending_jobs` check neutralized.
 */
export function patchJavyPendingJobsCheck(wasmBytes: Uint8Array): Uint8Array {
	const out = wasmBytes.slice();
	const patLen = JAVY_PENDING_JOBS_PATTERN.length;
	const limit = out.length - patLen;

	for (let i = 0; i <= limit; i++) {
		let matched = true;
		for (let j = 0; j < patLen; j++) {
			if (out[i + j] !== JAVY_PENDING_JOBS_PATTERN[j]) {
				matched = false;
				break;
			}
		}
		if (matched) {
			out.set(JAVY_PENDING_JOBS_REPLACEMENT, i);
			i += patLen - 1;
		}
	}

	return out;
}

/**
 * Grafts the serialized QuickJS bytecode from a Javy-compiled `.wasm` binary onto a clean
 * Wizer runtime snapshot (compiled from an empty JS file), eliminating all unzeroed `dlmalloc`
 * reallocations and duplicate `ctx->loaded_modules` AST/bytecode heap objects.
 *
 * @param compiledWasm - Javy `.wasm` binary compiled from the application JS bundle.
 * @param cleanSnapshotWasm - Javy `.wasm` binary compiled from an empty JS file.
 * @param layout - Optional static linear-memory offset overrides.
 * @returns Compacted `.wasm` binary containing only the clean runtime and serialized bytecode.
 */
export function graftJavyBytecode(
	compiledWasm: Uint8Array,
	cleanSnapshotWasm: Uint8Array,
	layout: JavyWasmLayoutConfig = {},
): Uint8Array {
	const capOffset =
		layout.bytecodeCapOffset ?? DEFAULT_JAVY_BYTECODE_CAP_OFFSET;
	const ptrOffset =
		layout.bytecodePtrOffset ?? DEFAULT_JAVY_BYTECODE_PTR_OFFSET;
	const lenOffset =
		layout.bytecodeLenOffset ?? DEFAULT_JAVY_BYTECODE_LEN_OFFSET;

	const compiledSnapshot = extractWasmMemoryAndSections(compiledWasm);
	const compiledView = new DataView(
		compiledSnapshot.memory.buffer,
		compiledSnapshot.memory.byteOffset,
		compiledSnapshot.memory.byteLength,
	);
	const bcPtr = compiledView.getUint32(ptrOffset, true);
	const bcLen = compiledView.getUint32(lenOffset, true);
	const bytecode = compiledSnapshot.memory.slice(bcPtr, bcPtr + bcLen);

	const requiredBytes = Math.max(32 * 1024 * 1024, bcLen + 4 * 1024 * 1024);
	const cleanSnapshot = extractWasmMemoryAndSections(
		cleanSnapshotWasm,
		requiredBytes,
	);
	const newBcPtr = cleanSnapshot.initialPages * WASM_PAGE_SIZE;
	cleanSnapshot.memory.set(bytecode, newBcPtr);

	const cleanView = new DataView(
		cleanSnapshot.memory.buffer,
		cleanSnapshot.memory.byteOffset,
		cleanSnapshot.memory.byteLength,
	);
	// Setting capacity = 0 marks the Option<Vec<u8>> as Some(...) while skipping free(ptr) on exit.
	cleanView.setUint32(capOffset, 0, true);
	cleanView.setUint32(ptrOffset, newBcPtr, true);
	cleanView.setUint32(lenOffset, bcLen, true);

	const newInitialPages =
		cleanSnapshot.initialPages + Math.ceil(bcLen / WASM_PAGE_SIZE);
	const maxEndOffset = Math.max(cleanSnapshot.maxEndOffset, newBcPtr + bcLen);
	const segments = collectNonZeroMemorySegments(
		cleanSnapshot.memory,
		maxEndOffset,
	);
	const dataSection = encodeWasmDataSection(segments);
	const memorySection = encodeWasmMemorySection(newInitialPages);
	const assembled = assembleWasmBinary(
		cleanSnapshot.sections,
		memorySection,
		dataSection,
	);

	return patchJavyPendingJobsCheck(assembled);
}

/**
 * Compacts a Javy-compiled `.wasm` binary in place by walking its `dlmalloc` heap,
 * zeroing the unallocated payload bytes of all free chunks (`(head & 2) === 0`),
 * stripping `javy_source`, and re-encoding only non-zero Data segments.
 *
 * @param compiledWasm - Javy `.wasm` binary to compact in place.
 * @param layout - Optional static linear-memory offset overrides.
 * @returns Compacted `.wasm` binary.
 */
export function compactJavyWasmInPlace(
	compiledWasm: Uint8Array,
	layout: JavyWasmLayoutConfig = {},
): Uint8Array {
	const topOffset =
		layout.dlmallocTopOffset ?? DEFAULT_JAVY_DLMALLOC_TOP_OFFSET;
	const heapBase = layout.heapBaseOffset ?? DEFAULT_JAVY_HEAP_BASE_OFFSET;

	const snapshot = extractWasmMemoryAndSections(compiledWasm);
	const view = new DataView(
		snapshot.memory.buffer,
		snapshot.memory.byteOffset,
		snapshot.memory.byteLength,
	);
	const topChunkAddr = view.getUint32(topOffset, true);

	let curr = heapBase;
	while (curr <= topChunkAddr && curr + 8 <= snapshot.memory.length) {
		const head = view.getUint32(curr + 4, true);
		const chunkSize = head & ~7;
		if (chunkSize === 0) {
			break;
		}
		const cinuse = (head & 2) !== 0;
		if (!cinuse) {
			const headerKeep = curr === topChunkAddr ? 8 : 32;
			if (chunkSize > headerKeep) {
				snapshot.memory.fill(0, curr + headerKeep, curr + chunkSize);
			}
		}
		curr += chunkSize;
	}

	const segments = collectNonZeroMemorySegments(
		snapshot.memory,
		snapshot.maxEndOffset,
	);
	const dataSection = encodeWasmDataSection(segments);
	const assembled = assembleWasmBinary(
		snapshot.sections,
		undefined,
		dataSection,
	);

	return patchJavyPendingJobsCheck(assembled);
}

/**
 * Prunes dead TypeScript compiler/IDE subsystems and embedded `.d.ts` libraries from a bundled
 * `cdd-ts` JavaScript file and applies QuickJS compatibility transforms.
 *
 * @param code - Raw bundled JavaScript code emitted by `rolldown`.
 * @param options - Optional banner and QuickJS directive configuration.
 * @returns Optimized JavaScript source and byte-saving metrics.
 */
export function optimizeWasmJsBundle(
	code: string,
	options: WasmBundleOptimizeOptions = {},
): WasmBundleOptimizeResult {
	const originalBytes = Buffer.byteLength(code, "utf8");
	let result = code;

	// 1. Strip embedded TypeScript lib.*.d.ts virtual file strings in @ts-morph/common (~2.90 MB).
	result = result.replace(
		/const libFiles = \[\s*\{[\s\S]*?\}\s*\];/,
		"const libFiles = [];",
	);

	// 2. Strip TypeScript ts.server namespace and IDE editor protocol classes (~589 KB).
	result = result.replace(
		/\t\tvar ts_exports2 = \{\};[\s\S]*?var ts_server_exports4 = \{\};[\s\S]*?updateProjectIfDirty: \(\) => updateProjectIfDirty\s*\}\);/,
		"\t\tvar ts_server_exports4 = {};",
	);

	// 3. Strip TypeScript IDE refactoring providers (~207 KB).
	result = result.replace(
		/\t\tvar ts_refactor_exports = \{\};[\s\S]*?(?=\t\tvar TokenEncodingConsts =)/,
		`\t\tvar ts_refactor_exports = {};
`,
	);

	// 4. Strip TypeScript IDE codefixes, completions, find-all-references, and navigation services (~964 KB),
	//    stopping right before ts_textChanges_exports and ts_formatting_exports which power sourceFile.formatText().
	result = result.replace(
		/\t\tvar ts_BreakpointResolver_exports = \{\};[\s\S]*?(?=\t\tvar ts_textChanges_exports = \{\};)/,
		`\t\tvar ts_BreakpointResolver_exports = {}, ts_CallHierarchy_exports = {}, ts_classifier_exports = {}, ts_classifier_v2020_exports = {}, ts_codefix_exports = {}, ts_Completions_exports = {}, ts_Completions_StringCompletions_exports = {}, ts_FindAllReferences_exports = {}, ts_GoToDefinition_exports = {}, ts_InlayHints_exports = {}, ts_JsDoc_exports = {}, ts_MapCode_exports = {}, ts_OrganizeImports_exports = {}, ts_OutliningElementsCollector_exports = {}, ts_Rename_exports = {}, ts_SignatureHelp_exports = {}, ts_SmartSelectionRange_exports = {}, ts_SymbolDisplay_exports = {};
`,
	);

	// 5. Replace the 500 KB TypeScript Diagnostics message map with a lightweight on-demand Proxy (~478 KB).
	result = result.replace(
		/^\t\tvar Diagnostics = \{[\s\S]*?^\t\t\};/m,
		"\t\tvar Diagnostics = new Proxy({}, { get: (_, k) => diag(0, 1, String(k), String(k)) });",
	);

	// 6. Stub unused TypeScript type-checker and downlevel ES transpilation transformers (~2.39 MB).
	for (const fnName of UNUSED_TS_FUNCTIONS) {
		const fnRegex = new RegExp(
			String.raw`^\t\tfunction ${fnName}\([^)]*\) \{[\s\S]*?^\t\t\}`,
			"m",
		);
		result = result.replace(fnRegex, `\t\tfunction ${fnName}() { return {}; }`);
	}

	// 7. Rewrite URI/domain character-class hyphen escapes for QuickJS RegExp parser compatibility.
	result = result
		.split(
			String.raw`const isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);`,
		)
		.join(
			String.raw`const isUnreserved = RegExp.prototype.test.bind(/^[\da-z._~-]$/iu);`,
		)
		.split(
			String.raw`const isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);`,
		)
		.join(
			String.raw`const isPathCharacter = RegExp.prototype.test.bind(/^[\da-z._~!$&'()*+,;=:@/-]$/iu);`,
		)
		.split(
			String.raw`const isPathCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/]$/u);`,
		)
		.join(
			"const isPathCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9._~!$&'()*+,;=:@/-]$/u);",
		)
		.split(
			String.raw`const isQueryFragmentCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/?]$/u);`,
		)
		.join(
			"const isQueryFragmentCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9._~!$&'()*+,;=:@/?-]$/u);",
		)
		.split(
			String.raw`const isUserinfoCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:]$/u);`,
		)
		.join(
			"const isUserinfoCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9._~!$&'()*+,;=:-]$/u);",
		)
		.split(
			"const nonSimpleDomain = RegExp.prototype.test.bind(/[^!\"$&'()*+,\\-.;=_`a-z{}~]/u);",
		)
		.join(
			"const nonSimpleDomain = RegExp.prototype.test.bind(/[^!\"$&'()*+,-.;=_`a-z{}~]/u);",
		)
		.split(
			String.raw`/([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu`,
		)
		.join(
			String.raw`/([\da-z][\da-z-]{0,31}):((?:[\w!$'()*+,-.:;=@]|%[\da-f]{2})+)/iu`,
		)
		.split(
			String.raw`/^([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-./:;=@]|%[\da-f]{2})+)$/iu`,
		)
		.join(
			String.raw`/^([\da-z][\da-z-]{0,31}):((?:[\w!$'()*+,-./:;=@]|%[\da-f]{2})+)$/iu`,
		)
		.split("import.meta.url")
		.join('"file:///cli.js"');

	// 8. Prepend optional runtime polyfill banner and QuickJS "use strip" directive.
	const useStrip = options.useStripDirective ?? true;
	const banner = options.injectBanner?.trim() ?? "";
	if (banner.length > 0 && !result.includes("globalThis.URL = MockURL")) {
		result = `${banner}
${result}`;
	}
	if (useStrip && !result.startsWith('"use strip";')) {
		result = `"use strip";
${result}`;
	}

	const optimizedBytes = Buffer.byteLength(result, "utf8");
	return {
		code: result,
		originalBytes,
		optimizedBytes,
		savedBytes: originalBytes - optimizedBytes,
	};
}
