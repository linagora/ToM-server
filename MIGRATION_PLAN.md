# Migration Plan

## Why

The current codebase is a Lerna/NX monorepo that grew organically around three legacy packages, each with its own server entrypoint (`server.mjs`):

- `packages/matrix-identity-server` — Matrix identity protocol
- `packages/tom-server` — Twake-specific API modules
- `packages/federated-identity-service` — Federation layer

Every module is tightly coupled to shared abstractions (`packages/db`, `packages/config-parser`, `packages/logger`, `packages/utils`) that were designed as God objects rather than domain-scoped tools. As a result:

- A minor change in one module often requires touching 5–10 files across multiple packages.
- The config schema is duplicated and diverges between packages.
- The DB layer is a single shared abstraction with no module boundaries — a change to one model risks breaking others.
- Build times are slow because NX must evaluate the full dependency graph on every run.
- Adding or changing the runtime, bundler, or formatter affects every package.

## How

The migration consolidates everything into a single Express application at `apps/tom-server`.

**Bridge strategy.** Rather than a big-bang rewrite, legacy packages are loaded as coarse-grained Express routers and mounted into the new app. This means the server can be deployed immediately from `apps/tom-server` while modules are rewritten one at a time. Each module swap is an independent PR: when a module is reimplemented in `apps/tom-server`, its legacy counterpart is dropped from the legacy router mount.

**Module structure.** Each module in `apps/tom-server` is self-contained: `router.ts → controller.ts → service.ts`, with its own `types.ts`, `schema.ts` (Zod), and `registry.ts` (DB provider). Cross-cutting concerns (auth, logging, error handling, request IDs) are handled by shared middleware mounted at the app level.

**Data layer.** The `packages/db` God abstraction is replaced by a Registry pattern: each module owns its DB provider factory. A single shared connection (Prisma or Drizzle client) is initialised at startup and injected into module registries. No module can reach into another module's schema.

**End state.** Once all modules are reimplemented, the legacy packages are deleted, NX and Lerna are removed, and the contents of `apps/tom-server` become a standalone repository — a single Node project with Biome, a bundler (TBD), and no monorepo overhead.

## Current State

| Component | Location | Status |
|---|---|---|
| Unified Express app | `apps/tom-server` | Active — legacy packages mounted as router |
| Legacy identity server | `packages/matrix-identity-server` | Deprecated — mounted via legacy router |
| Legacy Twake API modules | `packages/tom-server` | Deprecated — mounted via legacy router |
| Legacy federation service | `packages/federated-identity-service` | Deprecated — mounted via legacy router |
| Common settings bridge | `packages/common-settings-bridge` | To be extracted to its own repo |
| Shared DB abstraction | `packages/db` | To be replaced by module-scoped Registries |
| Shared utilities | `packages/amqp-connector`, `packages/config-parser`, `packages/crypto`, `packages/logger`, `packages/matrix-resolve`, `packages/utils` | To be inlined or deleted |

---

# Roadmap

## Phase 0 — Foundation

**Goal:** Run the full legacy server through `apps/tom-server` with no regression. Establish the structural conventions all future modules will follow.

**Definition of Done:** `npx nx serve tom-server` starts successfully. All routes previously served by the three legacy `server.mjs` entrypoints respond correctly. Docker image builds and publishes via CI.

### 1. Express app scaffolding

- [x] Create NX project at `apps/tom-server`
- [x] Initialise base app structure (`app.ts`, `main.ts`, `types.ts`)
- [x] Mount global middleware: `express.json`, `express.urlencoded`, `requestId`, `httpLogger`
- [x] Implement terminal error middleware
- [x] Configure trusted proxy support

### 2. Configuration loader

- [x] Define Zod config schema
- [x] Implement YAML file loader
- [x] Export typed `Config` interface
- [x] Integrate legacy config adapter (`mapToLegacyConfig`)

### 3. Logger

- [x] Implement Winston logger factory
- [x] Support child loggers per module

### 4. Telemetry

- [x] Initialise OpenTelemetry provider
- [x] Wire Prometheus exporter
- [x] Mount metrics endpoint (configurable path)

### 5. Legacy router mount

- [x] Create `modules/legacy` module
- [x] Implement `mapToLegacyConfig` to translate new config to legacy shape
- [x] Mount `@twake/server` endpoints via `tomServer.endpoints`

### 6. i18n

- [x] Implement i18n messages loader
- [x] Implement platform-aware asset paths loader

### 7. Landing page

- [x] Implement landing router and controller
- [x] Serve static assets

### 8. CI/CD

- [x] Build and publish unified Docker image
- [x] Scaffold `apps/tom-server-e2e` project

---

## Phase 1 — Developer Infrastructure

**Goal:** Equip the app with the tooling every new module will rely on, so there is a clear, repeatable pattern to follow from Phase 3 onward.

**Definition of Done:** A new module can be added with OpenAPI documentation, Zod-validated requests, and at least one e2e test covering the happy path — without touching any legacy code.

### 1. OpenAPI / Swagger integration

- [ ] Choose and install an OpenAPI library (`swagger-jsdoc` + `swagger-ui-express`, or schema-first alternative)
- [ ] Mount Swagger UI at a configurable path (e.g. `/api-docs`)
- [ ] Define base OpenAPI document (title, version, server URL)
- [ ] Document the `landing` module as a reference example

### 2. Request validation middleware

- [ ] Implement a Zod-based request validation helper (body, query, params)
- [ ] Integrate validation errors into the existing error middleware (consistent error shape)
- [ ] Add usage example in the `landing` module

### 3. E2E test harness

- [ ] Implement test database provisioning (isolated DB per test run)
- [ ] Cover at least one full request cycle in `apps/tom-server-e2e`
- [ ] Add a smoke test that verifies the legacy router initialises without error

---

## Phase 2 — Data Layer

**Goal:** Replace the `packages/db` God abstraction with a Registry pattern that gives each module an isolated, type-safe DB provider.

**Definition of Done:** One module is written end-to-end using the new data layer. `packages/db` is not imported anywhere in `apps/tom-server`.

### 1. Choose ORM

- [ ] Evaluate Prisma and Drizzle against project requirements (migrations, type safety, query ergonomics, runtime overhead)
- [ ] Document the decision and rationale in an ADR (`docs/adr/`)
- [ ] Initialise the chosen ORM in `apps/tom-server`

### 2. Follow legacy db schema

- [ ] Audit all table definitions across `packages/db`, `packages/matrix-identity-server/src/db`, and `packages/matrix-identity-server/src/matrixDb`
- [ ] Reproduce the full schema in ORM model definitions
- [ ] Validate model definitions against a running Synapse + ToM database

### 3. Prepare migration scripts

- [ ] Write initial `up` migration from the legacy schema
- [ ] Write corresponding `down` (rollback) migration
- [ ] Document the migration execution plan (ordering, zero-downtime strategy, rollback procedure)

### 4. Implement Registry pattern

- [ ] Define the module Registry interface (`interface DbRegistry<T>`)
- [ ] Implement shared DB connection lifecycle: initialise at startup, graceful teardown on shutdown
- [ ] Write a reference Registry implementation for one simple module
- [ ] Remove `packages/db` from `apps/tom-server` dependencies once the reference module is live

---

## Phase 3 — Module Re-implementations

**Goal:** Replace every legacy module with a native `apps/tom-server` implementation, one module at a time.

**Definition of Done:** `modules/legacy/router.ts` is deleted. `@twake/server`, `@twake/matrix-identity-server`, and `@twake/federated-identity-service` are no longer imported anywhere in `apps/tom-server`.

Each module below is one PR. The pattern for every module is:

1. Implement `router.ts`, `controller.ts`, `service.ts`, `schema.ts`, `types.ts`, `registry.ts`
2. Mount the new router in `app.ts`
3. Add unit tests for service and controller
4. Add e2e test for the happy path
5. Create a feature flag in the config

Each module declares its own config section with its propper keys.

The activation of the new module is done via a `lab.router.enable_<module>: true` key.
If enabled, the module is loaded after the legacy router so it overrides the express routing.

### 1. Well-known

- [ ] Implement `/.well-known/matrix/server` and `/.well-known/matrix/client` routes
- [ ] Unit tests
- [ ] E2e test

### 2. Terms

- [ ] Implement terms acceptance routes (`/_matrix/identity/v2/terms`)
- [ ] Implement terms service (fetch, accept)
- [ ] Module Registry (policies stored in DB)
- [ ] Unit tests
- [ ] E2e test

### 3. Account

- [ ] Implement account registration and token routes
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 4. Lookup

- [ ] Implement `/_matrix/identity/v2/lookup` and `/_matrix/identity/v2/hash_details`
- [ ] Module Registry (hashes)
- [ ] Unit tests
- [ ] E2e test

### 5. 3PID (Third-Party Identifiers)

- [ ] Implement bind / unbind / validate routes
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 6. Key management

- [ ] Implement `/_matrix/identity/v2/pubkey/*` routes
- [ ] Ephemeral signing
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 7. Invitation API

- [ ] Reimplement invitation creation, lookup, and status routes
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 8. User info API

- [ ] Reimplement user profile and directory routes
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 9. Address book API

- [ ] Reimplement contact management routes
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 10. Admin settings API

- [ ] Reimplement admin configuration routes
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 11. Deactivate account API

- [ ] Reimplement account deactivation flow
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 12. Matrix API proxy

- [ ] Reimplement Matrix client-server API proxy routes
- [ ] Unit tests
- [ ] E2e test

### 13. QR code API

- [ ] Reimplement QR code generation routes
- [ ] Unit tests
- [ ] E2e test

### 14. SMS API

- [ ] Reimplement SMS sending routes
- [ ] Unit tests
- [ ] E2e test

### 15. Vault API

- [ ] Reimplement vault / secret storage routes
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 16. Metrics API

- [ ] Reimplement application-level metrics routes (distinct from Prometheus endpoint)
- [ ] Unit tests
- [ ] E2e test

### 17. Federation (federated identity service)

- [ ] Reimplement federated identity hash sync routes and cron
- [ ] Module Registry
- [ ] Unit tests
- [ ] E2e test

### 18. Remove legacy router

- [ ] Delete `apps/tom-server/src/modules/legacy/`
- [ ] Remove `@twake/server`, `@twake/matrix-identity-server`, `@twake/federated-identity-service` from `package.json`
- [ ] Verify full test suite passes

---

## Phase 4 — End State

**Goal:** A single, standalone Node repository containing only the ToM server. No monorepo tooling, no legacy packages, no NX.

**Definition of Done:** `packages/` directory is gone. No `nx.json`, `lerna.json`, or `project.json` files remain. The repository contains a single Node project that builds, tests, and starts with plain npm/node scripts.

### 1. Extract common-settings-bridge

- [ ] Create a new standalone repository for `packages/common-settings-bridge`
- [ ] Move source and tests to the new repo
- [ ] Publish as an independent package (or make it a Docker sidecar — to be decided)
- [ ] Update or remove the `common-settings` integration in `apps/tom-server`

### 2. Remove legacy packages

- [ ] Delete `packages/tom-server`
- [ ] Delete `packages/matrix-identity-server`
- [ ] Delete `packages/federated-identity-service`
- [ ] Delete `packages/common-settings-bridge` (after extraction)
- [ ] Delete `packages/db`
- [ ] Delete `packages/config-parser`
- [ ] Delete `packages/logger`
- [ ] Delete `packages/utils`
- [ ] Delete `packages/amqp-connector`
- [ ] Delete `packages/crypto`
- [ ] Delete `packages/matrix-resolve`

### 3. Remove monorepo tooling

- [ ] Remove NX (`nx.json`, all `project.json` files, `.nx/` cache, NX dependencies from `package.json`)
- [ ] Remove Lerna (`lerna.json`, Lerna dependencies)
- [ ] Replace `npx nx <script> tom-server` invocations with plain npm scripts
- [ ] Update `.github/workflows` CI to use new scripts

### 4. Bootstrap standalone repository

- [ ] Move `apps/tom-server` content to the repository root (`src/`, `package.json`, config files)
- [ ] Choose and configure bundler (TBD)
- [ ] Verify Biome config covers the new structure
- [ ] Confirm `npm run build`, `npm test`, and `npm start` all pass from the root
- [ ] Update `Dockerfile` and `compose.deploy.yml` to reflect new build context
- [ ] Tag the first standalone release
