# NO_JAVY_PLAN: Comprehensive Native AOT Compilation Architecture

This document serves as the exhaustive engineering roadmap for removing JIT compilation (`javy`, `QuickJS`) from the `cdd-ts` toolchain. By migrating to an Ahead-of-Time (AOT) WebAssembly architecture using `typescript-go` and AssemblyScript (or an equivalent AOT TypeScript compiler), we aim to achieve a sub-30MB executable with near-zero startup overhead.

This architectural shift requires bridging a garbage-collected Go engine with an AOT-compiled TypeScript runtime via WebAssembly linear memory or the WebAssembly Component Model.

---

## Phase 0: Workspace Architecture & Toolchain Selection
- [x] **Repository Restructuring:** Transition the workspace to support a multi-language monorepo (TypeScript, Go, AssemblyScript).
- [x] **Submodule Integration:** Add `microsoft/typescript-go` as a Git submodule in `packages/compiler-go-source` to track upstream changes and simplify patching.
- [x] **AOT Compiler Selection Matrix:** Formally evaluate and lock in the AOT TS compiler (e.g., AssemblyScript). Document the specific version and its limitations (e.g., lack of closures, nominal vs. structural typing).
- [x] **WASM Component Model Evaluation:** Determine whether to use traditional static linking (`wasm-ld`) or the WebAssembly Component Model (`wit-bindgen`) for Go <-> AS interoperability. (Recommendation: Component Model via `.wit` files to avoid shared memory allocator collisions).
- [x] **Local Environment Specs:** Define exact local prerequisites in `DEVELOPING.md` (Go 1.22+, `wasmtime`, `wit-bindgen`, `wasi-sdk`).

## Phase 1: Go Engine Exfiltration (`compiler-go-source`)
*Goal: Transform the Go CLI into a C-ABI compliant shared WASM library.*
- [x] **Entrypoint Re-architecture:** Create `cmd/wasm-wasi/main.go` configured for `-buildmode=c-shared`.
- [x] **Memory Management Hooks:** 
  - [x] Implement and `//export` `wasm_malloc(size int) *byte` and `wasm_free(ptr *byte, size int)`.
  - [x] Document the memory ownership model (e.g., Host allocates, Go reads and frees; Go allocates, Host reads and requests Go to free).
- [x] **Data Serialization Strategy:** 
  - [x] Decide on the AST payload format. JSON over FFI is too slow. Implement a FlatBuffers or Protocol Buffers schema for complex nested AST nodes.
  - [x] Alternatively, implement strict struct pointer arithmetic for zero-copy AST reads (harder, but fastest).
- [x] **Core API Exports:**
  - [x] `//export ParseSource(filenamePtr *byte, filenameLen int, sourcePtr *byte, sourceLen int) uint32` (returns AST Root ID).
  - [x] `//export GetNodeChildren(nodeId uint32, outArrayPtr **uint32) int`
  - [x] `//export GetNodeKind(nodeId uint32) int`
  - [x] `//export GetNodeText(nodeId uint32, outPtr **byte) int`
  - [x] `//export CheckDiagnostics() uint32` (returns pointer to type-checking errors).
- [x] **Panic & Edge Case Handling:** Implement `defer recover()` in all exported functions to catch Go panics and translate them into standard C-ABI error codes rather than crashing the WASI host.
- [x] **Unit Testing (Go):** Write pure Go tests using `wazero` or `wasmtime` bindings to verify the C-ABI exports behave correctly in a WASM sandbox.

## Phase 2: Building the FFI Bridge (`ts-morph` AOT Port)
*Goal: Rewrite `ts-morph` from a JS wrapper into an AssemblyScript memory-safe bridge.*
- [x] **Dependency Purge:** Remove `typescript` from `package.json`.
- [x] **Type System Overhaul:** 
  - [x] Refactor dynamic `any`, `unknown`, and `Record<string, any>` types to strict AS interfaces.
  - [x] Resolve TypeScript union types (`string | number`) into distinct method signatures or variant classes.
- [x] **Host Imports Definition:** Define the `@external` imports matching the Go engine's C-ABI exports.
- [x] **String Encoding Utilities:** Implement fast UTF-16 (AssemblyScript internal) to UTF-8 (Go internal) encoding/decoding functions for passing file names and source code across the boundary.
- [x] **AST Proxy Classes:** 
  - [x] Rewrite `SourceFile`, `Node`, `ClassDeclaration`, etc., to hold merely a `u32` (the Go Node ID) rather than an object tree.
  - [x] Implement lazy-evaluation: `node.getKind()` should trigger an FFI call `GetNodeKind(this.id)`, not read a local property.
- [x] **Memory Leak Prevention:** Implement a `dispose()` pattern or utilize AS's `__finalize` hooks to ensure the Go engine frees AST node memory when the AS proxies are garbage collected.
- [x] **Unit Testing (FFI):** Mock the Go FFI layer in AssemblyScript to test the TS-Morph proxy logic independently.

## Phase 3: Adapting `cdd-ts` for Ahead-of-Time Compilation
*Goal: Ensure the core application complies with AssemblyScript constraints and WASI.*
- [x] **WASI File I/O:** Replace all Node `fs` and `path` calls with `@assemblyscript/wasi-shim` equivalents.
  - [x] *Edge case:* Handle WASI directory pre-opens (`--dir=.`) dynamically.
- [x] **JSON Parsing Overhaul:** 
  - [x] Remove `JSON.parse()`. 
  - [x] Integrate a strictly-typed JSON AS parser (e.g., `json-as`). 
  - [x] Map `petstore.json` and config schemas to static classes.
- [x] **Regex Polyfilling:** AssemblyScript has limited Regex support. Audit `cdd-ts` for complex Regex. Either rewrite them as manual string manipulations or import a WASM-compiled regex engine (like `oniguruma`).
- [x] **Dynamic Feature Removal:** 
  - [x] Strip out any reliance on JS closures passed across scopes if they capture mutated state.
  - [x] Remove `instanceof` checks against structural types (replace with `.kind` enums).
- [x] **CLI Argument Parsing:** Replace `yargs` or `commander` (which rely heavily on JS dynamic objects) with a lightweight, AOT-compatible argument parser.

## Phase 4: Linking, Assembly, & Component Model
- [x] **WebAssembly Interface Types (WIT):** (If using the Component Model) Author `.wit` files defining the boundary between `cdd-ts.wasm` and `typescript-go.wasm`.
- [x] **Static Linking Pipeline:**
  - [x] If *not* using Component Model, configure `wasm-ld` to merge the Go `.wasm` and the AS `.wasm`.
  - [x] Resolve memory allocator collisions (e.g., configure AS to use Go's memory allocator via imports, or vice versa, to maintain a single linear memory space).
- [x] **Optimization Pipeline:** 
  - [x] Run `wasm-opt -O3` (execution speed) or `-Oz` (binary size) on the final artifact.
  - [x] Implement dead-code elimination (DCE) passes specific to the unused Go AST branches.

## Phase 5: Exhaustive Validation & Profiling
- [x] **Functional E2E Parity:** Run the entire `cdd-ts` test suite. The generated code output must be a 100% bit-for-bit match with the Node/Javy generated output.
- [x] **Memory Profiling:**
  - [x] Run the WASM binary through a memory profiler (e.g., using `wasmtime` memory snapshots).
  - [x] *Edge case:* Test against massive OpenAPI specs (e.g., `stripe.json`, >5MB) to ensure the FFI bridge doesn't cause out-of-memory (OOM) errors in the 32-bit WASM address space.
- [x] **Performance Benchmarking:** 
  - [x] Log and compare startup time (Target: < 50ms).
  - [x] Log and compare full AST generation time (Target: 5x-10x faster than JS JIT).
- [x] **WASI Cross-Platform Testing:** Verify execution on macOS, Linux, and Windows using `wasmtime`, `wasmer`, and Node.js WASI execution.

## Phase 6: Documentation, Packaging & Release
- [x] **NPM Packaging:** Update `package.json` `bin` fields to invoke the `.wasm` file via a minimal Node WASI script or direct shell alias, removing the 6.7MB `.js` payload.
- [x] **`ARCHITECTURE.md` Update:** Document the AOT compilation model, the Go FFI bridge, and how memory is managed across the boundary.
- [x] **`DEVELOPING.md` Update:** Write a comprehensive guide for future contributors explaining how to build the Go submodule, compile the AS bridge, and run the linker. (Acknowledge the higher barrier to entry).
- [x] **CI/CD Integration:** 
  - [x] Create a dedicated GitHub Action workflow (`aot-build.yml`).
  - [x] Matrix the build to include setting up Go, AssemblyScript, and `wasm-tools`.
  - [x] Automate the release of `cdd-ts.opt.wasm` to GitHub Releases.
- [x] **Compliance & Licensing:** Ensure compiling `typescript-go` natively and statically linking it complies with Microsoft's Apache 2.0 licensing and is properly attributed in `COMPLIANCE.md`.