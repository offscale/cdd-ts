# cdd-ts

[![License](https://img.shields.io/badge/license-Apache--2.0%20OR%20MIT-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![interactive WASM web demo](https://img.shields.io/badge/interactive-WASM_web_demo-blue.svg)](https://offscale.io/wasm_web_demo)
[![CI](https://github.com/offscale/cdd-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/offscale/cdd-ts/actions)
<!-- TEST_COVERAGE_START -->
![TEST_COVERAGE](https://img.shields.io/badge/Test%20Coverage-0%25-red)
<!-- TEST_COVERAGE_END -->
<!-- DOC_COVERAGE_START -->
![DOC_COVERAGE](https://img.shields.io/badge/Doc%20Coverage-100%25-brightgreen)
<!-- DOC_COVERAGE_END -->

---

OpenAPI ↔ TypeScript. This is one compiler in a suite, supporting clients and frontends (Angular; React; Vue; vanilla JS; Node.js; Fetch; Axios); backends (Express and TypeORM), all focussed on the same task: Compiler Driven Development (CDD).

Each compiler is written in its target language, is whitespace and comment sensitive, and has both an SDK and CLI.

The core philosophy of Compiler Driven Development (CDD) is synchronization without compromise. Where traditional generators silo your API boundaries into read-only files, this compiler natively merges changes into your codebase via a robust, [whitespace and comment aware] Abstract Syntax Tree (AST) driven parser & emitter. It bridges the gap between design and implementation, allowing you to seamlessly generate SDKs from a spec or extract a spec from existing code. By keeping your APIs, SDKs, and tests in continuous, automated alignment, it drastically improves both delivery speed and software reliability.

The CLI—at a minimum—has:

- `cdd-ts --help`
- `cdd-ts --version`
- `cdd-ts from_openapi to_sdk_cli --mcp -i spec.json`
- `cdd-ts from_openapi to_sdk -i spec.json`
- `cdd-ts from_openapi to_server -i spec.json`
- `cdd-ts to_openapi -f path/to/code`
- `cdd-ts to_docs_json --no-imports --no-wrapping -i spec.json`
- `cdd-ts serve_json_rpc --port 8080 --listen 0.0.0.0`
- `cdd-ts mcp`

## SDK Example

```ts
import { generateFromConfig } from 'cdd-ts/index';

async function generate() {
    const config = {
        input: './openapi.yaml',
        output: './src/api',
        options: {
            framework: 'fetch',
            implementation: 'fetch',
        },
    };
    await generateFromConfig(config);
}
generate();
```

## Installation

```bash
npm install
```

## Development

You can use standard tooling commands or the included cross-platform Makefiles to fetch dependencies, build, and test:

```bash
npm install
npm run build
npm test
# or
make deps
make build
make test
# or on Windows
.\make.bat deps
.\make.bat build
.\make.bat test
```

See [PUBLISH.md](PUBLISH.md) for packaging and releasing.

## Features

The `cdd-ts` compiler leverages a unified architecture to support various facets of API and code lifecycle management. For a deep dive into the compiler's design, see [ARCHITECTURE.md](ARCHITECTURE.md).

- **Compilation**:
    - **OpenAPI → `TypeScript`**: Generate idiomatic native models, network routes, client SDKs, and boilerplate directly from OpenAPI (`.json` / `.yaml`) specifications.
    - **`TypeScript` → OpenAPI**: Statically parse existing `TypeScript` source code and emit compliant OpenAPI specifications.
- **AST-Driven & Safe**: Employs static analysis instead of unsafe dynamic execution or reflection, allowing it to safely parse and emit code even for incomplete or un-compilable project states.
- **Seamless Sync**: Keep your docs, tests, database, clients, and routing in perfect harmony. Update your code, and generate the docs; or update the docs, and generate the code.
- **Model Context Protocol (MCP)**: Native integration exposes CLI capabilities seamlessly as AI agent tools via MCP over stdio.

**Uncommon Features:**

`cdd-ts` supports extensive auto-generation features beyond the standard suite:

- **Auto-Admin UI:** Generates fully functional, component-based administration dashboards (Angular or Vanilla Web Components) mapped directly from the OpenAPI schema using the `--admin` flag.

---

## CLI Options

```
Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  from_openapi              Generate code from OpenAPI
  to_openapi [options]      Generate an OpenAPI specification from TypeScript
  to_docs_json [options]    Generate JSON containing how to call operations in
                            the target language
  serve_json_rpc [options]  Expose CLI interface as JSON-RPC server
  mcp                       Start Model Context Protocol (MCP) server over stdio
  help [command]            display help for command
```

### `from_openapi`

```sh
$ dist/cli.js from_openapi --help
Usage: cdd-ts from_openapi [options] [command]

Generate code from OpenAPI

Options:
  -h, --help            display help for command

Commands:
  to_sdk_cli [options]  Generate Client SDK CLI from an OpenAPI specification
  to_sdk [options]      Generate Client SDK from an OpenAPI specification
  to_server [options]   Generate Server from an OpenAPI specification
  help [command]        display help for command
```

### `to_openapi`

```sh
$ dist/cli.js to_openapi --help
Usage: cdd-ts to_openapi [options]


Options:
  -i, --input <path>   Path to a snapshot file or a generated output directory
                       (env: CDD_INPUT)
  -o, --output <path>  Output file (env: CDD_OUTPUT)
  --format <format>    Output format for the OpenAPI spec (choices: "json",
                       "yaml", default: "yaml", env: CDD_FORMAT)
  -h, --help           display help for command
```

### `to_docs_json`

```sh
$ dist/cli.js to_docs_json --help
Usage: cdd-ts to_docs_json [options]

Generate JSON containing how to call operations in the target language

Options:
  -i, --input <path>   Path or URL to the OpenAPI spec (env: CDD_INPUT)
  -o, --output <path>  Path to write the JSON to (env: CDD_OUTPUT)
  --no-imports         Do not include import statements in the generated code
                       (env: CDD_NO_IMPORTS)
  --no-wrapping        Do not wrap the generated code in a function or block
                       (env: CDD_NO_WRAPPING)
  -h, --help           display help for command
```

---

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.
