<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# tom-server/src/

## Purpose
TypeScript source for `@twake/tom-server`. Contains `TwakeServer` (the composition root) and all 12 Twake-specific API modules. Each API module follows a consistent structure: `routes/index.ts` → `controllers/index.ts` + `middlewares/index.ts` + `services/index.ts`.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `TwakeServer` class — instantiates all services, mounts all API routers |
| `config.json` | Configuration key defaults for tom-server |
| `types.ts` | Global type definitions (TwakeDB, shared interfaces) |
| `utils.ts` | Root-level utility functions used across modules |
| `index.test.ts` | Server integration tests |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `addressbook-api/` | Personal contact list CRUD (see `addressbook-api/AGENTS.md`) |
| `admin-settings-api/` | Admin user management endpoints (see `admin-settings-api/AGENTS.md`) |
| `deactivate-account-api/` | Admin account deactivation (see `deactivate-account-api/AGENTS.md`) |
| `identity-server/` | TwakeIdentityServer extending MatrixIdentityServer (see `identity-server/AGENTS.md`) |
| `invitation-api/` | Email/SMS invitation system (see `invitation-api/AGENTS.md`) |
| `matrix-api/` | Matrix client API proxy (see `matrix-api/AGENTS.md`) |
| `metrics-api/` | Activity/usage metrics (see `metrics-api/AGENTS.md`) |
| `qrcode-api/` | QR code generation (see `qrcode-api/AGENTS.md`) |
| `sms-api/` | SMS sending endpoint (see `sms-api/AGENTS.md`) |
| `user-info-api/` | Enriched user profiles (see `user-info-api/AGENTS.md`) |
| `vault-api/` | Recovery word storage (see `vault-api/AGENTS.md`) |
| `wellKnown/` | Matrix server discovery (see `wellKnown/AGENTS.md`) |

## Shared Middleware & Services

The `utils/` subdirectory contains cross-cutting concerns used by multiple API modules:

| Path | Description |
|------|-------------|
| `utils/middlewares/auth.middleware.ts` | Matrix token authentication middleware |
| `utils/middlewares/error.middleware.ts` | Express error handler |
| `utils/services/email-service.ts` | Shared email sending service |

## For AI Agents

### Working In This Directory
- All new API modules must be registered in `index.ts` (`_initServer()` method)
- Singleton services (AddressbookService, UserInfoService, TokenService, SmsService) are created once in `_initServer()` — pass them to modules, do not instantiate inside modules
- Follow the existing pattern: `module/routes/index.ts` defines the Express Router, imports from `controllers/` and `middlewares/`
- Use `utils/middlewares/auth.middleware.ts` for endpoints requiring Matrix token authentication

### Testing Requirements
```bash
npx nx run  @twake/tom-server:test
```

### Common Patterns
```typescript
// Module registration in index.ts
const myModule = new MyApiModule(this.db, this.userInfoService, this.conf);
router.use(myModule.router);
```

<!-- MANUAL: -->
