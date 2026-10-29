# Warridli frontend

React/TypeScript Arabic RTL SPA. See the [project README](../README.md) for full-stack setup and the
[instructor handoff](../docs/HANDOFF.md) for demonstration and testing.

From this directory, `npm run check` runs typecheck, oxlint, Vitest and a production build. Use the locked
Node/npm requirements and `npm ci` on a new instructor checkout. `npm run e2e` additionally needs Chrome,
a safely verified MariaDB test schema and a prior build; it is not a static-only UI test command.

The browser uses relative `/api` and `/sanctum` with same-origin credentials. Vite proxies these in development;
production must provide the same routing itself. A separate public API URL cannot be set with an environment
variable in the current client. See [deployment](../docs/DEPLOYMENT.md) and [free-demo assessment](../docs/RELEASE_READINESS.md).

`frontend/dist` is a generated deployment artifact and is excluded from the instructor source ZIP.
