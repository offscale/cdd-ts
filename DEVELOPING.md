# Developing cdd-ts

## Setup Environment

1. Ensure you have **Node.js** 18 or later.
2. Install dependencies:
    ```bash
    npm install
    ```
3. Build the CLI and programmatic SDK:
    ```bash
    npm run build
    ```

## Architecture Map

- `src/openapi/parse.ts` - Entrypoint for parsing OpenAPI JSON/YAML to IR.
- `src/arazzo/` - Parsers, validators, and emitters (`to_sdk`, `to_sdk_cli`, `to_server`, `to_arazzo`) for Arazzo 1.1.0 workflows.
- `src/core/server/` - Core abstraction for generating Server Frameworks.
- `src/core/orm/` - Core abstraction for parsing/generating ORMs.
- `src/vendors/angular/` - Emitters for Angular (`HttpClient`, Reactive Forms, Admin UI).
- `src/vendors/react/` - Emitters for React hooks and components.
- `src/vendors/vue/` - Emitters for Vue 3 composables.
- `src/vendors/fetch/` - Emitters for native `fetch`.
- `src/vendors/axios/` - Emitters for `axios`.
- `src/vendors/node/` - Emitters for Node.js `http`/`https`.
- `src/vendors/typeorm/` - Parsers and Emitters for TypeORM.
- `src/vendors/express/` - Emitters for Express.js routers, MCP SSE routes, and 4-tier Mock Server entrypoints.
- `src/functions/utils.ts` - Parsing TypeScript models, services, and routes back to OpenAPI.
- `src/mcp_server.ts` - Model Context Protocol (MCP) server over stdio.
- `src/cli.ts` - CLI argument parsing and dispatching.

## Testing, Linting & Quality Checks

Run tests locally using Vitest:

```bash
npm test
```

To run with 100% coverage enforcement:

```bash
npm run test:coverage
```

Run Biome linting, strict TypeScript type checking (`100%` `type-coverage`), and TypeDoc documentation generation:

```bash
npm run lint
npm run check:types
npm run docs
```

## Adding New Features

1. Add or update parsers/emitters in `src/` and corresponding tests in `tests/`.
2. Ensure you maintain 100% test coverage and 100% documentation coverage for all code you add.
3. Keep logic modular, separating classes and pure functions cleanly across `src/{arazzo,classes,cli,core,docstrings,functions,mocks,openapi,vendors}`.
