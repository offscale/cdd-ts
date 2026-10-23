# Swagger 2.0 Conformance Table: Servers (ORM + REST API + Mocks + Tests)

This table tracks the completeness of language integration with Swagger 2.0 for server-side generation and extraction.

### Legend & Tracking Guide
*   **To**: Language -> OpenAPI (Generating the Swagger document from code/types/decorators)
*   **From**: OpenAPI -> Language (Generating server stubs/types/ORM models from the Swagger document)
*   **Presence `[To, From]`**: The object is successfully parsed, validated, utilized, or generated.
*   **Absence `[To, From]`**: The object is currently unsupported, dropped, or falls back to generic/`any` types.
*   **Skipped `[To, From]`**: Intentionally ignored because it is irrelevant or unsupported by the architecture.
*   **Checkboxes**: Mark `[x]` as conformance is achieved.

| Swagger 2.0 Object / Feature | Presence `[To, From]` | Absence `[To, From]` | Skipped `[To, From]` | Notes / Implementation Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **Swagger Object (Root)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Normalized via `SwaggerParser` and emitted via `SpecWriter` |
| **Swagger Object (`swagger`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Version `"2.0"` recognized in `SwaggerParser` and emitted in `document.ts` |
| **Swagger Object (`info`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global API metadata in `info.ts` (`API_INFO`) |
| **Swagger Object (`host`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Normalized into `SERVERS` URL in `servers.ts` |
| **Swagger Object (`basePath`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Normalized into server URL prefix and Express router mount |
| **Swagger Object (`schemes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Protocol schemes (`http`, `https`, `ws`, `wss`) normalized into `SERVERS` |
| **Swagger Object (`consumes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default request content types normalized into operation requestBody |
| **Swagger Object (`produces`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default response content types normalized into operation responses |
| **Swagger Object (`paths`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express route handlers and `paths.ts` metadata |
| **Swagger Object (`definitions`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Normalized to `schemas` and emitted as `models/` interfaces and TypeORM entities |
| **Swagger Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable parameters emitted in `parameters.ts` |
| **Swagger Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable responses emitted in `responses.ts` |
| **Swagger Object (`securityDefinitions`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Normalized into `SECURITY_SCHEMES` in `security.ts` and `middlewares/auth.ts` |
| **Swagger Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global security requirements in `security.ts` and `middlewares/auth.ts` |
| **Swagger Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Controller grouping and `tags.ts` metadata |
| **Swagger Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Root external documentation in `document.ts` |
| **Swagger Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Specification extensions preserved in `document.ts` and snapshot |
| **Info Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `info.ts` and extracted by `InfoMetadataParser` |
| **Info Object (`title`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.title` |
| **Info Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.description` |
| **Info Object (`termsOfService`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.termsOfService` |
| **Info Object (`contact`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact` |
| **Info Object (`license`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license` |
| **Info Object (`version`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.version` |
| **Info Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Info vendor extensions preserved in `API_INFO` |
| **Contact Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact metadata in `info.ts` |
| **Contact Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.name` |
| **Contact Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.url` |
| **Contact Object (`email`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.email` |
| **Contact Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact vendor extensions preserved in `API_INFO.contact` |
| **License Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | License metadata in `info.ts` |
| **License Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license.name` |
| **License Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license.url` |
| **License Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | License vendor extensions preserved in `API_INFO.license` |
| **Paths Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express route mounting and `paths.ts` |
| **Paths Object (`/{path}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Route path template registration |
| **Paths Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Paths vendor extensions preserved in `paths.ts` |
| **Path Item Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Grouping HTTP methods and shared parameters by URI |
| **Path Item Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External/internal path item `$ref` resolution |
| **Path Item Object (`get`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.get()` handler generation |
| **Path Item Object (`put`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.put()` handler generation |
| **Path Item Object (`post`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.post()` handler generation |
| **Path Item Object (`delete`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.delete()` handler generation |
| **Path Item Object (`options`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.options()` handler generation |
| **Path Item Object (`head`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.head()` handler generation |
| **Path Item Object (`patch`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Express `router.patch()` handler generation |
| **Path Item Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path-level parameters inherited by operations |
| **Path Item Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item vendor extensions preserved in `paths.ts` |
| **Operation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Route handler and controller method generation |
| **Operation Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Controller/service grouping by tag |
| **Operation Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler JSDoc summary |
| **Operation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler JSDoc description |
| **Operation Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler JSDoc `@see` annotation |
| **Operation Object (`operationId`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler method name and `@operationId` JSDoc tag |
| **Operation Object (`consumes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation-specific request content-type negotiation |
| **Operation Object (`produces`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation-specific response content-type serialization |
| **Operation Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path, query, header, body, and formData parameters |
| **Operation Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Status code response mapping and mock payload generation |
| **Operation Object (`schemes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation-level protocol overrides |
| **Operation Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Handler JSDoc `@deprecated` annotation |
| **Operation Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Per-endpoint auth validation in `middlewares/auth.ts` |
| **Operation Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation vendor extensions preserved in JSDoc / metadata |
| **External Documentation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSDoc `@see` generation and extraction |
| **External Documentation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External documentation description |
| **External Documentation Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External documentation URL |
| **External Documentation Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs vendor extensions |
| **Parameter Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Normalized via `analyzeParameters` and `analyzeRequestBody` |
| **Parameter Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter name in `req.params`, `req.query`, `req.headers`, or `req.body` |
| **Parameter Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Supports `query`, `header`, `path`, `formData`, and `body` |
| **Parameter Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter JSDoc `@param` description |
| **Parameter Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required validation in `middlewares/validation.ts` |
| **Parameter Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Body parameter schema normalized to requestBody |
| **Parameter Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Non-body parameter primitive/array/file type |
| **Parameter Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter format (`int32`, `int64`, `float`, `double`, `date-time`, etc.) |
| **Parameter Object (`allowEmptyValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Query/formData empty value support |
| **Parameter Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array parameter item schema |
| **Parameter Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array serialization format (`csv`, `ssv`, `tsv`, `pipes`, `multi`) |
| **Parameter Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default parameter value |
| **Parameter Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Numeric upper bound validation |
| **Parameter Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Exclusive numeric upper bound validation |
| **Parameter Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Numeric lower bound validation |
| **Parameter Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Exclusive numeric lower bound validation |
| **Parameter Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | String maximum length validation |
| **Parameter Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | String minimum length validation |
| **Parameter Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Regex pattern validation |
| **Parameter Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array maximum items validation |
| **Parameter Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array minimum items validation |
| **Parameter Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Set uniqueness validation |
| **Parameter Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Allowed enum values validation |
| **Parameter Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Numeric divisor validation |
| **Parameter Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter vendor extensions |
| **Items Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array item type conversion and validation |
| **Items Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item primitive or nested array type |
| **Items Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item format specifier |
| **Items Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested multi-dimensional array items |
| **Items Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested array delimiter format |
| **Items Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default item value |
| **Items Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item maximum constraint |
| **Items Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item exclusiveMaximum constraint |
| **Items Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item minimum constraint |
| **Items Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item exclusiveMinimum constraint |
| **Items Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item maxLength constraint |
| **Items Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item minLength constraint |
| **Items Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item regex pattern constraint |
| **Items Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested array maxItems constraint |
| **Items Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested array minItems constraint |
| **Items Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested array uniqueItems constraint |
| **Items Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item enum values |
| **Items Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Item multipleOf constraint |
| **Items Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Items vendor extensions |
| **Responses Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Status code response map in routes and `responses.ts` |
| **Responses Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default fallback response handler |
| **Responses Object (`{HTTP Status Code}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Explicit HTTP status code response |
| **Responses Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Responses vendor extensions |
| **Response Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response payload typing and mock generation |
| **Response Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response JSDoc `@returns` description |
| **Response Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response body schema normalized to `content` |
| **Response Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response headers in `responses.ts` |
| **Response Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response MIME-keyed examples in `examples.ts` |
| **Response Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response vendor extensions |
| **Headers Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response header map in `headers.ts` |
| **Headers Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named response header definition |
| **Example Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Mock server response payload fixtures |
| **Example Object (`{mime type}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | MIME-type keyed example payload |
| **Header Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Typed response header metadata in `headers.ts` |
| **Header Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header description |
| **Header Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header value type (`string`, `number`, `integer`, `boolean`, `array`) |
| **Header Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header value format |
| **Header Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header array item definition |
| **Header Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header array delimiter format |
| **Header Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default header value |
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
| **Tag Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Controller grouping and `tags.ts` |
| **Tag Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag identifier |
| **Tag Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag description |
| **Tag Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag external documentation |
| **Tag Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag vendor extensions |
| **Reference Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `#/definitions/`, `#/parameters/`, `#/responses/` resolution |
| **Reference Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSON Reference pointer resolution |
| **Schema Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript interfaces (`models/`), TypeORM entities, and validation rules |
| **Schema Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Referenced model type resolution |
| **Schema Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Column type and `@format` JSDoc constraint |
| **Schema Object (`title`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Schema title JSDoc |
| **Schema Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface and property JSDoc description |
| **Schema Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default column value and `@default` JSDoc |
| **Schema Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validation middleware and `@multipleOf` JSDoc |
| **Schema Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validation middleware and `@maximum` JSDoc |
| **Schema Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validation middleware and `@exclusiveMaximum` JSDoc |
| **Schema Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validation middleware and `@minimum` JSDoc |
| **Schema Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validation middleware and `@exclusiveMinimum` JSDoc |
| **Schema Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | VARCHAR length, validation middleware, and `@maxLength` JSDoc |
| **Schema Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Validation middleware and `@minLength` JSDoc |
| **Schema Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Regex validation middleware and `@pattern` JSDoc |
| **Schema Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array validation and `@maxItems` JSDoc |
| **Schema Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array validation and `@minItems` JSDoc |
| **Schema Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array uniqueness validation and `@uniqueItems` JSDoc |
| **Schema Object (`maxProperties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Object property count constraint |
| **Schema Object (`minProperties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Object minimum property count constraint |
| **Schema Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Non-optional interface properties and non-nullable ORM columns |
| **Schema Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript `enum` / union generation (`emit_enums.ts`) |
| **Schema Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Primitive, array, or object type mapping |
| **Schema Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array element type mapping |
| **Schema Object (`allOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface inheritance (`extends`) and composition |
| **Schema Object (`properties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface property declarations and TypeORM `@Column()` fields |
| **Schema Object (`additionalProperties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Index signature `[key: string]: T` generation |
| **Schema Object (`discriminator`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Polymorphic discriminator type guards (`discriminators.ts`) |
| **Schema Object (`readOnly`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `readonly` property modifier on generated interfaces |
| **Schema Object (`xml`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML serialization metadata (`utils/xml-parser.ts`) |
| **Schema Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSDoc `@see` annotation on interfaces |
| **Schema Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSDoc `@example` annotation and mock seeder values |
| **Schema Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Schema vendor extensions |
| **XML Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML parser and serializer configuration (`utils/xml-parser.ts`) |
| **XML Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Custom XML element/attribute tag name |
| **XML Object (`namespace`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML namespace URI |
| **XML Object (`prefix`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML tag prefix |
| **XML Object (`attribute`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Serialize property as XML attribute |
| **XML Object (`wrapped`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Wrap array elements in enclosing XML tag |
| **XML Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML vendor extensions |
| **Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable data models (`#/definitions/{name}`) |
| **Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named model interface in `models/` |
| **Parameters Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable parameter dictionary in `parameters.ts` |
| **Parameters Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named reusable parameter entry |
| **Responses Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable response dictionary in `responses.ts` |
| **Responses Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named reusable response entry |
| **Security Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security scheme dictionary in `security.ts` |
| **Security Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named security scheme definition |
| **Security Scheme Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Enforced in `middlewares/auth.ts` and emitted in `security.ts` |
| **Security Scheme Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Supports `basic`, `apiKey`, and `oauth2` |
| **Security Scheme Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security scheme description |
| **Security Scheme Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header or query parameter name for `apiKey` |
| **Security Scheme Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | API key location (`query` or `header`) |
| **Security Scheme Object (`flow`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 flow (`implicit`, `password`, `application`, `accessCode`) |
| **Security Scheme Object (`authorizationUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 authorization URL |
| **Security Scheme Object (`tokenUrl`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 token URL |
| **Security Scheme Object (`scopes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 scopes map |
| **Security Scheme Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security scheme vendor extensions |
| **Scopes Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | OAuth2 scope descriptions dictionary |
| **Scopes Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named OAuth2 scope entry |
| **Scopes Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Scopes vendor extensions |
| **Security Requirement Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global and operation-level security requirement evaluation |
| **Security Requirement Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required scheme and scope list |
