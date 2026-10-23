# Swagger 2.0 Conformance Table: Client SDK (HTTP Client + Mocks + Tests)

This table tracks the completeness of language integration with Swagger 2.0 for Client SDK generation and extraction.

### Legend & Tracking Guide
*   **To**: Language -> OpenAPI (Generating the Swagger document from strongly typed client SDKs)
*   **From**: OpenAPI -> Language (Generating HTTP Client code, interfaces, and methods from the Swagger document)
*   **Presence `[To, From]`**: The object is successfully parsed, validated, utilized, or generated.
*   **Absence `[To, From]`**: The object is currently unsupported, dropped, or falls back to generic/`any` types.
*   **Skipped `[To, From]`**: Intentionally ignored because it is irrelevant or unsupported by the architecture.
*   **Checkboxes**: Mark `[x]` as conformance is achieved.

| Swagger 2.0 Object / Feature | Presence `[To, From]` | Absence `[To, From]` | Skipped `[To, From]` | Notes / Implementation Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **Swagger Object (Root)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parsed via `SwaggerParser` and reverse-extracted via `ServiceParser` / `SpecWriter` |
| **Swagger Object (`swagger`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Version `"2.0"` recognized and preserved in `document.ts` |
| **Swagger Object (`info`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `info.ts` (`API_INFO`) |
| **Swagger Object (`host`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Combined with `schemes` and `basePath` into `SERVERS` in `servers.ts` |
| **Swagger Object (`basePath`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Included in default `basePath` of generated SDK service classes |
| **Swagger Object (`schemes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Protocol schemes normalized into `SERVERS` entries |
| **Swagger Object (`consumes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default `Content-Type` header for SDK request methods |
| **Swagger Object (`produces`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default response media type deserialization |
| **Swagger Object (`paths`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Generated SDK methods in `services/*.service.ts` and `paths.ts` |
| **Swagger Object (`definitions`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Generated TypeScript interfaces and enums in `models/` |
| **Swagger Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable parameters in `parameters.ts` |
| **Swagger Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Reusable responses in `responses.ts` |
| **Swagger Object (`securityDefinitions`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `security.ts` and supported by `SdkAuthClient` |
| **Swagger Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Global security requirements in `security.ts` |
| **Swagger Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service class grouping and `tags.ts` |
| **Swagger Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Root external documentation in `document.ts` |
| **Swagger Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Vendor extensions preserved in `document.ts` and snapshot |
| **Info Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | SDK metadata in `info.ts` |
| **Info Object (`title`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.title` |
| **Info Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.description` |
| **Info Object (`termsOfService`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.termsOfService` |
| **Info Object (`contact`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact` |
| **Info Object (`license`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license` |
| **Info Object (`version`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.version` |
| **Info Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Info vendor extensions in `API_INFO` |
| **Contact Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact` in `info.ts` |
| **Contact Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.name` |
| **Contact Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.url` |
| **Contact Object (`email`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.contact.email` |
| **Contact Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Contact vendor extensions |
| **License Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license` in `info.ts` |
| **License Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license.name` |
| **License Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `API_INFO.license.url` |
| **License Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | License vendor extensions |
| **Paths Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Mapped to service methods and `paths.ts` |
| **Paths Object (`/{path}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | URL path interpolation in service methods |
| **Paths Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Paths vendor extensions in `paths.ts` |
| **Path Item Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operations and shared parameters per path |
| **Path Item Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item `$ref` resolution |
| **Path Item Object (`get`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP GET service method |
| **Path Item Object (`put`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP PUT service method |
| **Path Item Object (`post`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP POST service method |
| **Path Item Object (`delete`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP DELETE service method |
| **Path Item Object (`options`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP OPTIONS service method |
| **Path Item Object (`head`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP HEAD service method |
| **Path Item Object (`patch`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | HTTP PATCH service method |
| **Path Item Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Shared path-level parameters merged into service methods |
| **Path Item Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Path item vendor extensions |
| **Operation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Generated SDK service method and unit test |
| **Operation Object (`tags`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service class assignment (`<Tag>Service`) |
| **Operation Object (`summary`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service method JSDoc summary |
| **Operation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service method JSDoc description |
| **Operation Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service method JSDoc `@see` |
| **Operation Object (`operationId`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service method name and `@operationId` JSDoc tag |
| **Operation Object (`consumes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Request `Content-Type` header selection |
| **Operation Object (`produces`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response parsing strategy |
| **Operation Object (`parameters`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Typed method arguments and serialization |
| **Operation Object (`responses`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Return type union and `@returns` / `@throws` JSDoc |
| **Operation Object (`schemes`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation-specific server protocol |
| **Operation Object (`deprecated`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service method `@deprecated` JSDoc tag |
| **Operation Object (`security`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@security` JSDoc tag and automatic auth header injection |
| **Operation Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Operation vendor extensions |
| **External Documentation Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSDoc `@see` annotation |
| **External Documentation Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs description |
| **External Documentation Object (`url`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs URL |
| **External Documentation Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | External docs vendor extensions |
| **Parameter Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Serialized via `utils/parameter-serializer.ts` or `FormData` |
| **Parameter Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Method argument name and serialized parameter key |
| **Parameter Object (`in`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Supports `path`, `query`, `header`, `formData`, and `body` |
| **Parameter Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | JSDoc `@param` description |
| **Parameter Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required vs optional TypeScript parameter |
| **Parameter Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Body parameter TypeScript type |
| **Parameter Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Non-body parameter TypeScript type (`string`, `number`, `boolean`, `Blob`, array) |
| **Parameter Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Format hint preserved in JSDoc |
| **Parameter Object (`allowEmptyValue`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Preserved in `parameters.ts` |
| **Parameter Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array parameter element type |
| **Parameter Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Mapped to style/explode in `utils/parameter-serializer.ts` |
| **Parameter Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default parameter metadata |
| **Parameter Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Literal union parameter type |
| **Parameter Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Constraint preserved in `parameters.ts` |
| **Parameter Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Parameter vendor extensions |
| **Items Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array parameter/header item type conversion |
| **Items Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element type (`Array<string>`, `Array<number>`, `Array<boolean>`) |
| **Items Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element format metadata |
| **Items Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested array element type (`Array<Array<T>>`) |
| **Items Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Nested array delimiter serialization |
| **Items Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Default element value |
| **Items Object (`maximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element maximum metadata |
| **Items Object (`exclusiveMaximum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element exclusiveMaximum metadata |
| **Items Object (`minimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element minimum metadata |
| **Items Object (`exclusiveMinimum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element exclusiveMinimum metadata |
| **Items Object (`maxLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element maxLength metadata |
| **Items Object (`minLength`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element minLength metadata |
| **Items Object (`pattern`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element pattern metadata |
| **Items Object (`maxItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element maxItems metadata |
| **Items Object (`minItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element minItems metadata |
| **Items Object (`uniqueItems`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element uniqueItems metadata |
| **Items Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element literal union type |
| **Items Object (`multipleOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Element multipleOf metadata |
| **Items Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Items vendor extensions |
| **Responses Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Analyzed via `analyzeResponses` for method return types |
| **Responses Object (`default`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Fallback response type and `@throws` JSDoc |
| **Responses Object (`{HTTP Status Code}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Status code return type and error metadata |
| **Responses Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Responses vendor extensions |
| **Response Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Typed response return value and `responses.ts` metadata |
| **Response Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@returns` and `@throws` JSDoc description |
| **Response Object (`schema`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Converted to method return type via `TypeConverter` |
| **Response Object (`headers`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response headers in `responses.ts` |
| **Response Object (`examples`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Mock response fixtures in generated unit tests |
| **Response Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response vendor extensions |
| **Headers Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Response header map in `headers.ts` and `responses.ts` |
| **Headers Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named response header |
| **Example Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `examples.ts` and service unit tests |
| **Example Object (`{mime type}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | MIME-keyed example payload |
| **Header Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `headers.ts` |
| **Header Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header description |
| **Header Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header primitive/array type |
| **Header Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header format |
| **Header Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header array items |
| **Header Object (`collectionFormat`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Header array collectionFormat |
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
| **Tag Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Service class grouping and `tags.ts` |
| **Tag Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag name in `tags.ts` |
| **Tag Object (`description`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag description in `tags.ts` |
| **Tag Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag externalDocs in `tags.ts` |
| **Tag Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Tag vendor extensions |
| **Reference Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `#/definitions/`, `#/parameters/`, `#/responses/` resolution |
| **Reference Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Resolved to TypeScript model imports |
| **Schema Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted via `InterfaceGenerator` / `EnumGenerator` and parsed via `InterfaceParser` |
| **Schema Object (`$ref`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Type reference and import declaration |
| **Schema Object (`format`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `@format` JSDoc tag on interface property |
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
| **Schema Object (`required`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Required vs optional (`?`) interface properties |
| **Schema Object (`enum`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript `enum` or literal union |
| **Schema Object (`type`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | TypeScript type mapping (`string`, `number`, `boolean`, `Record`, array) |
| **Schema Object (`items`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Array element type `Array<T>` |
| **Schema Object (`allOf`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface `extends` and intersection types |
| **Schema Object (`properties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface property members |
| **Schema Object (`additionalProperties`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Index signature `[key: string]: T` |
| **Schema Object (`discriminator`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Type guard functions in `discriminators.ts` |
| **Schema Object (`readOnly`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | `readonly` modifier on interface properties |
| **Schema Object (`xml`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML config in `utils/xml-parser.ts` |
| **Schema Object (`externalDocs`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface `@see` JSDoc tag |
| **Schema Object (`example`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Interface/property `@example` JSDoc tag |
| **Schema Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Schema vendor extensions |
| **XML Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML DOM parser/serializer (`utils/xml-parser.ts`) |
| **XML Object (`name`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML element/attribute name |
| **XML Object (`namespace`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML namespace URI |
| **XML Object (`prefix`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML namespace prefix |
| **XML Object (`attribute`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML attribute flag |
| **XML Object (`wrapped`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML wrapped array flag |
| **XML Object (`^x-`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | XML vendor extensions |
| **Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Generated models in `models/` |
| **Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Individual model file in `models/` |
| **Parameters Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `parameters.ts` |
| **Parameters Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named parameter entry in `PARAMETERS` |
| **Responses Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `responses.ts` |
| **Responses Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named response entry in `RESPONSES` |
| **Security Definitions Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Emitted in `security.ts` |
| **Security Definitions Object (`{name}`)** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Named security scheme in `SECURITY_SCHEMES` |
| **Security Scheme Object** | `[x]` , `[x]` | `[x]` , `[x]` | `[x]` , `[x]` | Security scheme metadata and `SdkAuthClient` |
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
