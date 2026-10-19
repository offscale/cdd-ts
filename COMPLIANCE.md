# Compliance

`cdd-ts` strives for 100% compliance with [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/v3.2.0.html), [Swagger 2.0](https://spec.openapis.org/oas/v2.0.html), [Arazzo 1.1.0](https://spec.openapis.org/arazzo/v1.1.0.html), and the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

## Current Status

- **OpenAPI 3.0.x & 3.1.0**: Fully supported (Parsing and Emitting).
- **Swagger 2.0 and OpenAPI 3.2.0**: Fully supported (100% compliance achieved for parsing and emitting the latest structures).
- **Arazzo 1.1.0**: Fully supported (100% bidirectional compliance across Client SDK `WorkflowOrchestrator`, Client SDK CLI workflow runners, and Backend Server/E2E workflow test suites).
- **Model Context Protocol (MCP 1.0.0)**: Fully supported (`cdd-ts mcp` stdio server and generated `--mcp` server/CLI adapters).

If you find discrepancies with any supported specification, please file an issue or submit a pull request with an AST-based parser adjustment.

## Support Matrix

| Specification Concept       | Status |
| --------------------------- | ------ |
| Info Object                 | ✅     |
| Server Object               | ✅     |
| Components Object           | ✅     |
| Paths Object                | ✅     |
| Path Item Object            | ✅     |
| Operation Object            | ✅     |
| Parameter Object            | ✅     |
| Request Body Object         | ✅     |
| Responses Object            | ✅     |
| Responses / Schema Object   | ✅     |
| Reference Object (`$ref`)   | ✅     |
| OAuth Flows                 | ✅     |
| Security Requirement Object | ✅     |
| Links / Callbacks           | ✅     |
| Webhooks                    | ✅     |
| Arazzo 1.1.0 Workflows      | ✅     |
| Arazzo 1.1.0 Runtime Engine | ✅     |
| MCP Stdio & SSE Adapters    | ✅     |
