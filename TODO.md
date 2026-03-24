# TODOs

## Global

### tsconfig.build.json

Add path resolution and fix JSON imports:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "esnext",
    "target": "esnext",
    "esModuleInterop": true,
    "moduleResolution": "node",
    "lib": ["esnext"],
    "sourceMap": true,
    "noEmitOnError": true,
    "resolveJsonModule": true,
    "declaration": true,
    "paths": {
      "@twake/amqp-connector": ["./packages/amqp-connector/src"],
      "@twake/common-settings-bridge": ["./packages/common-settings-bridge/src"],
      "@twake/config-parser": ["./packages/config-parser/src"],
      "@twake/crypto": ["./packages/crypto/src"],
      "@twake/db": ["./packages/db/src"],
      "@twake/federated-identity-server": ["./packages/federated-identity-server/src"],
      "@twake/logger": ["./packages/logger/src"],
      "@twake/matrix-identity-server": ["./packages/matrix-identity-server/src"],
      "matrix-resolve": ["./packages/matrix-resolve/src"],
      "@twake/tom-server": ["./packages/tom-server/src"],
      "@twake/utils": ["./packages/utils/src"]
    }
  },
  "exclude": [
    "**/__testData__",
    "**/*.test.ts"
  ]
}
```

### Remove Barrel Files

Remove all `index.ts` barrel files across packages. Import directly from source
files instead to improve tree-shaking, reduce circular dependency risks, and
speed up TypeScript compilation.

### Regroup Server Entrypoints into `apps/` Folder

Move all server entrypoints into a dedicated top-level `apps/` folder to clearly
separate runnable applications from reusable library packages.

### Configuration: Migrate to YAML

Migrate all configuration to YAML files, following the conventions of the Matrix
ecosystem. This replaces the current approach and ensures consistency with
tools and homeservers in the same ecosystem.

## Package Structure

### Merge Federated Identity Server into TOM

Absorb the `federated-identity-server` package into `tom-server` to reduce
package sprawl and simplify the dependency graph.

### Merge TOM Server into Matrix Identity Server

Absorb `tom-server` into `matrix-identity-server` as a further consolidation
step, resulting in a single unified server package.

### Remove Logger Package — Use Winston Directly

Delete the `@twake/logger` wrapper package and have all packages import
Winston directly. This removes an unnecessary abstraction layer and reduces
internal coupling.

## Improve TOM Router in Composes

The tom-matrix-client router has its rule label commented out on line 283,
but the remaining configuration labels (entrypoints, tls, priority, middlewares)
on lines 284-287 are still active. This creates a router without a matching rule,
which Traefik may reject or handle unexpectedly.

Either uncomment the rule or comment out all related labels for this router.

## Common Settings Bridge

### Multi-threading Support

The Common Settings Bridge should be updated to support multi-threading.
Each message should be processed in its own thread to improve performance
and responsiveness, especially under high load.

### Avatar Max Size Checks Configuration + Homeserver Max Upload Size

The current implementation of avatar max size checks in the Common Settings Bridge
is configurable. However, it does not take into account the maximum upload size
set by the homeserver. This could lead to situations where users attempt to upload
avatars that exceed the homeserver's limits, resulting in failed uploads.

### `bridge.ts` — Missing Explicit Return Types (Biome)

Biome requires explicit return types on callbacks currently missing them.
Add `void`, `Promise<void>`, and a concrete return type for `getIntent` to unblock
CI lint gates. Also applies to lines 379–386.

### `bridge.ts` — Extract `#handleMessage` (Complexity > 10)

`#handleMessage` has a cyclomatic complexity of 23 and is doing too much at once:
parsing, validation, idempotency, degraded-mode handling, read/write, and error-mode
switching. Split into focused private steps:

- `#parseAndValidate`
- `#loadLastSettings`
- `#applyProfileUpdate`
- `#persistSettings`

Keep `#handleMessage` as a linear orchestrator only.

### `index.ts` — Validate Config Before Double-Casting to `BridgeConfig`

The double cast `as unknown as BridgeConfig` silently bypasses type safety when the
`Cli` library types `config` as `Record<string, unknown> | null`. Replace with a
proper type guard so a shape mismatch surfaces at runtime rather than silently
producing corrupt state:

```typescript
function isBridgeConfig(obj: unknown): obj is BridgeConfig {
  return typeof obj === "object" && obj !== null
    && "homeserverUrl" in obj
    && "domain" in obj;
}
```

### `matrix-profile-updater.ts` — Replace `catch (err: any)` with `unknown` (Biome `noExplicitAny`)

`catch (err: any)` at lines 96, 239, and 283 triggers `noExplicitAny`. Switch to
`unknown` and narrow manually:

```diff
-    } catch (err: any) {
+    } catch (err: unknown) {
+      const errcode = typeof err === "object" && err !== null && "errcode" in err ? (err as { errcode: string }).errcode : undefined;
+      const message = err instanceof Error ? err.message : String(err);
       this.logger.warn(
-        `Failed to update display name via standard API for ${userId}: ${
-          err?.errcode || err?.message || "Unknown error"
-        }`,
+        `Failed to update display name via standard API for ${userId}: ${errcode || message}`,
       );
       if (
-        (err?.errcode === "M_FORBIDDEN" || err?.errcode === "M_EXCLUSIVE") &&
+        (errcode === "M_FORBIDDEN" || errcode === "M_EXCLUSIVE") &&
         this.retryMode === SynapseAdminRetryMode.FALLBACK
       ) {
```

Alternatively, define a `MatrixError` interface with `errcode?: string` and use a
type guard.

### `settings-repository.ts` — Preserve Error Cause When Wrapping (`useErrorCause`)

Biome's `lint/nursery/useErrorCause` flags wrapped errors that drop the original
cause. Pass `{ cause: err }` to keep stack traces intact:

```diff
-      throw new Error(`Invalid JSON string: ${err instanceof Error ? err.message : String(err)}`);
+      throw new Error(`Invalid JSON string: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
```

### `settings-repository.ts` — Remove Non-Null Assertions (`noNonNullAssertion`)

Lines 201 and 205 use `tsNum!` which Biome rejects. The `Number.isFinite` guard
does not narrow `number | undefined` to `number` in TypeScript's type system.
Store the narrowed value explicitly instead:

```diff
-      const validTimestamp = Number.isFinite(tsNum) ? tsNum! : 0;
+      const validTimestamp = typeof tsNum === "number" && Number.isFinite(tsNum) ? tsNum : 0;

       this.#logger.debug(
-        `Found existing settings for ${userId}: version=${dbRow.version}, timestamp=${
-          Number.isFinite(tsNum) ? formatTimestamp(tsNum!) : "unknown"
-        }, request_id=${dbRow.request_id}`,
+        `Found existing settings for ${userId}: version=${dbRow.version}, timestamp=${
+          validTimestamp > 0 ? formatTimestamp(validTimestamp) : "unknown"
+        }, request_id=${dbRow.request_id}`,
       );
```

### `types.ts` — Convert Enums to `const` Objects (`noEnum`)

Biome's `lint/style/noEnum` will block CI. Enums have quirky runtime behavior and
tree-shaking issues. Replace all enums with `const` objects and derive the union
type from them:

```typescript
// Before
enum SynapseAdminRetryMode { FALLBACK = "fallback", DISABLED = "disabled" }

// After
const SynapseAdminRetryMode = { FALLBACK: "fallback", DISABLED: "disabled" } as const;
type SynapseAdminRetryMode = typeof SynapseAdminRetryMode[keyof typeof SynapseAdminRetryMode];
```
