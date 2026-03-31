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
`unknown` and narrow via a shared `MatrixError` type guard (preferred over inline
narrowing at each catch site — see below):

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

Define a shared `MatrixError` interface and type guard once (e.g. in `types.ts`) to
DRY up all three catch blocks:

```typescript
interface MatrixError extends Error {
  errcode?: string;
  statusCode?: number;
}

function isMatrixError(err: unknown): err is MatrixError {
  return err instanceof Error && "errcode" in err;
}
```

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

### `bridge.ts` — Make `DB_READY_TIMEOUT_MS` Configurable

`DB_READY_TIMEOUT_MS = 30000` is hardcoded. In environments with slow cold-starts
(large containerized deployments, spinning disks) this may be too tight without a
code change. Expose it as a `database.connectionTimeoutMs` config option instead.

### Tests — Verify `bridge.test.ts` Covers `matrix-appservice-bridge` v11 Surface

The shared mock at `__mocks__/matrix-appservice-bridge.ts` only exports `Logger`,
`Bridge`, and `Intent` — `AppServiceRegistration` and `Cli` are absent. This is
currently papered over by inline `jest.mock` calls in `index.test.ts`, which provide
working implementations of the missing exports.

The real risk: `bridge.test.ts` imports the **real** `Bridge` and `Intent` from v11.
If v11 broke any of those APIs the tests would only catch it if they actually exercise
the changed surface area. Audit `bridge.test.ts` to confirm coverage of:

- `Bridge.run()`
- `getIntent()` chaining
- Event handler registration

If any of these are not exercised, add targeted tests or extend the shared mock to
eliminate the dependency on the real v11 implementation.

## Config Parser

### `index.ts` — Align `loadConfigFromFile` Signature with `ConfigurationFile` Contract

`ConfigurationFile` is declared as `fs.PathOrFileDescriptor` (`string | number | Buffer | URL`),
but `loadConfigFromFile` only accepts `string`. This creates a silent failure path:
numeric file descriptors, `Buffer`, and `URL` objects bypass the file loader and fall
through to `JSON.parse` instead. The truthiness guard is also broken for `0`, which
is a valid file descriptor.

`fs.readFileSync()` natively handles the full union, so widening the loader to match
the declared contract is straightforward:

```diff
-const loadConfigFromFile = (filePath: string): Configuration => {
+const loadConfigFromFile = (filePath: fs.PathOrFileDescriptor): Configuration => {
```

And update the type guard accordingly:

```diff
-  if (defaultConfigurationFile) {
-    if (typeof defaultConfigurationFile === "string") {
+  if (defaultConfigurationFile !== undefined) {
+    if (
+      typeof defaultConfigurationFile === "string" ||
+      typeof defaultConfigurationFile === "number" ||
+      defaultConfigurationFile instanceof URL ||
+      Buffer.isBuffer(defaultConfigurationFile)
+    ) {
       config = loadConfigFromFile(defaultConfigurationFile);
```

Alternatively, narrow `ConfigurationFile` to `object | string | undefined` in
`types.ts` if the other variants are never actually needed.

### `index.ts` — Re-export Error Classes from the Package Entry Point

`package.json` only exposes `./dist/index.js`, so error types living in `./errors`
are effectively private to consumers. Anyone relying on `instanceof` checks is forced
into an undocumented deep import that the export map does not publish. Re-export all
error classes from `src/index.ts` so they are part of the stable public API.

### `utils.ts` — Throw `UnacceptedKeyError` Instead of Raw `Error`

The legacy parser path throws a generic `Error` for invalid keys, while the new path
throws `UnacceptedKeyError`. This makes the two paths diverge for the same invalid
input and breaks `instanceof` handling for callers who catch `UnacceptedKeyError`.
Replace the raw `throw new Error(...)` in `utils.ts` with `throw new UnacceptedKeyError(...)`
to keep error types consistent across both code paths.

## Crypto

### `index.ts` — Fix Polynomial ReDoS Risk in `toBase64Url` (line 60)

The `/=+$/` regex runs on uncontrolled input and is flagged as a polynomial regular
expression. While the practical risk is low for typical Base64 strings, it can cause
excessive backtracking on crafted inputs with long runs of `=`-like characters.

Replace the regex chain with a single-pass string manipulation that avoids
backtracking entirely:

```diff
 export function toBase64Url(base64: string): string {
-  return base64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
+  return base64
+    .replace(/\+/g, "-")
+    .replace(/\//g, "_")
+    .replace(/=+$/, "");
 }
```

Or avoid regex altogether for the padding strip:

```typescript
export function toBase64Url(base64: string): string {
  const stripped = base64.endsWith("=")
    ? base64.slice(0, base64.length - (base64.length - base64.replace(/=+$/, "").length))
    : base64;
  return stripped.replace(/\+/g, "-").replace(/\//g, "_");
}
```

The cleanest approach is to trim padding with a simple index scan:

```typescript
export function toBase64Url(base64: string): string {
  let end = base64.length;
  while (end > 0 && base64[end - 1] === "=") end--;
  return base64.slice(0, end).replace(/\+/g, "-").replace(/\//g, "_");
}
```

This is O(n) with no backtracking and satisfies static analysis tools flagging
polynomial regex on uncontrolled data.

## DB

### `sql/pg.ts` — Extract `.then()` Callback to Reduce Cognitive Complexity (17 > 10)

The `.then()` callback at line 25 does module interop, config validation, connection
pool setup, error handling, and table creation all at once — cognitive complexity 17,
CI limit 10. Extract into at least two private methods:

- `#validateConfig(config)` — validates required fields and returns a typed pool config
- `#createPool(config)` — constructs and returns the `pg.Pool` instance

Keep the `.then()` callback as a thin orchestrator that calls these in sequence.

### `sql/pg.ts` — Drop `async` from `addColumn` (No `await` Inside)

`addColumn` is marked `async` but constructs and returns a manual `Promise` without
any `await`. The `async` keyword adds a redundant wrapper `Promise` around an
already-a-`Promise`. Either drop `async`, or refactor to use `await` internally for
consistency with the rest of the codebase.

### `sql/pg.ts` — Replace `forEach` with `for...of` (Biome `noForEach`)

Biome rejects `.forEach()` in favour of `for...of`. Three identical patterns need
converting: line 25 callback, lines 162–165, and lines 215–218.

```diff
-  items.forEach((item) => {
-    // ...
-  });
+  for (const item of items) {
+    // ...
+  }
```

### `sql/sqlite.ts` — Drop `async` from `getTableColumns` and `addColumn` (CI Blocker)

Both methods are marked `async` but construct manual `Promise`s internally without
using `await`. This is one of the 31 errors blocking the pipeline. The fix is a
one-line removal:

```diff
-  async getTableColumns(table: T): Promise<ColumnInfo[]> {
+  getTableColumns(table: T): Promise<ColumnInfo[]> {
```

Same applies to `addColumn` and the pattern at lines 1075–1078. Alternatively,
promisify `db.all` / `db.run` with `await` if a full async refactor is preferred.

### `sql/sqlite.ts` — `this.ready` Hangs on `sqlite3` Load Failure

The `.catch()` handler in the constructor rethrows into the void instead of calling
`reject(e)`. If `import("sqlite3")` or `new sqlite3.Database()` fails, the `Promise`
chain breaks silently and `this.ready` never resolves or rejects, hanging startup
indefinitely. Compare against `pg.ts` lines 55–58, which correctly call `reject(e)`.

```diff
-  }).catch((e) => { throw e; });
+  }).catch((e) => { reject(e); });
```

### `sql/pg.ts` + `sql/sqlite.ts` — Empty String Filter Values Silently Drop `WHERE` Constraints

The nullish checks fixed `0`, but the `.toString() !== [].toString()` comparison is
`"" !== ""` for empty strings — which evaluates to `false`, silently discarding the
constraint. A caller querying `{ status: "" }` expecting `WHERE status = ''` gets a
full table scan instead. This is a silent data leakage risk.

The filter predicate must explicitly allow empty strings through:

```diff
-  .filter((key) => value.toString() !== [].toString())
+  .filter((key) => value !== null && value !== undefined)
```

Or, if array values need separate handling, be explicit about each case rather than
relying on `toString()` coercion:

```typescript
const isValidFilterValue = (v: unknown): boolean =>
  v !== null && v !== undefined && !Array.isArray(v);
```

Applies to both `pg.ts` and `sqlite.ts` — audit all filter predicate sites in both
files for this pattern.

### `sql/sql.ts` — Remove `any` from `getCount()` Return Path

Lines 33 and 40 in the shared base class pass `any` through the count helper. The
method has exactly two call patterns — type them with a union and chain `.catch(reject)`
directly to eliminate the `any`s without changing runtime behaviour.

### `database.ts` — Fix `DbBackend` Interface Instead of Working Around It

The wrapper in `database.ts` correctly delegates, but it is constrained by the
`DbBackend<T>` interface in `types.ts`, which declares `createDatabases` as
`...args: any`. Replace that signature with a properly typed one (or a typed overload
alias if arguments vary by backend). Fixing the interface makes the wrapper strict
automatically, rather than patching symptoms at the call site.

### `types.ts` — Consolidate 6-Parameter Function into Options Object

Biome flags functions exceeding a reasonable parameter count, and a 6-parameter
signature is error-prone and hard to call correctly. This is pre-existing API surface,
so it is out of scope for a formatting pass, but should be addressed as dedicated
technical debt: consolidate into a single typed options object.

## Matrix Resolve

### `index.test.ts` — Remove Unused `DnsResolve` Type Import

The `DnsResolve` type is imported but never referenced — likely left over from a
previous iteration. Biome flags it as dead code. Either delete the import, or wire
the type up if it was dropped by mistake.

### `index.ts` — Wire Up or Delete `_prioritySort` (RFC 2782 Compliance)

`_prioritySort` is defined but never called — the underscore prefix is silencing the
linter without fixing the underlying issue. SRV records are not currently being sorted
by priority, which violates RFC 2782: records with lower priority values must be
preferred over higher ones.

Two valid resolutions:

1. **Use it** — sort records before mapping them to results:
   ```typescript
   records.sort(_prioritySort).map(...)
   ```
2. **Delete it** — if priority ordering is genuinely out of scope, remove the function
   and document the deviation from RFC 2782 so future maintainers understand the
   intentional trade-off.

Leaving it as dead code is not a valid option: it gives a false impression that
priority sorting is handled when it is not.

## Matrix Identity Server

### `invitation/index.ts` — Do Not Leak Raw Exception Content to Clients (~line 383)

The `catch (err)` block passes the raw exception directly into the client response
via `errMsg('unknown', err as string)`. The actual error — which may contain stack
traces, internal paths, or sensitive system details — is sent over the wire.

The server already logs the real error via `idServer.logger.error`. Change the
client-facing call to send a generic message instead:

```diff
-  send(res, 500, errMsg('unknown', err as string));
+  send(res, 500, errMsg('unknown'));
```

No control flow or status code changes. The full error remains in server logs only.

### `cron/index.test.ts` — `Error()` Without `new` and Unused Catch Binding (line 51)

Two issues on the same line, matching a pattern also present in production code:

- `Error()` called without `new` — while it works at runtime, it is inconsistent and
  flagged by linters. Use `new Error()`.
- The catch binding is declared but never used. Drop it with an empty catch or omit
  the binding:

```diff
-  } catch (err) {
+  } catch {
```

Clean these up as part of the same pass that fixes the production-code equivalent.

### `cron/index.test.ts` — Useless Catch Block That Just Rethrows (lines 68–80)

The catch block catches an error only to rethrow it unchanged. This adds noise and
gives the misleading impression that errors are being handled. Either handle the error
meaningfully or remove the try/catch entirely and let it propagate naturally:

```diff
-  try {
     await somethingThatMayThrow();
-  } catch (err) {
-    throw err;
-  }
```

### `db/index.ts` — Type the `Module` Variable Explicitly (No Implicit `any`)

The `Module` variable is implicitly typed as `any`, which static analysis correctly
flags. Add an explicit type annotation matching the shape of the dynamically imported
module.

### `db/index.ts` — `close()` Returns `void` in Violation of Coding Standards

The style guide forbids `void` return types and requires every function to return a
meaningful value or an `ActionResult`. `close()` is one of the few cases where `void`
is pragmatically defensible, but a decision must be made and documented:

- **Bend the rule:** Keep `void`, add an inline comment documenting the deliberate
  exception for resource cleanup methods.
- **Follow the standard:** Return a typed completion indicator:
  ```typescript
  close: () => { success: boolean };
  ```

## TOM Server

### `utils.ts` — `TEXT[]` Is PostgreSQL-Only, Breaks SQLite Compatibility

`TEXT[]` array syntax in shared table definitions is PostgreSQL-specific. SQLite has
no native array type and will reject this schema, silently breaking SQLite support.
Per project conventions, schema definitions must be split by driver:

- **Cross-database option:** Use a `TEXT` column storing a serialised JSON array.
- **Driver-split option:** Move the definition into `db/sql/pg.ts` and
  `db/sql/sqlite.ts` separately, following the same pattern used for all other
  driver-specific tables.

### `types.ts` — Replace `Object` with `unknown` in `Content` Type

`Object` in the `Content` type definition is a type-safety hole — it accepts
anything and provides zero compile-time guarantees. Replace with a proper recursive
type using `unknown`:

```diff
-  type Content = Object;
+  type Content = Record<string, unknown>;
```

Or, if the shape is truly recursive:

```typescript
type Content = { [key: string]: unknown | Content };
```

### `utils.ts` — Sanitize Client-Visible Error Messages in `jsonContent`

Two spots in `jsonContent` forward raw exception content to clients:

**`catch (err)` block (lines 53–57):** The caught error is cast and sent as the
`errMsg` detail string. Keep the existing `logger.error("JSON error", err)` log, but
replace the client response with a safe, non-sensitive code:

```diff
-  send(res, 400, errMsg("unknown", err as string));
+  send(res, 400, errMsg("notJson"));
```

**`req.on("error", ...)` handler:** `err.message` is forwarded verbatim to the
client. Replace with a generic message, keeping detailed info in server logs only:

```diff
-  send(res, 400, errMsg("unknown", err.message));
+  send(res, 400, errMsg("unknown"));
```

No new imports or error codes needed — `notJson`/`badJson` already exist in
`errCodes`. These changes only sanitize the explanation text returned to clients;
HTTP status codes and control flow are unchanged.
