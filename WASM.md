# WASM Support

The `cdd-ts` compiler is written in TypeScript and runs on Node.js as well as WebAssembly (`WASM`/`WASI`).

## WebAssembly Compilation Modes

### 1. Browser JS Bundle + Javy QuickJS WASM (`make build_wasm`)

We produce a self-contained, browser-compatible JavaScript bundle using `rolldown` and `esbuild` with virtualized Node.js filesystem and path polyfills (`wasm-stubs/`, `createJavyFsPolyfill()`, and `optimizeWasmJsBundle()`). Then, using [Javy](https://github.com/bytecodealliance/javy) and `graftJavyBytecode()`, we compile that JavaScript payload and the QuickJS runtime together into a compact standalone WebAssembly (`.wasm`) module:

```bash
make build_wasm
```

This produces both the browser-ready bundle (`bin/cdd-ts.js`, ~3.2 MB minified) and the standalone WASI binary (`bin/cdd-ts-javy.wasm`, ~4.2 MB).

#### Binary Size Optimization Pipeline (`src/core/wasm-optimizer.ts`)

An unoptimized `javy compile` build of the raw `ts-morph` + TypeScript bundle produces a **145 MB** `.wasm` file (`14.34 MB` JS bundle -> `141.25 MB` Wasm `Data` section + `1.78 MB` `javy_source` custom section). `src/core/wasm-optimizer.ts` and `scripts/fix-bundle.cjs` apply a 5-stage optimization pipeline that reduces `cdd-ts-javy.wasm` from **145 MB** to **~4.2 MB** (**97.1% reduction**):

1. **Strip Embedded TypeScript `.d.ts` Libraries (`libFiles`)**: Removes the ~2.90 MB of embedded DOM, WebWorker, and ES `lib.*.d.ts` strings in `@ts-morph/common` that are unused by AST parsing and code emission.
2. **Prune Unused TypeScript Compiler & IDE Subsystems**: Strips `ts.server` (~589 KB), IDE `codefix` / `Completions` / `FindAllReferences` / navigation services (~964 KB), `refactor` providers (~207 KB), the 500 KB `Diagnostics` localized message catalogue (replaced with a lightweight `Proxy`), and `createTypeChecker` + downlevel ES transpilation transformers (~2.39 MB), while preserving `ts.createSourceFile`, `ts.createPrinter`, `ts-morph` AST manipulation, and `ts.formatting` (`sourceFile.formatText()`).
3. **ES2020 Minification & QuickJS `"use strip";` Directive**: Minifies the pruned bundle via `esbuild` (`14.34 MB` -> `3.2 MB`) and prepends QuickJS's `"use strip";` directive so QuickJS omits per-function `.toString()` source text buffers from compiled `JSFunctionBytecode` structs.
4. **Clean Wizer Snapshot Bytecode Grafting (`graftJavyBytecode`)**: During `javy compile` (`wizer.initialize`), Rust's growing `stdin` `Vec<u8>` reallocations, QuickJS's temporary AST parser allocations (~100 MB of freed `dlmalloc` chunks that remain non-zero in linear memory), and a duplicate `JSModuleDef` retained in `ctx->loaded_modules` (~9 MB) are snapshotted into the Wasm `Data` section. `graftJavyBytecode()` extracts the self-contained serialized QuickJS bytecode (`~3.04 MB`) from the compiled module and grafts it onto a clean 21-page Javy Wizer runtime snapshot while stripping the redundant `javy_source` custom section.
5. **Post-Compaction `wasm-opt -Oz` & Pending-Job Neutralization**: Neutralizes Javy 3.0.1's post-execution `has_pending_jobs` trap so resolved `async` CLI promises exit cleanly with status `0`, and runs `wasm-opt -Oz --strip-debug --strip-producers --strip-target-features` when Binaryen is installed.

### 2. TypeScript-Go + AssemblyScript AOT WASM (`make build_with_ts_go_assemblyscript`)

For ahead-of-time WASI compilation, `cdd-ts` also supports building the `typescript-go` (`GOOS=wasip1 GOARCH=wasm`) compiler backend alongside the AssemblyScript bridge (`ts-morph-as/`):

```bash
make build_with_ts_go_assemblyscript
```

This emits `bin/typescript-go.wasm` and `bin/cdd-ts.wasm` for high-performance WASI execution.
