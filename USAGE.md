# Usage

Use the CLI or programmatic API.

## CLI Options

```bash
Usage: cdd-ts [options] [command]

OpenAPI ↔ TypeScript

Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  from_openapi              Generate code from OpenAPI
  to_openapi [options]      Generate an OpenAPI specification from TypeScript code
                            (snapshot-based with AST fallback)
  to_docs_json [options]    Generate JSON containing how to call operations in the target
                            language
  serve_json_rpc [options]  Expose CLI interface as JSON-RPC server
  help [command]            display help for command
```

### from_openapi

```bash
Usage: cdd-ts from_openapi [options] [command]

Generate code from OpenAPI

Options:
  -h, --help            display help for command

Commands:
  to_sdk_cli [options]  Generate Client SDK CLI from an OpenAPI specification
  to_sdk [options]      Generate Client SDK from an OpenAPI specification
  to_server [options]   Generate Server from an OpenAPI specification
  to_orm [options]      Generate ORM entities/models from an OpenAPI specification
  help [command]        display help for command
```

#### from_openapi to_sdk_cli

```bash
Usage: cdd-ts from_openapi to_sdk_cli [options]

Generate Client SDK CLI from an OpenAPI specification

Options:
  -c, --config <path>                Path to a configuration file (env:
                                     CDD_CONFIG)
  -i, --input <path>                 Path or URL to the OpenAPI spec (env:
                                     CDD_INPUT)
  --input-dir <path>                 Path to directory of OpenAPI specs (env:
                                     CDD_INPUT_DIR)
  -o, --output <path>                Output directory for generated files (env:
                                     CDD_OUTPUT)
  --dateType <type>                  Date type to use (choices: "string",
                                     "Date", env: CDD_DATE_TYPE)
  --enumStyle <style>                Style for enums (choices: "enum", "union",
                                     env: CDD_ENUM_STYLE)
  --int64Type <type>                 Type for int64 formatting (choices:
                                     "number", "string", "bigint", env:
                                     CDD_INT64_TYPE)
  --no-test-gen                      Disable all test generation (env:
                                     CDD_NO_TEST_GEN)
  --no-github-actions                Disable generation of github actions
                                     scaffolding (env: CDD_NO_GITHUB_ACTIONS)
  --no-installable-package           Disable generation of package scaffolding
                                     (env: CDD_NO_INSTALLABLE_PACKAGE)
  --clientName <name>                Name for the generated client (env:
                                     CDD_CLIENT_NAME)
  --framework <framework>            Target framework (choices: "angular",
                                     "react", "vue", default: "angular", env:
                                     CDD_FRAMEWORK)
  --implementation <implementation>  HTTP implementation (choices: "angular",
                                     "fetch", "axios", "node", default:
                                     "angular", env: CDD_IMPLEMENTATION)
  --platform <platform>              Target runtime platform (choices:
                                     "browser", "node", env: CDD_PLATFORM)
  --customHeader <header...>         Custom headers to add to generated
                                     requests, formatted as Key:Value
  --admin                            Generate an auto-admin UI (env: CDD_ADMIN)
  --no-generate-services             Disable generation of services (env:
                                     CDD_NO_GENERATE_SERVICES)
  --no-tests-for-service             Disable generation of tests for services
                                     (env: CDD_NO_TESTS_FOR_SERVICE)
  --no-tests-for-admin               Disable generation of tests for the admin
                                     UI (env: CDD_NO_TESTS_FOR_ADMIN)
  -h, --help                         display help for command
```

#### from_openapi to_sdk

```bash
Usage: cdd-ts from_openapi to_sdk [options]

Generate Client SDK from an OpenAPI specification

Options:
  -c, --config <path>                Path to a configuration file (env:
                                     CDD_CONFIG)
  -i, --input <path>                 Path or URL to the OpenAPI spec (env:
                                     CDD_INPUT)
  --input-dir <path>                 Path to directory of OpenAPI specs (env:
                                     CDD_INPUT_DIR)
  -o, --output <path>                Output directory for generated files (env:
                                     CDD_OUTPUT)
  --dateType <type>                  Date type to use (choices: "string",
                                     "Date", env: CDD_DATE_TYPE)
  --enumStyle <style>                Style for enums (choices: "enum", "union",
                                     env: CDD_ENUM_STYLE)
  --int64Type <type>                 Type for int64 formatting (choices:
                                     "number", "string", "bigint", env:
                                     CDD_INT64_TYPE)
  --no-test-gen                      Disable all test generation (env:
                                     CDD_NO_TEST_GEN)
  --no-github-actions                Disable generation of github actions
                                     scaffolding (env: CDD_NO_GITHUB_ACTIONS)
  --no-installable-package           Disable generation of package scaffolding
                                     (env: CDD_NO_INSTALLABLE_PACKAGE)
  --clientName <name>                Name for the generated client (env:
                                     CDD_CLIENT_NAME)
  --framework <framework>            Target framework (choices: "angular",
                                     "react", "vue", default: "angular", env:
                                     CDD_FRAMEWORK)
  --implementation <implementation>  HTTP implementation (choices: "angular",
                                     "fetch", "axios", "node", default:
                                     "angular", env: CDD_IMPLEMENTATION)
  --platform <platform>              Target runtime platform (choices:
                                     "browser", "node", env: CDD_PLATFORM)
  --customHeader <header...>         Custom headers to add to generated
                                     requests, formatted as Key:Value
  --admin                            Generate an auto-admin UI (env: CDD_ADMIN)
  --no-generate-services             Disable generation of services (env:
                                     CDD_NO_GENERATE_SERVICES)
  --no-tests-for-service             Disable generation of tests for services
                                     (env: CDD_NO_TESTS_FOR_SERVICE)
  --no-tests-for-admin               Disable generation of tests for the admin
                                     UI (env: CDD_NO_TESTS_FOR_ADMIN)
  -h, --help                         display help for command
```

#### from_openapi to_server

```bash
Usage: cdd-ts from_openapi to_server [options]

Generate Server from an OpenAPI specification

Options:
  -c, --config <path>       Path to a configuration file (env: CDD_CONFIG)
  -i, --input <path>        Path or URL to the OpenAPI spec (env: CDD_INPUT)
  --input-dir <path>        Path to directory of OpenAPI specs (env:
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
  --no-github-actions       Disable generation of github actions scaffolding
                            (env: CDD_NO_GITHUB_ACTIONS)
  --no-installable-package  Disable generation of package scaffolding (env:
                            CDD_NO_INSTALLABLE_PACKAGE)
  --serverFramework <type>  Target server framework (choices: "express", "node",
                            "bun", "deno", default: "express", env:
                            CDD_SERVER_FRAMEWORK)
  --orm <type>              Target ORM implementation for models (choices:
                            "typeorm", env: CDD_ORM)
  -h, --help                display help for command
```

#### from_openapi to_orm

```bash
Usage: cdd-ts from_openapi to_orm [options]

Generate ORM entities/models from an OpenAPI specification

Options:
  -c, --config <path>       Path to a configuration file (env: CDD_CONFIG)
  -i, --input <path>        Path or URL to the OpenAPI spec (env: CDD_INPUT)
  --input-dir <path>        Path to directory of OpenAPI specs (env:
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
  --no-github-actions       Disable generation of github actions scaffolding
                            (env: CDD_NO_GITHUB_ACTIONS)
  --no-installable-package  Disable generation of package scaffolding (env:
                            CDD_NO_INSTALLABLE_PACKAGE)
  --orm <type>              Target ORM implementation for models (choices:
                            "typeorm", env: CDD_ORM)
  -h, --help                display help for command
```

### to_openapi

```bash
Usage: cdd-ts to_openapi [options]

Generate an OpenAPI specification from TypeScript code (snapshot-based with AST fallback)

Options:
  -i, --input <path>   Path to a snapshot file or a generated output directory (env: CDD_INPUT)
  -o, --output <path>  Output file (env: CDD_OUTPUT)
  --format <format>    Output format for the OpenAPI spec (choices: "json", "yaml", default:
                       "yaml", env: CDD_FORMAT)
  --orm <type>         Target ORM implementation to parse entities from (choices: "typeorm",
                       env: CDD_ORM)
  -h, --help           display help for command
```

### to_docs_json

```bash
Usage: cdd-ts to_docs_json [options]

Generate JSON containing how to call operations in the target language

Options:
  -i, --input <path>       Path or URL to the OpenAPI spec (env: CDD_INPUT)
  -o, --output <path>      Path to write the JSON to (env: CDD_OUTPUT)
  --framework <framework>  Target framework (choices: "angular", "react", "vue", default:
                           "angular", env: CDD_FRAMEWORK)
  --no-imports             Do not include import statements in the generated code (env:
                           CDD_NO_IMPORTS)
  --no-wrapping            Do not wrap the generated code in a function or block (env:
                           CDD_NO_WRAPPING)
  -h, --help               display help for command
```

### serve_json_rpc

```bash
Usage: cdd-ts serve_json_rpc [options]

Expose CLI interface as JSON-RPC server

Options:
  --port <port>       Port to listen on (default: "8080", env: CDD_PORT)
  --listen <address>  Address to listen on (default: "127.0.0.1", env: CDD_LISTEN)
  -h, --help          display help for command
```

## Environment Variables

All parameters map to an environment variable starting with `CDD_`, like `CDD_INPUT`, `CDD_OUTPUT`, `CDD_PORT`, `CDD_NO_WRAPPING`.

## Code Example

See `README.md` for programmatic code snippets using the internal `cdd-ts` index file.
