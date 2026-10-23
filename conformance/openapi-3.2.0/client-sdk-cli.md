# OpenAPI 3.2.0 Conformance Table: Client SDK CLI (CLI Tooling & Tests)

This table tracks the completeness of language integration with OpenAPI 3.2.0 for generating Command-Line Interfaces (CLIs) wrapper tools, and vice-versa.

### Legend & Tracking Guide
*   **To**: Language -> OpenAPI (Generating the OpenAPI document from declarative CLI structures)
*   **From**: OpenAPI -> Language (Generating CLI routing, flag parsing, and formatting from OpenAPI)
*   **Presence `[To, From]`**: The object is successfully parsed, validated, utilized, or generated.
*   **Absence `[To, From]`**: The object is currently unsupported, dropped, or falls back to generic/`any` types.
*   **Skipped `[To, From]`**: Intentionally ignored because it is irrelevant or unsupported by the CLI environment.
*   **Checkboxes**: Mark `[x]` as conformance is achieved.

| OpenAPI 3.2.0 Object / Feature | Presence `[To, From]` | Absence `[To, From]` | Skipped `[To, From]` | Notes / Implementation Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **OpenAPI Object (Root)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Root CLI definition (`CliGenerator` / `parseGeneratedCliSource`) |
| **OpenAPI Object (`openapi`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OpenAPI version preserved in `document.ts` and CLI metadata |
| **OpenAPI Object (`$self`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Base URI resolution for internal and external references |
| **OpenAPI Object (`info`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Program `.name()`, `.description()`, and `.version()` in `cli.ts` |
| **OpenAPI Object (`jsonSchemaDialect`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Dialect metadata preserved in `document.ts` |
| **OpenAPI Object (`servers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default server URL and `--base-url` option in `cli.ts` |
| **OpenAPI Object (`paths`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Mapped to Commander.js `.command()` subcommands |
| **OpenAPI Object (`webhooks`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `webhooks.ts` alongside CLI package |
| **OpenAPI Object (`components`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Shared models, parameters, security schemes, and examples |
| **OpenAPI Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global auth flags (`--token`, `--api-key`) and `security.ts` |
| **OpenAPI Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Command grouping and `tags.ts` metadata |
| **OpenAPI Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Root external documentation in `document.ts` |
| **Info Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI `--help` text, `--version` command |
| **Info Object (`title`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI program name and help header |
| **Info Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Short summary for CLI global help text |
| **Info Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI program `.description()` |
| **Info Object (`termsOfService`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `info.ts` (`API_INFO.termsOfService`) |
| **Info Object (`contact`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `info.ts` (`API_INFO.contact`) |
| **Info Object (`license`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `info.ts` (`API_INFO.license`) |
| **Info Object (`version`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI program `.version()` |
| **Contact Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `info.ts` and extracted during `from_openapi` |
| **Contact Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.name` |
| **Contact Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.url` |
| **Contact Object (`email`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.email` |
| **License Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `info.ts` and extracted during `from_openapi` |
| **License Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license.name` |
| **License Object (`identifier`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | SPDX license identifier extraction |
| **License Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license.url` |
| **Server Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global `--base-url` flag and `servers.ts` |
| **Server Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server URL template in `servers.ts` |
| **Server Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server description in `servers.ts` |
| **Server Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Unique name used as CLI alias for a host environment |
| **Server Object (`variables`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server variable definitions in `servers.ts` |
| **Server Variable Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Individual host template CLI flags / `resolveServerUrl` |
| **Server Variable Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Allowed values for server URL variables |
| **Server Variable Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default server variable value |
| **Server Variable Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server variable description |
| **Components Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable flag groups and SDK models |
| **Components Object (`schemas`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript model interfaces in `models/` |
| **Components Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable response definitions in `responses.ts` |
| **Components Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable parameter definitions in `parameters.ts` |
| **Components Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable example definitions in `examples.ts` |
| **Components Object (`requestBodies`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable request body definitions in `request-bodies.ts` |
| **Components Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable header definitions in `headers.ts` |
| **Components Object (`securitySchemes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable security scheme definitions in `security.ts` |
| **Components Object (`links`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable link definitions in `links.ts` |
| **Components Object (`callbacks`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable callback definitions in `callbacks.ts` |
| **Components Object (`pathItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable subcommand groupings (`path-items.ts`) |
| **Components Object (`mediaTypes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable payload flag definitions (`media-types.ts`) |
| **Paths Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Structural mapping to CLI commands |
| **Paths Object (`/{path}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Mapped to CLI subcommands and `paths.ts` |
| **Path Item Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand grouping |
| **Path Item Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item reference resolution |
| **Path Item Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item summary in `paths.ts` |
| **Path Item Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item description in `paths.ts` |
| **Path Item Object (`get`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for GET operation |
| **Path Item Object (`put`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for PUT operation |
| **Path Item Object (`post`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for POST operation |
| **Path Item Object (`delete`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for DELETE operation |
| **Path Item Object (`options`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for OPTIONS operation |
| **Path Item Object (`head`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for HEAD operation |
| **Path Item Object (`patch`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for PATCH operation |
| **Path Item Object (`trace`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for TRACE operation |
| **Path Item Object (`query`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | QUERY HTTP method subcommand |
| **Path Item Object (`additionalOperations`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Map of custom HTTP methods to subcommands |
| **Path Item Object (`servers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path-level servers in `paths.ts` |
| **Path Item Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Shared path-level CLI options |
| **Operation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | The execution targets of subcommands |
| **Operation Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service class resolution in CLI action handler |
| **Operation Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand `.description()` text |
| **Operation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand help description |
| **Operation Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in operation JSDoc `@see` |
| **Operation Object (`operationId`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand name (`kebab-case`) and reverse-parse key |
| **Operation Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Commander `.option()` / `.requiredOption()` flags |
| **Operation Object (`requestBody`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `--body <json>` option with `JSON.parse` |
| **Operation Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Formatted JSON stdout output and error exit codes |
| **Operation Object (`callbacks`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `callbacks.ts` |
| **Operation Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in service method `@deprecated` JSDoc |
| **Operation Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Auth token flags and `@security` JSDoc |
| **Operation Object (`servers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation server overrides |
| **External Documentation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Added to See also / JSDoc `@see` |
| **External Documentation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs description |
| **External Documentation Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs URL |
| **Parameter Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI `--<param> <value>` option generation and AST extraction |
| **Parameter Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Flag name (`--<kebab-name>`) |
| **Parameter Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter location metadata in `[path]`, `[query]`, `[header]`, `[cookie]` |
| **Parameter Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Commander option description string |
| **Parameter Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emits `.requiredOption()` when required, `.option()` when optional |
| **Parameter Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter deprecation metadata |
| **Parameter Object (`allowEmptyValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `parameters.ts` |
| **Parameter Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `parameters.ts` |
| **Parameter Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `parameters.ts` |
| **Parameter Object (`style`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Serialized via `utils/parameter-serializer.ts` |
| **Parameter Object (`explode`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Serialized via `utils/parameter-serializer.ts` |
| **Parameter Object (`allowReserved`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Serialized via `utils/parameter-serializer.ts` |
| **Parameter Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Coerced (`Number(...)`, `Boolean(...)`) in CLI action |
| **Parameter Object (`content`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSON-parsed CLI option content |
| **Request Body Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handled via `--body <json>` flag |
| **Request Body Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `--body <json>` option description |
| **Request Body Object (`content`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Request payload media type in `request-bodies.ts` |
| **Request Body Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Uses `.requiredOption("--body <json>")` when required |
| **Media Type Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Inferred based on payload flag logic |
| **Media Type Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Payload schema type |
| **Media Type Object (`itemSchema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validation for individual items in a CLI array flag |
| **Media Type Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `examples.ts` |
| **Media Type Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `examples.ts` |
| **Media Type Object (`encoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `media-types.ts` |
| **Media Type Object (`prefixEncoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `media-types.ts` |
| **Media Type Object (`itemEncoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `media-types.ts` |
| **Encoding Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Internal CLI form-data builder logic |
| **Encoding Object (`contentType`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Part content-type in `FormData` builder |
| **Encoding Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Part headers in `media-types.ts` |
| **Encoding Object (`encoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested encoding in `media-types.ts` |
| **Encoding Object (`prefixEncoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested prefixEncoding in `media-types.ts` |
| **Encoding Object (`itemEncoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested itemEncoding in `media-types.ts` |
| **Encoding Object (`style`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Form style in `media-types.ts` |
| **Encoding Object (`explode`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Form explode in `media-types.ts` |
| **Encoding Object (`allowReserved`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Form allowReserved in `media-types.ts` |
| **Responses Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Determines Exit Codes (0 vs 1) and stdout output |
| **Responses Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default response handling in `responses.ts` |
| **Responses Object (`HTTP Status Code`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Status code response map in `responses.ts` |
| **Response Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Stdout JSON formatting (`JSON.stringify(result, null, 2)`) |
| **Response Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand exit status short description |
| **Response Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response description in `responses.ts` |
| **Response Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response headers in `responses.ts` |
| **Response Object (`content`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response media type in `responses.ts` |
| **Response Object (`links`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response links in `links.ts` |
| **Callback Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `callbacks.ts` |
| **Callback Object (`{expression}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Expression key in `callbacks.ts` |
| **Example Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `examples.ts` |
| **Example Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Example summary in `examples.ts` |
| **Example Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Example description in `examples.ts` |
| **Example Object (`dataValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Structured `dataValue` in `examples.ts` |
| **Example Object (`serializedValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Wire `serializedValue` in `examples.ts` |
| **Example Object (`externalValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External URI in `examples.ts` |
| **Example Object (`value`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Embedded value in `examples.ts` |
| **Link Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `links.ts` |
| **Link Object (`operationRef`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Link `operationRef` in `links.ts` |
| **Link Object (`operationId`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Link `operationId` in `links.ts` |
| **Link Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Link `parameters` in `links.ts` |
| **Link Object (`requestBody`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Link `requestBody` in `links.ts` |
| **Link Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Link `description` in `links.ts` |
| **Link Object (`server`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Link `server` in `links.ts` |
| **Header Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `headers.ts` |
| **Header Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header description in `headers.ts` |
| **Header Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header required flag in `headers.ts` |
| **Header Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header deprecated flag in `headers.ts` |
| **Header Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header example in `headers.ts` |
| **Header Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header examples in `headers.ts` |
| **Header Object (`style`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header style in `headers.ts` |
| **Header Object (`explode`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header explode in `headers.ts` |
| **Header Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header schema in `headers.ts` |
| **Header Object (`content`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header content in `headers.ts` |
| **Tag Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | High-level CLI command groups and `tags.ts` |
| **Tag Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag name in `tags.ts` |
| **Tag Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag summary in `tags.ts` |
| **Tag Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag description in `tags.ts` |
| **Tag Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag externalDocs in `tags.ts` |
| **Tag Object (`parent`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested subcommand groups (`tags.ts`) |
| **Tag Object (`kind`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand grouping logic (e.g. nav vs hidden) |
| **Reference Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Component `$ref` resolution |
| **Reference Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Internal resolution to flatten flags/commands |
| **Reference Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reference summary override |
| **Reference Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reference description override |
| **Schema Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI flag type coercion and `models/` interfaces |
| **Schema Object (`discriminator`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Discriminator type guards in `discriminators.ts` |
| **Schema Object (`xml`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML metadata in `utils/xml-parser.ts` |
| **Schema Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Model JSDoc `@see` annotation |
| **Schema Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Model JSDoc `@example` annotation |
| **Discriminator Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Polymorphic model type guards (`discriminators.ts`) |
| **Discriminator Object (`propertyName`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Discriminator property name |
| **Discriminator Object (`mapping`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Discriminator mapping dictionary |
| **Discriminator Object (`defaultMapping`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Fallback CLI flag group when type is omitted |
| **XML Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `utils/xml-parser.ts` |
| **XML Object (`nodeType`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML nodeType in `XmlConfig` |
| **XML Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML name in `XmlConfig` |
| **XML Object (`namespace`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML namespace in `XmlConfig` |
| **XML Object (`prefix`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML prefix in `XmlConfig` |
| **XML Object (`attribute`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML attribute in `XmlConfig` |
| **XML Object (`wrapped`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML wrapped in `XmlConfig` |
| **Security Scheme Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `security.ts` and `utils/auth-session.ts` |
| **Security Scheme Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scheme type in `security.ts` |
| **Security Scheme Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scheme description in `security.ts` |
| **Security Scheme Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | API key name in `security.ts` |
| **Security Scheme Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | API key location in `security.ts` |
| **Security Scheme Object (`scheme`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP scheme in `security.ts` |
| **Security Scheme Object (`bearerFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Bearer format in `security.ts` |
| **Security Scheme Object (`flows`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 flows in `security.ts` |
| **Security Scheme Object (`openIdConnectUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OpenID Connect URL in `security.ts` |
| **Security Scheme Object (`oauth2MetadataUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 metadata discovery |
| **Security Scheme Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scheme deprecated flag in `security.ts` |
| **OAuth Flows Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI token manager / `SdkAuthClient` integration |
| **OAuth Flows Object (`implicit`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Implicit flow in `security.ts` |
| **OAuth Flows Object (`password`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Password flow in `security.ts` |
| **OAuth Flows Object (`clientCredentials`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Client credentials flow in `security.ts` |
| **OAuth Flows Object (`authorizationCode`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Authorization code flow in `security.ts` |
| **OAuth Flows Object (`deviceAuthorization`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Support for the Device Authorization grant flow |
| **OAuth Flow Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Flow routing logic for CLI login |
| **OAuth Flow Object (`authorizationUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Authorization URL in `security.ts` |
| **OAuth Flow Object (`deviceAuthorizationUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Triggers CLI device auth prompt |
| **OAuth Flow Object (`tokenUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Token URL in `security.ts` |
| **OAuth Flow Object (`refreshUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Refresh URL in `security.ts` |
| **OAuth Flow Object (`scopes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 scopes in `security.ts` |
| **Security Requirement Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Asserting required auth exists before command execution |
| **Security Requirement Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required scheme and scopes in `security.ts` |
