# Usage

Use the `cdd-ts` CLI or programmatic TypeScript SDK.

## CLI Options

### `cdd-ts --help`

```text
Usage: cdd-ts [options] [command]

OpenAPI ↔ TypeScript.

Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  from_openapi              Generate code from an OpenAPI specification.
  to_openapi [options]      Generate an OpenAPI specification from source code.
  to_docs_json [options]    Generate JSON documentation with code snippets for an
                            OpenAPI specification
  from_arazzo               Generate TypeScript SDK orchestrators, CLI workflow
                            runners, or Server/E2E suites from an Arazzo 1.1.0
                            specification.
  to_arazzo [options]       Reverse-parse TypeScript SDK workflows, CLI runners,
                            or Server E2E tests into an Arazzo 1.1.0
                            specification.
  serve_json_rpc [options]  Expose CLI interface as a JSON-RPC server.
  sync [options]            Synchronize an OpenAPI specification with source
                            code.
  mcp                       Run the generator as an MCP server over stdio.
  help [command]            display help for command
```

### `from_openapi`

```text
Usage: cdd-ts from_openapi [options] [command]

Generate code from an OpenAPI specification.

Options:
  -h, --help            display help for command

Commands:
  to_sdk_cli [options]  Generate a client SDK and a corresponding command-line
                        interface (CLI) from an OpenAPI specification.
  to_sdk [options]      Generate Client SDK from an OpenAPI specification.
  to_server [options]   Generate Server from an OpenAPI specification.
  help [command]        display help for command
```

#### `from_openapi to_sdk`

```text
Usage: cdd-ts from_openapi to_sdk [options]

Generate Client SDK from an OpenAPI specification.

Options:
  -c, --config <path>                Path to a configuration file (env:
                                     CDD_CONFIG)
  -i, --input <path>                 Path or URL to the OpenAPI specification
  -d, --input-dir <path>             Path to directory of OpenAPI specs (env:
                                     CDD_INPUT_DIR)
  -o, --output <path>                Output directory for generated files (env:
                                     CDD_OUTPUT)
  --dateType <type>                  Date type to use (choices: "string", "Date",
                                     env: CDD_DATE_TYPE)
  --enumStyle <style>                Style for enums (choices: "enum", "union",
                                     env: CDD_ENUM_STYLE)
  --int64Type <type>                 Type for int64 formatting (choices:
                                     "number", "string", "bigint", env:
                                     CDD_INT64_TYPE)
  --no-test-gen                      Disable all test generation (env:
                                     CDD_NO_TEST_GEN)
  --tests                            Generate integration tests and mocks (env:
                                     CDD_TESTS)
  -m, --mcp                          Generate Model Context Protocol (MCP) server
                                     and adapter (env: CDD_MCP)
  --no-github-actions                Do not generate GitHub Actions scaffolding
                                     (env: CDD_NO_GITHUB_ACTIONS)
  --no-installable-package           Do not generate installable package
                                     scaffolding (env:
                                     CDD_NO_INSTALLABLE_PACKAGE)
  --clientName <name>                Name for the generated client (env:
                                     CDD_CLIENT_NAME)
  -f, --framework <framework>        Target framework (choices: "angular",
                                     "react", "vue", "vanilla", "Vanilla JS",
                                     env: CDD_FRAMEWORK)
  --implementation <implementation>  HTTP implementation (choices: "angular",
                                     "fetch", "axios", "node", env:
                                     CDD_IMPLEMENTATION)
  -p, --platform <platform>          Target runtime platform (choices: "browser",
                                     "node", env: CDD_PLATFORM)
  --customHeader <header...>         Custom headers to add to generated requests,
                                     formatted as Key:Value
  --admin                            Generate an auto-admin UI (env: CDD_ADMIN)
  --no-generate-services             Disable generation of services (env:
                                     CDD_NO_GENERATE_SERVICES)
  --no-tests-for-service             Disable generation of tests for services
                                     (env: CDD_NO_TESTS_FOR_SERVICE)
  --no-tests-for-admin               Disable generation of tests for the admin UI
                                     (env: CDD_NO_TESTS_FOR_ADMIN)
  -h, --help                         display help for command
```

#### `from_openapi to_sdk_cli`

```text
Usage: cdd-ts from_openapi to_sdk_cli [options]

Generate a client SDK and a corresponding command-line interface (CLI) from an
OpenAPI specification.

Options:
  -c, --config <path>                Path to a configuration file (env:
                                     CDD_CONFIG)
  -i, --input <path>                 Path or URL to the OpenAPI specification
  -d, --input-dir <path>             Path to directory of OpenAPI specs (env:
                                     CDD_INPUT_DIR)
  -o, --output <path>                Output directory for generated files (env:
                                     CDD_OUTPUT)
  --dateType <type>                  Date type to use (choices: "string", "Date",
                                     env: CDD_DATE_TYPE)
  --enumStyle <style>                Style for enums (choices: "enum", "union",
                                     env: CDD_ENUM_STYLE)
  --int64Type <type>                 Type for int64 formatting (choices:
                                     "number", "string", "bigint", env:
                                     CDD_INT64_TYPE)
  --no-test-gen                      Disable all test generation (env:
                                     CDD_NO_TEST_GEN)
  --tests                            Generate integration tests and mocks (env:
                                     CDD_TESTS)
  -m, --mcp                          Generate Model Context Protocol (MCP) server
                                     and adapter (env: CDD_MCP)
  --no-github-actions                Do not generate GitHub Actions scaffolding
                                     (env: CDD_NO_GITHUB_ACTIONS)
  --no-installable-package           Do not generate installable package
                                     scaffolding (env:
                                     CDD_NO_INSTALLABLE_PACKAGE)
  --clientName <name>                Name for the generated client (env:
                                     CDD_CLIENT_NAME)
  -f, --framework <framework>        Target framework (choices: "angular",
                                     "react", "vue", "vanilla", "Vanilla JS",
                                     env: CDD_FRAMEWORK)
  --implementation <implementation>  HTTP implementation (choices: "angular",
                                     "fetch", "axios", "node", env:
                                     CDD_IMPLEMENTATION)
  -p, --platform <platform>          Target runtime platform (choices: "browser",
                                     "node", env: CDD_PLATFORM)
  --customHeader <header...>         Custom headers to add to generated requests,
                                     formatted as Key:Value
  --admin                            Generate an auto-admin UI (env: CDD_ADMIN)
  --no-generate-services             Disable generation of services (env:
                                     CDD_NO_GENERATE_SERVICES)
  --no-tests-for-service             Disable generation of tests for services
                                     (env: CDD_NO_TESTS_FOR_SERVICE)
  --no-tests-for-admin               Disable generation of tests for the admin UI
                                     (env: CDD_NO_TESTS_FOR_ADMIN)
  -h, --help                         display help for command
```

#### `from_openapi to_server`

```text
Usage: cdd-ts from_openapi to_server [options]

Generate Server from an OpenAPI specification.

Options:
  -c, --config <path>       Path to a configuration file (env: CDD_CONFIG)
  -i, --input <path>        Path or URL to the OpenAPI specification
  -d, --input-dir <path>    Path to directory of OpenAPI specs (env:
                            CDD_INPUT_DIR)
  -o, --output <path>       Output directory for generated files (env:
                            CDD_OUTPUT)
  --dateType <type>         Date type to use (choices: "string", "Date", env:
                            CDD_DATE_TYPE)
  --enumStyle <style>       Style for enums (choices: "enum", "union", env:
                            CDD_ENUM_STYLE)
  --int64Type <type>        Type for int64 formatting (choices: "number",
                            "string", "bigint", env: CDD_INT64_TYPE)
  --no-test-gen             Disable all test generation (env: CDD_NO_TEST_GEN)
  --tests                   Generate integration tests and mocks (env: CDD_TESTS)
  -m, --mcp                 Generate Model Context Protocol (MCP) server and
                            adapter (env: CDD_MCP)
  --no-github-actions       Do not generate GitHub Actions scaffolding (env:
                            CDD_NO_GITHUB_ACTIONS)
  --no-installable-package  Do not generate installable package scaffolding (env:
                            CDD_NO_INSTALLABLE_PACKAGE)
  -f, --framework <type>    Target server framework (choices: "express", "node",
                            "bun", "deno", env: CDD_SERVER_FRAMEWORK)
  --orm <type>              Target ORM implementation for models (choices:
                            "typeorm", env: CDD_ORM)
  -h, --help                display help for command
```

### `to_openapi`

```text
Usage: cdd-ts to_openapi [options]

Generate an OpenAPI specification from source code.

Options:
  -i, --input <path>     Path to source code directory or file (env: CDD_INPUT)
  -o, --output <path>    Output file (env: CDD_OUTPUT)
  -f, --format <format>  Output format for the OpenAPI spec (choices: "json",
                         "yaml", default: "yaml", env: CDD_FORMAT)
  --orm <type>           Target ORM implementation to parse entities from
                         (choices: "typeorm", env: CDD_ORM)
  -h, --help             display help for command
```

### `from_arazzo`

```text
Usage: cdd-ts from_arazzo [options] [command]

Generate TypeScript SDK orchestrators, CLI workflow runners, or Server/E2E suites
from an Arazzo 1.1.0 specification.

Options:
  -h, --help            display help for command

Commands:
  to_sdk [options]      Generate a TypeScript Client SDK WorkflowOrchestrator
                        from an Arazzo 1.1.0 specification.
  to_sdk_cli [options]  Generate a Commander CLI workflow runner (reusing the SDK
                        WorkflowOrchestrator) from an Arazzo 1.1.0 specification.
  to_server [options]   Generate Server workflow execution routes and Vitest E2E
                        workflow test suites from an Arazzo 1.1.0 specification.
  help [command]        display help for command
```

### `to_arazzo`

```text
Usage: cdd-ts to_arazzo [options]

Reverse-parse TypeScript SDK workflows, CLI runners, or Server E2E tests into an
Arazzo 1.1.0 specification.

Options:
  -i, --input <path>     Input TypeScript file or project directory
  -o, --output <path>    Output Arazzo specification file path (default:
                         "arazzo.json", env: CDD_OUTPUT)
  -f, --format <format>  Output format (json or yaml) (choices: "json", "yaml")
  --ignore-snapshot      Force static ts-morph AST reverse-parsing even if
                         arazzo.snapshot.json exists
  -h, --help             display help for command
```

### `sync`

```text
Usage: cdd-ts sync [options]

Synchronize an OpenAPI specification with source code.

Options:
  -i, --input <path>    Path to the source directory or file
  -t, --truth <source>  Designate a single source of truth for synchronization.
                        (choices: "class", "typeorm", "function", "openapi",
                        "arazzo")
  -o, --output <path>   Output directory for generated files (env: CDD_OUTPUT)
  -h, --help            display help for command
```

### `to_docs_json`

```text
Usage: cdd-ts to_docs_json [options]

Generate JSON documentation with code snippets for an OpenAPI specification

Options:
  -i, --input <path>           Path or URL to the OpenAPI specification (env:
                               CDD_INPUT)
  -o, --output <path>          Path to write the JSON to (env: CDD_OUTPUT)
  -f, --framework <framework>  Target framework (choices: "angular", "react",
                               "vue", "vanilla", "Vanilla JS", default:
                               "vanilla", env: CDD_FRAMEWORK)
  --no-imports                 Omit the imports field (env: CDD_NO_IMPORTS)
  --no-wrapping                Omit the wrapper fields (env: CDD_NO_WRAPPING)
  -h, --help                   display help for command
```

### `serve_json_rpc`

```text
Usage: cdd-ts serve_json_rpc [options]

Expose CLI interface as a JSON-RPC server.

Options:
  -p, --port <port>       Port to listen on (default: "8080", env: CDD_PORT)
  -l, --listen <address>  Address to listen on (default: "127.0.0.1", env:
                          CDD_LISTEN)
  -h, --help              display help for command
```

### `mcp`

```text
Usage: cdd-ts mcp [options]

Run the generator as an MCP server over stdio.

Options:
  -h, --help  display help for command
```

## Environment Variables

All CLI parameters map to environment variables prefixed with `CDD_`, such as `CDD_INPUT`, `CDD_INPUT_DIR`, `CDD_OUTPUT`, `CDD_FRAMEWORK`, `CDD_SERVER_FRAMEWORK`, `CDD_IMPLEMENTATION`, `CDD_ORM`, `CDD_PORT`, `CDD_LISTEN`, `CDD_NO_IMPORTS`, and `CDD_NO_WRAPPING`.

## Programmatic SDK Example

See [README.md](README.md#programmatic-sdk-example) for idiomatic TypeScript examples using the exports from `cdd-ts` (`src/index.ts`).
