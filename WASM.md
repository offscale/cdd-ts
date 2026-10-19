# WASM Support

The `cdd-ts` compiler is written in TypeScript and runs on Node.js as well as WebAssembly (`WASM`/`WASI`).

## WebAssembly Compilation Modes

### 1. Browser JS Bundle + Javy QuickJS WASM (`make build_wasm`)

We produce a self-contained, browser-compatible JavaScript bundle using `rolldown` / `esbuild` with virtualized Node.js filesystem and path polyfills (`wasm-stubs/` and `createJavyFsPolyfill()`). Then, using [Javy](https://github.com/bytecodealliance/javy), we compile that JavaScript payload and the QuickJS runtime together into a standalone WebAssembly (`.wasm`) module:

```bash
make build_wasm
```

This produces both the browser-ready bundle (`bin/cdd-ts.js`) and the standalone WASI binary (`bin/cdd-ts-javy.wasm`).

### 2. TypeScript-Go + AssemblyScript AOT WASM (`make build_with_ts_go_assemblyscript`)

For ahead-of-time WASI compilation, `cdd-ts` also supports building the `typescript-go` (`GOOS=wasip1 GOARCH=wasm`) compiler backend alongside the AssemblyScript bridge (`ts-morph-as/`):

```bash
make build_with_ts_go_assemblyscript
```

This emits `bin/typescript-go.wasm` and `bin/cdd-ts.wasm` for high-performance WASI execution.
