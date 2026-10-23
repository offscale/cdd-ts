# Swagger 2.0 Conformance Table: Client SDK CLI (CLI Tooling & Tests)

This table tracks the completeness of language integration with Swagger 2.0 for generating Command-Line Interfaces (CLIs) wrapper tools, and vice-versa.

### Legend & Tracking Guide
*   **To**: Language -> OpenAPI (Generating the Swagger document from declarative CLI structures)
*   **From**: OpenAPI -> Language (Generating CLI routing, flag parsing, and formatting from Swagger)
*   **Presence `[To, From]`**: The object is successfully parsed, validated, utilized, or generated.
*   **Absence `[To, From]`**: The object is currently unsupported, dropped, or falls back to generic/`any` types.
*   **Skipped `[To, From]`**: Intentionally ignored because it is irrelevant or unsupported by the architecture.
*   **Checkboxes**: Mark `[x]` as conformance is achieved.

| Swagger 2.0 Object / Feature | Presence `[To, From]` | Absence `[To, From]` | Skipped `[To, From]` | Notes / Implementation Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **Swagger Object (Root)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Generated via `CliGenerator` and reverse-parsed via `parseGeneratedCliSource` |
| **Swagger Object (`swagger`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Version `"2.0"` recognized and preserved in `document.ts` |
| **Swagger Object (`info`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Program `.name()`, `.description()`, and `.version()` in `cli.ts` |
| **Swagger Object (`host`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Combined into default `--base-url` and `servers.ts` |
| **Swagger Object (`basePath`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Included in default server URL in `servers.ts` |
| **Swagger Object (`schemes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Protocol schemes normalized into `SERVERS` |
| **Swagger Object (`consumes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default request media type |
| **Swagger Object (`produces`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default response media type |
| **Swagger Object (`paths`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Commander subcommands in `cli.ts` and `paths.ts` |
| **Swagger Object (`definitions`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript interfaces in `models/` |
| **Swagger Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable parameters in `parameters.ts` |
| **Swagger Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable responses in `responses.ts` |
| **Swagger Object (`securityDefinitions`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security schemes in `security.ts` |
| **Swagger Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global security requirements in `security.ts` |
| **Swagger Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Command grouping and `tags.ts` |
| **Swagger Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Root external documentation in `document.ts` |
| **Swagger Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Root vendor extensions in `document.ts` |
| **Info Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI help header and `info.ts` |
| **Info Object (`title`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI program name and `API_INFO.title` |
| **Info Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI program `.description()` and `API_INFO.description` |
| **Info Object (`termsOfService`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.termsOfService` in `info.ts` |
| **Info Object (`contact`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact` in `info.ts` |
| **Info Object (`license`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license` in `info.ts` |
| **Info Object (`version`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI program `.version()` and `API_INFO.version` |
| **Info Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Info vendor extensions in `info.ts` |
| **Contact Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact metadata in `info.ts` |
| **Contact Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.name` |
| **Contact Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.url` |
| **Contact Object (`email`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.email` |
| **Contact Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact vendor extensions |
| **License Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | License metadata in `info.ts` |
| **License Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license.name` |
| **License Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license.url` |
| **License Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | License vendor extensions |
| **Paths Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI command registration and `paths.ts` |
| **Paths Object (`/{path}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Mapped to CLI subcommands |
| **Paths Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Paths vendor extensions |
| **Path Item Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operations per URI path |
| **Path Item Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item `$ref` resolution |
| **Path Item Object (`get`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for GET operation |
| **Path Item Object (`put`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for PUT operation |
| **Path Item Object (`post`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for POST operation |
| **Path Item Object (`delete`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for DELETE operation |
| **Path Item Object (`options`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for OPTIONS operation |
| **Path Item Object (`head`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for HEAD operation |
| **Path Item Object (`patch`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI subcommand for PATCH operation |
| **Path Item Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Shared path-level CLI options |
| **Path Item Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item vendor extensions |
| **Operation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Commander `.command()` subcommand definition |
| **Operation Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Target service class selection in CLI action |
| **Operation Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand `.description()` text |
| **Operation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand help description |
| **Operation Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in operation JSDoc `@see` |
| **Operation Object (`operationId`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Subcommand name (`kebab-case`) |
| **Operation Object (`consumes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Request payload encoding |
| **Operation Object (`produces`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response output parsing |
| **Operation Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI `.option()` and `.requiredOption()` flags |
| **Operation Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Stdout JSON formatting and error exit code handling |
| **Operation Object (`schemes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation scheme override |
| **Operation Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Deprecation annotation in service JSDoc |
| **Operation Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security metadata in `security.ts` and `@security` JSDoc |
| **Operation Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation vendor extensions |
| **External Documentation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSDoc `@see` annotation |
| **External Documentation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs description |
| **External Documentation Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs URL |
| **External Documentation Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs vendor extensions |
| **Parameter Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI flags (`--<name> <val>` or `--body <json>`) |
| **Parameter Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Option flag name |
| **Parameter Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `[path]`, `[query]`, `[header]`, `formData`, or `body` |
| **Parameter Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Option help description |
| **Parameter Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `.requiredOption()` vs `.option()` |
| **Parameter Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `--body <json>` payload schema |
| **Parameter Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI argument coercion (`Number`, `Boolean`, `String`) |
| **Parameter Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter format metadata |
| **Parameter Object (`allowEmptyValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `parameters.ts` |
| **Parameter Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array option item type |
| **Parameter Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array option delimiter serialization |
| **Parameter Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default option value |
| **Parameter Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter maximum constraint |
| **Parameter Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter exclusiveMaximum constraint |
| **Parameter Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter minimum constraint |
| **Parameter Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter exclusiveMinimum constraint |
| **Parameter Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter maxLength constraint |
| **Parameter Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter minLength constraint |
| **Parameter Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter pattern constraint |
| **Parameter Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter maxItems constraint |
| **Parameter Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter minItems constraint |
| **Parameter Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter uniqueItems constraint |
| **Parameter Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Allowed option enum values |
| **Parameter Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter multipleOf constraint |
| **Parameter Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter vendor extensions |
| **Items Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array option item definition |
| **Items Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array item primitive type |
| **Items Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array item format |
| **Items Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested array item definition |
| **Items Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested array delimiter |
| **Items Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default array item value |
| **Items Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item maximum constraint |
| **Items Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item exclusiveMaximum constraint |
| **Items Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item minimum constraint |
| **Items Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item exclusiveMinimum constraint |
| **Items Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item maxLength constraint |
| **Items Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item minLength constraint |
| **Items Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item pattern constraint |
| **Items Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item maxItems constraint |
| **Items Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item minItems constraint |
| **Items Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item uniqueItems constraint |
| **Items Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item enum values |
| **Items Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item multipleOf constraint |
| **Items Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Items vendor extensions |
| **Responses Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | CLI stdout JSON printing and exit code handling |
| **Responses Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default response in `responses.ts` |
| **Responses Object (`{HTTP Status Code}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Status code response in `responses.ts` |
| **Responses Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Responses vendor extensions |
| **Response Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `responses.ts` |
| **Response Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response description |
| **Response Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response payload schema |
| **Response Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response headers |
| **Response Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response examples in `examples.ts` |
| **Response Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response vendor extensions |
| **Headers Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response headers map in `headers.ts` |
| **Headers Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named header definition |
| **Example Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `examples.ts` |
| **Example Object (`{mime type}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | MIME-type keyed example |
| **Header Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header definition in `headers.ts` |
| **Header Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header description |
| **Header Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header primitive/array type |
| **Header Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header format |
| **Header Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header array items |
| **Header Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header array delimiter |
| **Header Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header default value |
| **Header Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header maximum constraint |
| **Header Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header exclusiveMaximum constraint |
| **Header Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header minimum constraint |
| **Header Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header exclusiveMinimum constraint |
| **Header Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header maxLength constraint |
| **Header Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header minLength constraint |
| **Header Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header pattern constraint |
| **Header Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header maxItems constraint |
| **Header Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header minItems constraint |
| **Header Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header uniqueItems constraint |
| **Header Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header enum values |
| **Header Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header multipleOf constraint |
| **Header Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header vendor extensions |
| **Tag Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Command grouping and `tags.ts` |
| **Tag Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag name in `tags.ts` |
| **Tag Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag description in `tags.ts` |
| **Tag Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag externalDocs in `tags.ts` |
| **Tag Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag vendor extensions |
| **Reference Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `#/definitions/`, `#/parameters/`, `#/responses/` resolution |
| **Reference Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSON Reference pointer resolution |
| **Schema Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript interfaces in `models/` |
| **Schema Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Referenced model interface |
| **Schema Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@format` JSDoc tag |
| **Schema Object (`title`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Schema title JSDoc |
| **Schema Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface and property JSDoc description |
| **Schema Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@default` JSDoc tag |
| **Schema Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@multipleOf` JSDoc tag |
| **Schema Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@maximum` JSDoc tag |
| **Schema Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@exclusiveMaximum` JSDoc tag |
| **Schema Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@minimum` JSDoc tag |
| **Schema Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@exclusiveMinimum` JSDoc tag |
| **Schema Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@maxLength` JSDoc tag |
| **Schema Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@minLength` JSDoc tag |
| **Schema Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@pattern` JSDoc tag |
| **Schema Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@maxItems` JSDoc tag |
| **Schema Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@minItems` JSDoc tag |
| **Schema Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@uniqueItems` JSDoc tag |
| **Schema Object (`maxProperties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@maxProperties` JSDoc tag |
| **Schema Object (`minProperties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@minProperties` JSDoc tag |
| **Schema Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required vs optional interface properties |
| **Schema Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript `enum` or literal union |
| **Schema Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript type mapping |
| **Schema Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array element type `Array<T>` |
| **Schema Object (`allOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface `extends` composition |
| **Schema Object (`properties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface property members |
| **Schema Object (`additionalProperties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Index signature `[key: string]: T` |
| **Schema Object (`discriminator`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Type guard functions in `discriminators.ts` |
| **Schema Object (`readOnly`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `readonly` property modifier |
| **Schema Object (`xml`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML config in `utils/xml-parser.ts` |
| **Schema Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface `@see` JSDoc tag |
| **Schema Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface/property `@example` JSDoc tag |
| **Schema Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Schema vendor extensions |
| **XML Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML config in `utils/xml-parser.ts` |
| **XML Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML element/attribute name |
| **XML Object (`namespace`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML namespace URI |
| **XML Object (`prefix`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML prefix |
| **XML Object (`attribute`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML attribute flag |
| **XML Object (`wrapped`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML wrapped array flag |
| **XML Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML vendor extensions |
| **Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Generated models in `models/` |
| **Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named model interface in `models/` |
| **Parameters Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `parameters.ts` |
| **Parameters Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named parameter entry in `PARAMETERS` |
| **Responses Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `responses.ts` |
| **Responses Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named response entry in `RESPONSES` |
| **Security Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `security.ts` |
| **Security Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named security scheme in `SECURITY_SCHEMES` |
| **Security Scheme Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `security.ts` and `utils/auth-session.ts` |
| **Security Scheme Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `basic`, `apiKey`, `oauth2` |
| **Security Scheme Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scheme description |
| **Security Scheme Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header or query parameter name |
| **Security Scheme Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `header` or `query` |
| **Security Scheme Object (`flow`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Normalized to OAuth2 `flows` |
| **Security Scheme Object (`authorizationUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 `authorizationUrl` |
| **Security Scheme Object (`tokenUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 `tokenUrl` |
| **Security Scheme Object (`scopes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 `scopes` |
| **Security Scheme Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security scheme vendor extensions |
| **Scopes Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 scopes map in `security.ts` |
| **Scopes Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scope name and description |
| **Scopes Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scopes vendor extensions |
| **Security Requirement Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global `GLOBAL_SECURITY` and method `@security` JSDoc |
| **Security Requirement Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required scheme name and scopes |
