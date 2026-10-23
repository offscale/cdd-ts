# OpenAPI 3.2.0 Conformance Table: Servers (ORM + REST API + Mocks + Tests)

This table tracks the completeness of language integration with OpenAPI 3.2.0 for server-side generation and extraction.

### Legend & Tracking Guide
*   **To**: Language -> OpenAPI (Generating the OpenAPI document from code/types/decorators)
*   **From**: OpenAPI -> Language (Generating server stubs/types/ORM models from the OpenAPI document)
*   **Presence `[To, From]`**: The object is successfully parsed, validated, utilized, or generated.
*   **Absence `[To, From]`**: The object is currently unsupported, dropped, or falls back to generic/`any` types.
*   **Skipped `[To, From]`**: Intentionally ignored because it is irrelevant or unsupported by the server architecture.
*   **Checkboxes**: Mark `[x]` as conformance is achieved.

| OpenAPI 3.2.0 Object / Feature | Presence `[To, From]` | Absence `[To, From]` | Skipped `[To, From]` | Notes / Implementation Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **OpenAPI Object (Root)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Root document initialization (`SwaggerParser` / `SpecWriter`) |
| **OpenAPI Object (`openapi`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Version string `3.2.0` emitted in `document.ts` and `SpecWriter` |
| **OpenAPI Object (`$self`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Base URI resolution for internal and external references |
| **OpenAPI Object (`info`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Extracted and emitted via `InfoGenerator` (`info.ts`) |
| **OpenAPI Object (`jsonSchemaDialect`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validating schemas against explicit JSON Schema drafts |
| **OpenAPI Object (`servers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server definitions parsed and emitted via `ServerGenerator` (`servers.ts`) |
| **OpenAPI Object (`paths`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express route handlers and `paths.ts` metadata generation |
| **OpenAPI Object (`webhooks`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Independent webhook routing / Event subscription dispatch |
| **OpenAPI Object (`components`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable schemas, parameters, responses, headers, and security schemes |
| **OpenAPI Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global security requirements enforced in `middlewares/auth.ts` |
| **OpenAPI Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag metadata parsed and emitted via `TagGenerator` (`tags.ts`) |
| **OpenAPI Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Root external documentation metadata in `document.ts` |
| **Info Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global API Metadata (Title, Version, Description) |
| **Info Object (`title`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server application title and `API_INFO.title` |
| **Info Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global API short summary docstring |
| **Info Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global API description in `API_INFO.description` |
| **Info Object (`termsOfService`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Terms of service URL in `API_INFO.termsOfService` |
| **Info Object (`contact`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact metadata in `API_INFO.contact` |
| **Info Object (`license`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | License metadata in `API_INFO.license` |
| **Info Object (`version`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | API version in `API_INFO.version` |
| **Contact Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Included in generated HTML docs/metadata |
| **Contact Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact name field in `API_INFO.contact.name` |
| **Contact Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact URL field in `API_INFO.contact.url` |
| **Contact Object (`email`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact email field in `API_INFO.contact.email` |
| **License Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Included in generated HTML docs/metadata |
| **License Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | License name field in `API_INFO.license.name` |
| **License Object (`identifier`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server metadata / openapi.json generation |
| **License Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | License URL field in `API_INFO.license.url` |
| **Server Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Base URL generation, Router namespace/prefix mounting |
| **Server Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server URL template in `SERVERS` array |
| **Server Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server description metadata in `SERVERS` array |
| **Server Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server/Router instance naming |
| **Server Object (`variables`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Server URL template variables map |
| **Server Variable Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Dynamic route prefix validation / Enum injection |
| **Server Variable Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Allowed enum values for server URL variables |
| **Server Variable Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default fallback value in `resolveServerUrl` |
| **Server Variable Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Variable description in `SERVERS` metadata |
| **Components Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Container for reusable ORM models, DTOs, Handlers |
| **Components Object (`schemas`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript interfaces (`models/`) and TypeORM entities |
| **Components Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable response definitions in `responses.ts` |
| **Components Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable parameter definitions in `parameters.ts` |
| **Components Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable example definitions in `examples.ts` |
| **Components Object (`requestBodies`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable request body definitions in `request-bodies.ts` |
| **Components Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable header definitions in `headers.ts` |
| **Components Object (`securitySchemes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security scheme definitions in `security.ts` and `middlewares/auth.ts` |
| **Components Object (`links`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable link definitions in `links.ts` |
| **Components Object (`callbacks`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable callback definitions in `callbacks.ts` |
| **Components Object (`pathItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable router mounting blocks (`path-items.ts`) |
| **Components Object (`mediaTypes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable content negotiation blocks (`media-types.ts`) |
| **Paths Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Core router mounting and path mapping |
| **Paths Object (`/{path}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express route path registration and `PATHS` metadata |
| **Path Item Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Grouping endpoints by URI / Route-level parameters |
| **Path Item Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item reference resolution via `SwaggerParser` |
| **Path Item Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path-level summary preserved in `paths.ts` |
| **Path Item Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path-level description preserved in `paths.ts` |
| **Path Item Object (`get`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.get()` handler generation and AST parsing |
| **Path Item Object (`put`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.put()` handler generation and AST parsing |
| **Path Item Object (`post`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.post()` handler generation and AST parsing |
| **Path Item Object (`delete`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.delete()` handler generation and AST parsing |
| **Path Item Object (`options`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.options()` handler generation and AST parsing |
| **Path Item Object (`head`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.head()` handler generation and AST parsing |
| **Path Item Object (`patch`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.patch()` handler generation and AST parsing |
| **Path Item Object (`trace`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.trace()` handler generation and AST parsing |
| **Path Item Object (`query`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | QUERY HTTP method handler binding |
| **Path Item Object (`additionalOperations`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Custom HTTP method handler bindings |
| **Path Item Object (`servers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path-level server overrides in `paths.ts` |
| **Path Item Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path-level shared parameters merged into operations |
| **Operation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Individual Controller/Handler method bindings |
| **Operation Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Controller/service grouping by operation tags |
| **Operation Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler JSDoc summary annotation |
| **Operation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler JSDoc description annotation |
| **Operation Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler JSDoc `@see` external documentation tag |
| **Operation Object (`operationId`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Controller method naming and `@operationId` JSDoc tag |
| **Operation Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Request parameter extraction (`req.params`, `req.query`, `req.headers`) |
| **Operation Object (`requestBody`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Request payload validation (`middlewares/validation.ts`) and `req.body` typing |
| **Operation Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Status code response serialization and mock generation |
| **Operation Object (`callbacks`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Outbound callback handler types in `callbacks.ts` |
| **Operation Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler JSDoc `@deprecated` annotation |
| **Operation Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation-specific security requirements in `middlewares/auth.ts` |
| **Operation Object (`servers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation-level server overrides |
| **External Documentation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Javadoc/Docstring generation or extraction |
| **External Documentation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External documentation description text |
| **External Documentation Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External documentation target URL |
| **Parameter Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parsed via `analyzeParameters` and emitted in routes/metadata |
| **Parameter Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter identifier mapping |
| **Parameter Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter location (`path`, `query`, `header`, `cookie`, `querystring`) |
| **Parameter Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter `@param` JSDoc description |
| **Parameter Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Non-optional TypeScript parameter and validation check |
| **Parameter Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter deprecation metadata |
| **Parameter Object (`allowEmptyValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Empty value allowance in query parameter serializer |
| **Parameter Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter single example value |
| **Parameter Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter named examples map |
| **Parameter Object (`style`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | RFC 6570 style serialization (`form`, `simple`, `matrix`, `label`, etc.) |
| **Parameter Object (`explode`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Collection/object explode flag in parameter serializer |
| **Parameter Object (`allowReserved`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Unescaped reserved character handling in query serializer |
| **Parameter Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter TypeScript type conversion via `TypeConverter` |
| **Parameter Object (`content`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Media-type specific parameter serialization |
| **Request Body Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Payload parsing, ORM hydration, and validation limits |
| **Request Body Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Request body `@param body` JSDoc description |
| **Request Body Object (`content`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Media-type map for request payloads (`application/json`, `multipart/form-data`, etc.) |
| **Request Body Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required body validation in `middlewares/validation.ts` |
| **Media Type Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Content negotiation & Content-Type specific routing |
| **Media Type Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Payload schema type and validation rules |
| **Media Type Object (`itemSchema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validation middleware for sequential payload elements |
| **Media Type Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Media-type mock response example |
| **Media Type Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Media-type named mock examples |
| **Media Type Object (`encoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Property-based multipart/form-data encoding map |
| **Media Type Object (`prefixEncoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Positional multipart prefix encoding array |
| **Media Type Object (`itemEncoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Streaming item encoding metadata |
| **Encoding Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handling multipart/form-data boundary & URL-encoded arrays |
| **Encoding Object (`contentType`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Part-specific `Content-Type` header |
| **Encoding Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Part-specific custom headers map |
| **Encoding Object (`encoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested multipart property encoding |
| **Encoding Object (`prefixEncoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested positional prefix encoding |
| **Encoding Object (`itemEncoding`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested item encoding |
| **Encoding Object (`style`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Form field serialization style |
| **Encoding Object (`explode`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Form field explode flag |
| **Encoding Object (`allowReserved`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Form field reserved character flag |
| **Responses Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Status code mapping (200, 4xx) & default fallback handlers |
| **Responses Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Fallback response definition |
| **Responses Object (`HTTP Status Code`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Explicit HTTP status code response mapping |
| **Response Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Outgoing DTO serialization & header formatting |
| **Response Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Docstring generation for handler responses |
| **Response Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response `@returns` JSDoc description |
| **Response Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Outgoing response header definitions |
| **Response Object (`content`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response media type and schema mapping |
| **Response Object (`links`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response HATEOAS links in `links.ts` |
| **Callback Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Async out-of-band webhook dispatchers |
| **Callback Object (`{expression}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Runtime expression key in `callbacks.ts` |
| **Example Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Generating mock server endpoints / Test fixtures |
| **Example Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Example summary in `examples.ts` |
| **Example Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Example description in `examples.ts` |
| **Example Object (`dataValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAS 3.2 structured `dataValue` in `examples.ts` |
| **Example Object (`serializedValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAS 3.2 wire-formatted `serializedValue` in `examples.ts` |
| **Example Object (`externalValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External example URI reference in `examples.ts` |
| **Example Object (`value`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Embedded example payload value in `examples.ts` |
| **Link Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HATEOAS / Relation mapping generation for APIs |
| **Link Object (`operationRef`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Target operation URI reference in `links.ts` |
| **Link Object (`operationId`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Target operation identifier in `links.ts` |
| **Link Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Runtime expression parameter bindings in `links.ts` |
| **Link Object (`requestBody`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Runtime expression request body in `links.ts` |
| **Link Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Link description metadata in `links.ts` |
| **Link Object (`server`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Link target server override in `links.ts` |
| **Header Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Setting strongly-typed response headers (e.g. X-RateLimit) |
| **Header Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header description in `headers.ts` |
| **Header Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required header validation flag |
| **Header Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header deprecation flag |
| **Header Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header example value |
| **Header Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header named examples map |
| **Header Object (`style`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header serialization style (`simple`) |
| **Header Object (`explode`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header explode serialization flag |
| **Header Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header value schema definition |
| **Header Object (`content`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header media-type content map |
| **Tag Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Controller grouping, Namespace generation |
| **Tag Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag identifier in `tags.ts` |
| **Tag Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAS 3.2 tag short summary in `tags.ts` |
| **Tag Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag description in `tags.ts` |
| **Tag Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag external documentation in `tags.ts` |
| **Tag Object (`parent`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Controller inheritance / nested routers |
| **Tag Object (`kind`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Controller categorization metadata |
| **Reference Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSON Reference resolution across components |
| **Reference Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Internal component resolution & circular dependency cycles |
| **Reference Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reference summary override |
| **Reference Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reference description override |
| **Schema Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSON Schema Draft 2020-12 / OAS 3.2 schema modeling |
| **Schema Object (`discriminator`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Discriminator union type guards (`discriminators.ts`) |
| **Schema Object (`xml`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML serialization metadata (`utils/xml-parser.ts`) |
| **Schema Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Schema JSDoc `@see` annotation |
| **Schema Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Schema JSDoc `@example` annotation and mock seeding |
| **Discriminator Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Polymorphism / Single Table Inheritance ORM parsing |
| **Discriminator Object (`propertyName`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Discriminator tag property name |
| **Discriminator Object (`mapping`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Explicit discriminator value-to-schema mapping |
| **Discriminator Object (`defaultMapping`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Fallback STI mapping in ORM when missing type |
| **XML Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML DOM serialization/deserialization |
| **XML Object (`nodeType`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML deserialization binding rules (attribute/element) |
| **XML Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML element or attribute tag name |
| **XML Object (`namespace`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML namespace URI |
| **XML Object (`prefix`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML tag namespace prefix |
| **XML Object (`attribute`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Legacy XML attribute flag |
| **XML Object (`wrapped`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Legacy XML array wrapper flag |
| **Security Scheme Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security schemes in `security.ts` and `middlewares/auth.ts` |
| **Security Scheme Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scheme type (`apiKey`, `http`, `mutualTLS`, `oauth2`, `openIdConnect`) |
| **Security Scheme Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security scheme description |
| **Security Scheme Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header, query, or cookie API key parameter name |
| **Security Scheme Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | API key location (`header`, `query`, `cookie`) |
| **Security Scheme Object (`scheme`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP auth scheme (`bearer`, `basic`, etc.) |
| **Security Scheme Object (`bearerFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Bearer token format hint (e.g. `JWT`) |
| **Security Scheme Object (`flows`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 flows configuration object |
| **Security Scheme Object (`openIdConnectUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OpenID Connect discovery URL |
| **Security Scheme Object (`oauth2MetadataUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 metadata discovery |
| **Security Scheme Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security scheme deprecation flag |
| **OAuth Flows Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Registering endpoints for supported grant types |
| **OAuth Flows Object (`implicit`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 implicit flow configuration |
| **OAuth Flows Object (`password`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 resource owner password flow configuration |
| **OAuth Flows Object (`clientCredentials`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 client credentials flow configuration |
| **OAuth Flows Object (`authorizationCode`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 authorization code flow configuration |
| **OAuth Flows Object (`deviceAuthorization`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Support for the Device Authorization grant flow |
| **OAuth Flow Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Extracting flow metadata (auth URL, token URL, scopes) |
| **OAuth Flow Object (`authorizationUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 authorization endpoint URL |
| **OAuth Flow Object (`deviceAuthorizationUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Routing for issuing device codes |
| **OAuth Flow Object (`tokenUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 token endpoint URL |
| **OAuth Flow Object (`refreshUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 refresh token endpoint URL |
| **OAuth Flow Object (`scopes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Available OAuth2 permission scopes map |
| **Security Requirement Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Enforcing endpoint-level combinations (AND/OR auth logic) |
| **Security Requirement Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scheme name mapped to required scope list |
