import { describe, expect, it } from "vitest";
import {
	assembleWasmBinary,
	collectNonZeroMemorySegments,
	compactJavyWasmInPlace,
	DEFAULT_JAVY_BYTECODE_CAP_OFFSET,
	DEFAULT_JAVY_BYTECODE_LEN_OFFSET,
	DEFAULT_JAVY_BYTECODE_PTR_OFFSET,
	DEFAULT_JAVY_DLMALLOC_TOP_OFFSET,
	DEFAULT_JAVY_HEAP_BASE_OFFSET,
	encodeWasmDataSection,
	encodeWasmMemorySection,
	extractWasmMemoryAndSections,
	graftJavyBytecode,
	optimizeWasmJsBundle,
	patchJavyPendingJobsCheck,
	readUnsignedLeb128,
	writeSignedLeb128,
	writeUnsignedLeb128,
} from "../../src/core/wasm-optimizer.js";

/**
 * Helper to construct a custom section payload with a given UTF-8 name and data bytes.
 */
function buildCustomSectionPayload(
	name: string,
	content: Uint8Array,
): Uint8Array {
	const nameBytes = new TextEncoder().encode(name);
	const lenBytes = writeUnsignedLeb128(nameBytes.length);
	const out = new Uint8Array(
		lenBytes.length + nameBytes.length + content.length,
	);
	out.set(lenBytes, 0);
	out.set(nameBytes, lenBytes.length);
	out.set(content, lenBytes.length + nameBytes.length);
	return out;
}

describe("wasm-optimizer", () => {
	describe("LEB128 encoding and decoding", () => {
		it("roundtrips unsigned LEB128 values across single-byte and multi-byte ranges", () => {
			for (const val of [0, 1, 63, 64, 127, 128, 255, 16384, 1214648]) {
				const encoded = writeUnsignedLeb128(val);
				const decoded = readUnsignedLeb128(encoded, 0);
				expect(decoded.value).toBe(val);
				expect(decoded.nextPos).toBe(encoded.length);
			}
		});

		it("handles truncated unsigned LEB128 buffers gracefully", () => {
			const truncated = new Uint8Array([0x80, 0x81]);
			const decoded = readUnsignedLeb128(truncated, 0);
			expect(decoded.nextPos).toBe(2);
			expect(decoded.value).toBe(128);
		});

		it("encodes signed LEB128 values for positive, sign-bit-set, and negative integers", () => {
			expect(Array.from(writeSignedLeb128(0))).toEqual([0x00]);
			expect(Array.from(writeSignedLeb128(63))).toEqual([0x3f]);
			// 64 has bit 6 (0x40) set, so signed LEB128 requires a trailing 0x00 sign-extension byte.
			expect(Array.from(writeSignedLeb128(64))).toEqual([0xc0, 0x00]);
			expect(Array.from(writeSignedLeb128(-1))).toEqual([0x7f]);
			expect(Array.from(writeSignedLeb128(-64))).toEqual([0x40]);
			expect(Array.from(writeSignedLeb128(-65))).toEqual([0xbf, 0x7f]);
		});
	});

	describe("Wasm section parsing, segment coalescing, and assembly", () => {
		it("extracts memory, filters javy_source custom sections, and preserves other sections", () => {
			const memSec = encodeWasmMemorySection(2);
			const dataSec = encodeWasmDataSection([
				{ offset: 100, payload: new Uint8Array([1, 2, 3]) },
				{ offset: 50, payload: new Uint8Array([9, 8]) },
			]);
			const javySourceCustom = buildCustomSectionPayload(
				"javy_source",
				new Uint8Array([0xde, 0xad]),
			);
			const producersCustom = buildCustomSectionPayload(
				"producers",
				new Uint8Array([0x01, 0x02]),
			);
			const codeSection = new Uint8Array([0x01, 0x02, 0x00, 0x0b]);

			const rawWasm = assembleWasmBinary(
				[
					{ id: 5, payload: memSec },
					{ id: 10, payload: codeSection },
					{ id: 11, payload: new Uint8Array(0) },
					{ id: 0, payload: javySourceCustom },
					{ id: 0, payload: producersCustom },
				],
				undefined,
				dataSec,
			);

			const snapshot = extractWasmMemoryAndSections(rawWasm, 1024);
			expect(snapshot.initialPages).toBe(2);
			expect(snapshot.maxEndOffset).toBe(103);
			expect(Array.from(snapshot.memory.subarray(50, 52))).toEqual([9, 8]);
			expect(Array.from(snapshot.memory.subarray(100, 103))).toEqual([1, 2, 3]);
			// javy_source is filtered out while producers custom section is kept
			expect(snapshot.sections.map((s) => s.id)).toEqual([5, 10, 11, 0]);
		});

		it("coalesces non-zero runs separated by <= maxZeroGap and splits runs > maxZeroGap", () => {
			const mem = new Uint8Array(100);
			mem[10] = 0xaa;
			mem[15] = 0xbb; // gap of 4 zeros (<= 16) -> coalesced
			mem[40] = 0xcc; // gap of 24 zeros (> 16) -> separate segment
			mem[99] = 0xdd; // right at the end of maxEndOffset

			const segments = collectNonZeroMemorySegments(mem, 100, 16);
			expect(segments.length).toBe(3);
			expect(segments[0]?.offset).toBe(10);
			expect(segments[0]?.payload.length).toBe(6);
			expect(segments[1]?.offset).toBe(40);
			expect(segments[1]?.payload.length).toBe(1);
			expect(segments[2]?.offset).toBe(99);
			expect(segments[2]?.payload.length).toBe(1);
		});
	});

	describe("patchJavyPendingJobsCheck", () => {
		it("replaces the Javy 3.0.1 has_pending_jobs instruction pattern in place", () => {
			const prefix = new Uint8Array([0x00, 0x01, 0x02]);
			const pattern = new Uint8Array([
				0x22, 0x00, 0x41, 0xa4, 0x01, 0x6a, 0x28, 0x02, 0x00, 0x20, 0x00, 0x41,
				0xa0, 0x01, 0x6a, 0x47,
			]);
			const suffix = new Uint8Array([0x0b]);
			const input = new Uint8Array(
				prefix.length + pattern.length + suffix.length,
			);
			input.set(prefix, 0);
			input.set(pattern, prefix.length);
			input.set(suffix, prefix.length + pattern.length);

			const patched = patchJavyPendingJobsCheck(input);
			expect(patched[prefix.length + 3]).toBe(0xa0);
			expect(patched[prefix.length + 15]).toBe(0x01);

			// Unmatched bytes remain unchanged
			const unchanged = patchJavyPendingJobsCheck(new Uint8Array([1, 2, 3, 4]));
			expect(Array.from(unchanged)).toEqual([1, 2, 3, 4]);
		});
	});

	describe("graftJavyBytecode and compactJavyWasmInPlace", () => {
		it("grafts compiled bytecode onto a clean Wizer snapshot and updates memory pages", () => {
			const capOffset = 64;
			const ptrOffset = 68;
			const lenOffset = 72;

			// Build simulated compiledWasm with bytecode [0x43, 0x01, 0x02, 0x03] at offset 200
			const compiledMem = new Uint8Array(512);
			const compiledView = new DataView(compiledMem.buffer);
			compiledView.setUint32(capOffset, 4, true);
			compiledView.setUint32(ptrOffset, 200, true);
			compiledView.setUint32(lenOffset, 4, true);
			compiledMem.set([0x43, 0x01, 0x02, 0x03], 200);

			const compiledWasm = assembleWasmBinary(
				[
					{ id: 5, payload: encodeWasmMemorySection(1) },
					{ id: 11, payload: new Uint8Array(0) },
				],
				undefined,
				encodeWasmDataSection(collectNonZeroMemorySegments(compiledMem, 256)),
			);

			// Build simulated cleanSnapshotWasm with 1 initial page and runtime data at offset 16
			const cleanMem = new Uint8Array(128);
			cleanMem.set([0xde, 0xad, 0xbe, 0xef], 16);
			const cleanWasm = assembleWasmBinary(
				[
					{ id: 5, payload: encodeWasmMemorySection(1) },
					{ id: 11, payload: new Uint8Array(0) },
				],
				undefined,
				encodeWasmDataSection(collectNonZeroMemorySegments(cleanMem, 128)),
			);

			const grafted = graftJavyBytecode(compiledWasm, cleanWasm, {
				bytecodeCapOffset: capOffset,
				bytecodePtrOffset: ptrOffset,
				bytecodeLenOffset: lenOffset,
			});

			const parsed = extractWasmMemoryAndSections(grafted, 256 * 1024);
			expect(parsed.initialPages).toBe(2);
			const parsedView = new DataView(parsed.memory.buffer);
			expect(parsedView.getUint32(capOffset, true)).toBe(0);
			expect(parsedView.getUint32(ptrOffset, true)).toBe(65536);
			expect(parsedView.getUint32(lenOffset, true)).toBe(4);
			expect(Array.from(parsed.memory.subarray(65536, 65540))).toEqual([
				0x43, 0x01, 0x02, 0x03,
			]);
		});

		it("uses default Javy 3.0.1 layout constants when layout config is omitted", () => {
			expect(DEFAULT_JAVY_BYTECODE_CAP_OFFSET).toBe(1214644);
			expect(DEFAULT_JAVY_BYTECODE_PTR_OFFSET).toBe(1214648);
			expect(DEFAULT_JAVY_BYTECODE_LEN_OFFSET).toBe(1214652);
			expect(DEFAULT_JAVY_DLMALLOC_TOP_OFFSET).toBe(1215104);
			expect(DEFAULT_JAVY_HEAP_BASE_OFFSET).toBe(1216680);

			// Verify default layout offsets with graftJavyBytecode
			const emptyWasm = assembleWasmBinary(
				[
					{ id: 5, payload: encodeWasmMemorySection(20) },
					{ id: 11, payload: new Uint8Array(0) },
				],
				undefined,
				encodeWasmDataSection([]),
			);
			const graftedDefault = graftJavyBytecode(emptyWasm, emptyWasm);
			expect(graftedDefault.byteLength).toBeGreaterThan(8);
		});

		it("compacts dlmalloc free chunks and top chunk in place", () => {
			const topOffset = 100;
			const heapBase = 200;
			const mem = new Uint8Array(1024);
			const view = new DataView(mem.buffer);

			// Chunk 1 at 200: FREE chunk of size 128 (head = 128 | 1 (pinuse=1, cinuse=0))
			view.setUint32(204, 128 | 1, true);
			// Fill free chunk header (208..232) and garbage payload (232..328)
			mem.fill(0x55, 208, 328);

			// Chunk 2 at 328: Small FREE chunk of size 24 (head = 24 | 0, <= 32 keep threshold)
			view.setUint32(332, 24, true);
			mem.fill(0x66, 336, 352);

			// Chunk 3 at 352: INUSE chunk of size 64 (head = 64 | 2 (cinuse=1))
			view.setUint32(356, 64 | 2, true);
			mem.fill(0x77, 360, 416);

			// Chunk 4 at 416: TOP chunk of size 128 (head = 128 | 1 (pinuse=1, cinuse=0))
			view.setUint32(topOffset, 416, true);
			view.setUint32(420, 128 | 1, true);
			mem.fill(0x88, 424, 544);

			const rawWasm = assembleWasmBinary(
				[
					{ id: 5, payload: encodeWasmMemorySection(1) },
					{ id: 11, payload: new Uint8Array(0) },
				],
				undefined,
				encodeWasmDataSection(collectNonZeroMemorySegments(mem, 600)),
			);

			const compacted = compactJavyWasmInPlace(rawWasm, {
				dlmallocTopOffset: topOffset,
				heapBaseOffset: heapBase,
			});
			const after = extractWasmMemoryAndSections(compacted, 1024);

			// Chunk 1 free treebin header (208..232) preserved, payload (232..328) zeroed
			expect(after.memory[208]).toBe(0x55);
			expect(after.memory[231]).toBe(0x55);
			expect(after.memory[232]).toBe(0x00);
			expect(after.memory[327]).toBe(0x00);

			// Chunk 2 small free chunk (<= 32) preserved
			expect(after.memory[336]).toBe(0x66);

			// Chunk 3 INUSE chunk preserved
			expect(after.memory[360]).toBe(0x77);
			expect(after.memory[415]).toBe(0x77);

			// Chunk 4 TOP chunk payload (424..544) zeroed
			expect(after.memory[424]).toBe(0x00);
			expect(after.memory[543]).toBe(0x00);

			// Also verify default layout fallback and chunkSize === 0 loop break when topChunkAddr > heapBase
			const defaultCompacted = compactJavyWasmInPlace(rawWasm);
			expect(defaultCompacted.byteLength).toBeGreaterThan(8);

			const zeroChunkCompacted = compactJavyWasmInPlace(rawWasm, {
				dlmallocTopOffset: topOffset,
				heapBaseOffset: 10,
			});
			expect(zeroChunkCompacted.byteLength).toBeGreaterThan(8);
		});
	});

	describe("optimizeWasmJsBundle", () => {
		it("prunes libFiles, ts.server, refactors, codefixes, Diagnostics, and unused TS functions", () => {
			const sampleBundle = [
				`const libFiles = [
	{
		fileName: "lib.d.ts",
		text: "declare var window: any;"
	}
];`,
				`		var ts_exports2 = {};
		var ts_server_exports4 = {};
		__export(ts_server_exports4, {
			updateProjectIfDirty: () => updateProjectIfDirty
		});`,
				`		var ts_refactor_exports = {};
		function someRefactor() {}
		var TokenEncodingConsts = {};`,
				`		var ts_BreakpointResolver_exports = {};
		function someCodefix() { return "${"x".repeat(1000)}"; }
		var ts_textChanges_exports = {};`,
				`		var Diagnostics = {
			Foo: diag(1, 1, "Foo", "Bar")
		};`,
				`		function createTypeChecker(host) {
			return { huge: true };
		}`,
				String.raw`const rx = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;`,
			].join(`
`);

			const result = optimizeWasmJsBundle(sampleBundle, {
				injectBanner: "globalThis.URL = MockURL;",
				useStripDirective: true,
			});

			expect(
				result.code.startsWith(`"use strip";
globalThis.URL = MockURL;
`),
			).toBe(true);
			expect(result.code).toContain("const libFiles = [];");
			expect(result.code).not.toContain("ts_exports2");
			expect(result.code).not.toContain("someRefactor");
			expect(result.code).not.toContain("someCodefix");
			expect(result.code).toContain("var ts_textChanges_exports = {};");
			expect(result.code).toContain("new Proxy({},");
			expect(result.code).toContain(
				"\t\tfunction createTypeChecker() { return {}; }",
			);
			expect(result.code).toContain(String.raw`[\da-z-]{0,31}`);
			expect(result.savedBytes).toBeGreaterThan(0);

			// Calling again with banner already present and useStripDirective: false does not duplicate
			const secondPass = optimizeWasmJsBundle(result.code, {
				injectBanner: "globalThis.URL = MockURL;",
				useStripDirective: false,
			});
			expect(secondPass.code).toBe(result.code);

			// Calling with default options omits banner and preserves existing "use strip"
			const thirdPass = optimizeWasmJsBundle(result.code);
			expect(thirdPass.code).toBe(result.code);
		});
	});
});
