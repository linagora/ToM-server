# JavaScript / TypeScript Coding Style

## Preface

This document describes _A_ preferred way of writing JavaScript and TypeScript. Not _THE_
preferred way. A coding style is inherently subjective, or at best the product of a team
consensus. Any claim that a stylistic rule is objectively correct, in the absence of
measurable justification, is a matter of opinion. This document tries to be honest about
that distinction: every rule here either cites a concrete reason, references language-level
behaviour, or is explicitly labelled as a convention chosen for consistency rather than
correctness.

This document may offend you. If it does not, you probably already write in a way that
aligns with what it says. If it does — good. That friction is useful. Please open an edit
suggestion. State your point of view precisely. "It is better to" is an opinion; back it
with a reason. Opinions without reasons get closed. Reasoned disagreements get discussed
and may change this document. That is the point. Thank you in advance for your contribution.

One principle is not up for debate: **code is written for human readers first, and machines
second.** CPU time is purchasable. More RAM can be added. Human attention is the actual
scarce resource, and it degrades fast under inconsistent, ambiguous, or needlessly complex
code. Every rule in this guide exists to reduce the cognitive load on the person reading
your code — which is often you, six months from now, at the wrong time.

During code review, this document is the law. It is not a starting point for negotiation.
If you disagree with a rule, the place to argue is a pull request against this document,
not a review thread on someone else's code. Merge the style fix first; argue the rule
separately. That separation keeps reviews focused and keeps the codebase consistent while
discussions are open.

## Table of Contents

1. [Indentation and Formatting](#1-indentation-and-formatting)
2. [Line Length](#2-line-length)
3. [Naming](#3-naming)
4. [Functions](#4-functions)
5. [TypeScript Types](#5-typescript-types)
6. [Control Flow and Nesting](#6-control-flow-and-nesting)
7. [Error Handling and try/catch](#7-error-handling-and-trycatch)
8. [Modules and Imports](#8-modules-and-imports)
9. [Comments](#9-comments)
10. [Classes vs Functions](#10-classes-vs-functions)
11. [Async Code](#11-async-code)
12. [Forbidden Patterns](#12-forbidden-patterns)

## 1. Indentation and Formatting

**2 spaces.** Not 4. Not tabs. Not "whatever Prettier defaults to on my machine."
2 spaces. The specific number is a convention; the requirement for _one shared number_
is not. Mixed indentation produces broken diffs and impossible-to-read rebases.
Pick one and enforce it with a formatter — then stop thinking about it.

Opening braces go on the same line. Always. This is the language convention established
by the vast majority of JS/TS style guides and the default of every major formatter.
Putting the brace on a new line wastes vertical space and makes diffs noisier — a closing
`}` is already visually distinct; the opening brace does not need its own line.

```ts
// Non-standard — brace on new line, contradicts formatter defaults and wastes a line.
function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Standard.
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

Trailing commas in multi-line structures. Always. The reason is mechanical and
measurable: adding an element to the end of a multi-line list without a trailing
comma produces a two-line diff — one touching the prior element, one adding the
new one. With a trailing comma, the diff is one line. Smaller diffs mean less
noise in code review and less ambiguity in `git blame`.

```ts
const config = {
  host: "localhost",
  port: 8080,
  retries: 3, // trailing comma — cleaner diffs, no other reason needed.
};
```

Semicolons are required. JavaScript's Automatic Semicolon Insertion (ASI) is a
syntactic feature that inserts semicolons at parse time under rules that are
non-obvious and have known edge cases — particularly around lines beginning with
`(`, `[`, or template literals. Explicit semicolons make the intent unambiguous
and remove an entire class of subtle parse errors from the equation.

## 2. Line Length

**120 characters. Hard limit.**

The number 120 is a convention, not a law of physics — 80 and 100 are defensible
alternatives. This codebase uses 120 because it accommodates TypeScript's longer
type signatures without forcing ugly line breaks, while still fitting comfortably
on a split-screen editor at common display resolutions. Configure your linter to
enforce it and stop re-litigating the number.

What is not a convention: if a line is too long, the problem is usually not the
line — it is that the expression is too complex. Break it into named
sub-expressions. The names carry meaning the line length cannot.

```ts
// Over the limit — and the real problem is that the expression is doing two things at once.
const result = users
  .filter((u) => u.isActive && u.role !== "guest")
  .map((u) => ({ ...u, displayName: `${u.firstName} ${u.lastName}` }));

// Each step is named and independently readable.
const activeNonGuests = users.filter((u) => u.isActive && u.role !== "guest");
const withDisplayName = (u: User) => ({
  ...u,
  displayName: `${u.firstName} ${u.lastName}`,
});
const result = activeNonGuests.map(withDisplayName);
```

Long ternaries break the rule for the same reason: the reader's eye has to hold
the condition, the truthy branch, and the falsy branch in working memory
simultaneously. If a ternary cannot fit on one line, write the `if` — it is the
same bytecode and it costs the reader far less.

## 3. Naming

Names are the primary inline documentation of your code. A function named `processData`
communicates nothing about what it does, what it expects, or what it produces. A function
named `normalizeInvoiceLineItems` communicates all three without a comment. The cost of
a poor name compounds: every reader, including the original author returning after a
week away, must read the implementation to recover the meaning the name failed to convey.

If you cannot name a function precisely, that is a signal — not about naming, but about
understanding. Go understand what the function does first.

**Variables and functions:** `camelCase`.

**Types, interfaces, classes, enums:** `PascalCase`.

**Constants that are truly constant:** `SCREAMING_SNAKE_CASE` — only for module-level
primitives that never change and are meaningfully distinct from runtime values.
Do not apply this to every `const`. A `const` in a function body is not a
"constant" in this sense; it is a local binding.

```ts
const MAX_RETRY_ATTEMPTS = 3; // Module-level, truly invariant — correct.
const BASE_API_URL = "https://api.x.com"; // Module-level, truly invariant — correct.

function fetchUser(id: string): Promise<User> {
  const cacheKey = `user:${id}`; // Local binding — camelCase is correct here.
  const CACHE_KEY = `user:${id}`; // SCREAMING_SNAKE for a local binding is misleading.
  // ...
}
```

**Boolean variables** must read as a question: `isLoading`, `hasPermission`, `canRetry`.
Not `loading`, `permission`, `retry`. The reason is readability at the call site — `if
(isLoading)` parses as a question answered by a boolean. `if (loading)` parses as a
noun used as a condition. The former requires no inference; the latter does.

**Do not abbreviate** beyond the accepted list below. Abbreviations save keystrokes for
the writer and cost comprehension time for every reader thereafter. A codebase is read
far more often than it is written; optimise for the reader.

Accepted abbreviations: `i`, `j` in tight loops; `e` for event parameters; `err` for
errors; `ctx` for context; `req`/`res` in HTTP handlers. These are accepted because they
are universally understood conventions in JS/TS. Everything else is spelled out.

## 4. Functions

### One job. No exceptions.

A function that does more than one thing is harder to name, harder to test in
isolation, and harder to reuse. If you find yourself writing "and" in a function
name — `fetchAndTransformUser` — you have written two functions that happen to
share a body. Extract them. Each one becomes individually testable and individually
reusable.

### Maximum 5 arguments. No exceptions.

The reason is cognitive, not aesthetic. Research on working memory (Miller's law:
7 ± 2 chunks) and practical experience both show that tracking argument order and
meaning degrades rapidly above 4–5 parameters. Beyond 5, callers start making
positional mistakes that the type system may not catch (two adjacent `string`
arguments, for instance). Group related data into a typed options object instead.

```ts
// Too many positional arguments — order errors are invisible to the type checker
// when adjacent arguments share a type.
function createUser(
  firstName: string,
  lastName: string,
  email: string,
  role: UserRole,
  organizationId: string,
  isVerified: boolean,
  createdBy: string,
): Promise<User> { ... }

// Group the data. The parameter object is self-documenting at the call site.
interface CreateUserParams {
  name: { first: string; last: string };
  email: string;
  role: UserRole;
  organizationId: string;
  isVerified: boolean;
  createdBy: string;
}

function createUser(params: CreateUserParams): Promise<User> { ... }
```

### Return types must be explicit on all non-trivial functions.

TypeScript's inference is powerful but inference is not a contract — it is a
derivation that can change silently when the implementation changes. An explicit
return type is a compiler-enforced contract between the function and its callers.
If your function is more than a one-liner, annotate the return type.

```ts
// No return type — the contract is implicit and fragile.
function getActiveUsers(users: User[]) {
  return users.filter((u) => u.isActive);
}

// Return type as explicit contract.
function getActiveUsers(users: User[]): User[] {
  return users.filter((u) => u.isActive);
}
```

### Keep functions short.

25–40 lines is a reasonable ceiling, not an absolute limit — the real heuristic is
that a function should fit on one screen without scrolling. When it does not, the
reader loses the ability to hold the full context simultaneously. Branches, state,
and side effects all compound the cognitive cost. If you exceed the ceiling,
re-examine every line for extracted sub-operations that could be named and moved.

### Every function must return a meaningful value. No exceptions.

`void` is forbidden. A function that returns nothing is a function that tells
its caller nothing. Did it work? Did it fail silently? Was the data saved? Was
the email sent? Nobody knows. The caller has to go read the implementation to
find out, which defeats the entire point of having a function.

Every function either accomplishes what it was asked to do, or it did not.
That outcome must be communicated in the return value — always.

For functions that perform actions with no natural data return, use the
`ActionResult` type:

```ts
type ActionResult = { success: true } | { success: false; error: string };
```

The caller decides what to do with the outcome. That is the caller's job.
Your job is to report it.

```ts
// Returns void — the caller has no way to know if the insert succeeded or failed.
async function saveUser(user: User): Promise<void> {
  await db.users.insert(user);
}

// Throws on failure — forces the caller into try/catch for a routine outcome.
async function saveUser(user: User): Promise<void> {
  const result = await db.users.insert(user);
  if (!result.ok) throw new Error("Insert failed");
}

// Returns ActionResult — both outcomes are explicit and typed at the call site.
async function saveUser(user: User): Promise<ActionResult> {
  const result = await db.users.insert(user);
  if (!result.ok) return { success: false, error: result.reason };
  return { success: true };
}

// Returns Result<T, E> for functions that produce data — failure is first-class.
async function fetchUser(id: string): Promise<Result<User, string>> {
  const row = await db.users.findById(id);
  if (!row) return { ok: false, error: `User ${id} not found` };
  return { ok: true, value: toUser(row) };
}
```

The `ActionResult` / `Result` types compose cleanly. A function that calls
three sub-operations can return the first failure it encounters without
throwing, and the caller gets a precise, typed explanation of what went wrong
and where. That is better than an exception stack trace and infinitely better
than silence.

The only exemption is framework-mandated callbacks and lifecycle hooks where
the return type is dictated by an external contract you do not own (e.g.,
a React `useEffect` cleanup, an Express middleware that calls `next()`).
Document the exemption inline. Do not use it as a blanket excuse.

### Recursion: tail-call or loop. No exceptions.

Every recursive algorithm has an iterative equivalent. The question is whether
the recursive form is worth the trade-off. In JavaScript and TypeScript, the
answer is almost always no, for one concrete reason: **JS engines do not reliably
optimise tail calls**. The TC39 tail-call optimisation (TCO) specification exists,
but as of today only JavaScriptCore (Safari) implements it. V8 and SpiderMonkey
do not. A non-tail-recursive function grows the call stack by one frame per
recursive call. Given sufficient input, this is a `RangeError: Maximum call stack
size exceeded` — a runtime crash with no warning and no graceful recovery.

The rules are:

1. **If you write recursion, it must be tail-recursive** — the recursive call is
   the last and only expression returned, with no deferred computation after it.
   Even then, document why TCO cannot be guaranteed in your runtime target.

2. **If tail recursion is not structurally possible for the algorithm, use an
   iterative loop.** A loop-based solution may allocate more memory (an explicit
   stack or accumulator), but memory allocation is bounded and predictable.
   Call-stack exhaustion is not.

3. **Non-tail recursion is forbidden in production code.**

```ts
// Non-tail recursion — each call suspends waiting for the next.
// Crashes on deep input. Forbidden.
function sum(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr[0] + sum(arr.slice(1)); // deferred addition = not tail position
}

// Tail-recursive equivalent.
// Still not safe in V8/SpiderMonkey without TCO, but structurally sound.
// Document the runtime caveat.
function sum(arr: number[], acc: number = 0): number {
  if (arr.length === 0) return acc;
  return sum(arr.slice(1), acc + arr[0]); // tail position — nothing deferred
}

// Iterative equivalent — preferred. Bounded memory, no stack risk.
function sum(arr: number[]): number {
  let acc = 0;
  for (const n of arr) acc += n;
  return acc;
}
```

For tree traversal, graph search, or other algorithms where recursion feels
natural: use an explicit stack (an array acting as a worklist). You get the
structural clarity of recursive thinking without the call-stack cost.

```ts
// Iterative depth-first traversal with explicit stack.
function collectLeaves(root: TreeNode): string[] {
  const stack: TreeNode[] = [root];
  const leaves: string[] = [];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.children.length === 0) {
      leaves.push(node.value);
      continue;
    }
    stack.push(...node.children);
  }

  return leaves;
}
```

## 5. TypeScript Types

TypeScript exists to surface incorrect assumptions at compile time rather than at
runtime in production. If you use it purely as a documentation layer without
letting it constrain what your code can do, you are paying the cost of types
(verbosity, compilation) without receiving the benefit (safety). Use it properly
or use JavaScript.

### `any` is forbidden. Without exception.

`any` disables type checking for a value and everything derived from it. The
TypeScript compiler will no longer tell you if you use that value incorrectly —
not at the assignment, not at the call site, not anywhere downstream. There is
always an alternative: a proper type, a discriminated union, `unknown` with a
guard, or a generic. Every `any` is a deliberate hole in your safety net.

```ts
// Disables type checking for input and output simultaneously.
function parseConfig(raw: any): any { ... }

// Forces the author to think about the actual shape of the data.
function parseConfig(raw: unknown): AppConfig {
  if (!isAppConfig(raw)) return { ok: false, error: "Invalid config shape" };
  return raw;
}
```

### `as unknown as T` is forbidden. Without exception.

A double cast via `unknown` tells the compiler "trust me, this is a `T`" while
providing zero evidence. It is type erasure with extra syntax. If you feel you
need it, the type model is inconsistent — fix the model.

### Use `unknown` over `any` for data from external sources.

HTTP responses, `JSON.parse`, event payloads, database rows — none of these are
typed until you validate them. Use `unknown` and write a type guard. The guard
is the validation; the types follow from it.

```ts
async function fetchUserData(id: string): Promise<Result<User, string>> {
  const response = await fetch(`/api/users/${id}`);
  const raw: unknown = await response.json();

  if (!isUser(raw)) {
    return { ok: false, error: `Unexpected user payload for id=${id}` };
  }

  return { ok: true, value: raw };
}

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value
  );
}
```

### Prefer `type` for unions and intersections, `interface` for object shapes.

This is a convention, not a correctness rule. The distinction keeps intent
readable: `interface` describes the shape of an object that could be implemented
or extended; `type` describes computed or composite type expressions. Mixing
them arbitrarily forces readers to wonder if there was a reason for the choice.

### Enums: avoid. String union types: use with caution.

**TypeScript `enum` is avoided** for two concrete reasons. First, it is not
native to JavaScript — it compiles to an IIFE that produces a runtime object,
adding code that has no equivalent in the source language. Second, numeric enums
(the default) have a type-safety hole: any `number` is assignable to a numeric
enum type. String enums are safer but still produce runtime overhead with no
benefit over a string union for pure internal use.

**String union types are the preferred alternative for values that are fully
internal** — defined, produced, and consumed within the codebase:

```ts
type Direction = "north" | "south" | "east" | "west";
```

**However, string unions are not straightforward when values cross a system
boundary** — database reads, user input, API responses, environment variables.
Converting an arbitrary `string` to a string union type requires explicit
validation; TypeScript will not narrow it for you, and there is no built-in
mechanism to list the members at runtime (unlike an enum object).

If you use a string union for values that may arrive as raw strings, you must
provide a helper that validates and narrows the conversion, with explicit handling
for the unknown case:

```ts
type Direction = "north" | "south" | "east" | "west";

const DIRECTIONS = ["north", "south", "east", "west"] as const;

function toDirection(raw: string): Result<Direction, string> {
  if ((DIRECTIONS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as Direction }; // safe — membership confirmed above
  }
  return {
    ok: false,
    error: `Unknown direction: "${raw}". Expected one of: ${DIRECTIONS.join(
      ", "
    )}`,
  };
}
```

The `as Direction` cast inside `toDirection` is the one acceptable use of a
type assertion in this pattern — membership in the const array has been proven on
the line immediately above it. Document that reasoning inline, as shown.

If you find yourself writing this boilerplate for many union types, that is a
signal to reconsider whether an enum (with its runtime object and built-in
membership checking) is the lesser evil for that specific case. Make a deliberate
choice; do not drift into either pattern by default.

## 6. Control Flow and Nesting

### Maximum 2 levels of nesting. No exceptions.

A function body is level zero. A block inside it is level one. A block inside
_that_ is level two. There is no level three.

The reason is measurable: the cognitive cost of reading code is proportional to
the number of conditions a reader must hold in their head simultaneously to
understand any given line. At nesting level three, the reader is tracking the
outer condition, the middle condition, the inner condition, and the code itself.
That is four simultaneous concerns. Human working memory does not handle this
gracefully — reading mistakes increase, and so do maintenance errors.

If you find yourself at a third level, you have a function that contains a
sub-problem that needs its own name.

```ts
// Three levels deep — the reader must track three conditions simultaneously.
function processOrders(orders: Order[]): ProcessedOrder[] {
  const results: ProcessedOrder[] = [];
  for (const order of orders) {
    if (order.isValid) {
      for (const item of order.items) {
        if (item.inStock) {
          // Level 3.
          results.push(transformItem(item, order));
        }
      }
    }
  }
  return results;
}

// The sub-problem is extracted and named. Each function is independently readable.
function isProcessableItem(item: OrderItem): boolean {
  return item.inStock;
}

function processValidOrder(order: Order): ProcessedOrder[] {
  return order.items
    .filter(isProcessableItem)
    .map((item) => transformItem(item, order));
}

function processOrders(orders: Order[]): ProcessedOrder[] {
  return orders.filter((order) => order.isValid).flatMap(processValidOrder);
}
```

### Use early returns to reduce nesting.

Guard clauses at the top of a function establish preconditions and terminate
invalid paths immediately. This keeps the main logic at a consistent indentation
level and lets the reader skip branches that do not apply to their case without
reading to the end. Code that nests its happy path inside a chain of `if/else`
blocks requires the reader to hold every outer condition in context to understand
any inner line.

```ts
// Happy path is buried — the reader must track both branches of every condition.
function getDiscount(user: User, order: Order): number {
  if (user.isPremium) {
    if (order.total > 100) {
      return 0.2;
    } else {
      return 0.1;
    }
  } else {
    return 0;
  }
}

// Guard clauses first — each branch terminates immediately and independently.
function getDiscount(user: User, order: Order): number {
  if (!user.isPremium) return 0;
  if (order.total > 100) return 0.2;
  return 0.1;
}
```

### Avoid `else` after a `return`.

If the `if` branch returns, the `else` branch is unreachable without the `else`
keyword — removing it produces identical behaviour with one less level of
indentation and one less structural concept to parse.

## 7. Error Handling and try/catch

This section is not optional. Read it fully. The majority of JavaScript error
handling in production codebases is inconsistent — `try/catch` scattered without
a coherent model, errors swallowed into log statements that nobody reads, or
exceptions thrown for outcomes that are entirely expected. None of that is error
_handling_; it is error _deferral_.

### The Core Distinction: Exceptions vs. Results

One question determines the correct approach:

- **Is the failure a valid, expected outcome of this operation?**
  Encode it in the return type. Use the `Result` pattern or `ActionResult`.
  Do _not_ throw. Throwing for an expected outcome forces every caller into
  `try/catch` for a routine code path — that is the wrong abstraction.

- **Is the failure a violation of an invariant — something that cannot happen
  if the caller is correct?**
  Throw. With context. These failures represent programming errors, not runtime
  conditions, and they should be loud.

Getting this distinction backwards produces code that throws on "user not found"
(a completely normal database query result) or silently returns `undefined` when
the infrastructure is unreachable (a situation that warrants a crash, not silence).

```ts
// Throws for a routine outcome — every caller is forced into try/catch
// for something that is not exceptional.
function findUserById(id: string): User {
  const user = db.users.get(id);
  if (!user) throw new Error(`User ${id} not found`);
  return user;
}

// The return type encodes both outcomes. The caller handles them explicitly.
function findUserById(id: string): Result<User, string> {
  const user = db.users.get(id);
  if (!user) return { ok: false, error: `User ${id} not found` };
  return { ok: true, value: user };
}
```

### The Result Pattern

For operations that can fail in domain-meaningful ways — parsing, validation,
business rule evaluation — use a typed Result. This makes the failure visible
at the call site without exceptions.

```ts
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function parsePositiveInt(raw: string): Result<number, string> {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return { ok: false, error: `"${raw}" is not a valid integer` };
  if (n <= 0)
    return { ok: false, error: `Expected positive integer, got ${n}` };
  return { ok: true, value: n };
}

const result = parsePositiveInt(input);
if (!result.ok) {
  renderError(result.error);
  return;
}
processValue(result.value);
```

### Catch at boundaries, not everywhere.

`try/catch` belongs at the **edges** of your system — the HTTP request handler,
the job runner, the event listener, the top-level CLI entry point. These are
error boundaries. You should have a small, deliberate number of them.

Placing `try/catch` deep inside business logic does two things: it loses the
original error's stack context (because you caught it somewhere it doesn't mean
anything), and it creates false confidence — the error was "handled" by being
swallowed, not by actual recovery.

```ts
// Catching deep in the stack — the caller receives null with no information
// about what failed or why.
async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const user = await fetchUser(userId);
    const prefs = await fetchPreferences(userId);
    return mergeProfile(user, prefs);
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Let infrastructure errors propagate. Catch at the boundary where you can
// respond meaningfully — with a status code, a retry, a fallback.
async function loadUserProfile(userId: string): Promise<UserProfile> {
  const user = await fetchUser(userId);
  const prefs = await fetchPreferences(userId);
  return mergeProfile(user, prefs);
}

// Boundary — the only place a catch is warranted.
app.get("/profile/:id", async (req, res) => {
  try {
    const profile = await loadUserProfile(req.params.id);
    res.json(profile);
  } catch (err) {
    logger.error({ err, userId: req.params.id }, "Failed to load user profile");
    res.status(500).json({ error: "Could not load profile" });
  }
});
```

### Never swallow errors silently.

An empty `catch` block does not handle an error — it hides it. If you cannot
recover meaningfully at the point of catching, rethrow with context added.
Logging and continuing is also swallowing: the log entry is produced, the error
is gone, and the caller proceeds as if nothing happened.

```ts
// Hidden — no evidence the error occurred.
try {
  await syncData();
} catch (e) {}

// Logged and discarded — the log exists, the error does not propagate.
try {
  await syncData();
} catch (e) {
  console.error(e);
}

// Rethrown with context — origin preserved via cause, caller receives the full picture.
try {
  await syncData();
} catch (err) {
  throw new Error(
    `Data sync failed during nightly job: ${
      err instanceof Error ? err.message : String(err)
    }`,
    { cause: err }
  );
}
```

### Always use `Error.cause` when wrapping.

When you catch an error and rethrow a higher-level one, preserve the original via
`{ cause: err }`. This is a first-class feature of the `Error` constructor since
ES2022 and is supported in Node.js 16.9+. Without it, the original stack trace
and message are silently discarded — the debugging chain is broken at exactly the
point where the most useful information was.

### Type your caught errors correctly.

In TypeScript, the type of a caught value is `unknown` — not `Error`. This is
correct: JavaScript allows throwing any value, not just `Error` instances. Do not
cast the caught value to `Error` without checking; use `instanceof` first.

```ts
// Unsafe — throws a TypeError at runtime if someone threw a non-Error value.
} catch (e) {
  console.error((e as Error).message);
}

// Safe — checks before accessing Error-specific properties.
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(message);
}
```

### `finally` is for cleanup, not for logic.

`finally` runs unconditionally — whether the `try` block succeeded, threw, or
returned. This makes it the correct place for deterministic resource release:
closing a file handle, releasing a lock, resetting a loading indicator. It is the
wrong place for conditional branching or outcome-dependent logic, because
`finally` has no reliable way to know _why_ it is running. If your `finally`
block contains an `if`, that logic belongs in the `try` or `catch` instead.

### Summary: The decision table.

| Situation                                        | Approach                                            |
| ------------------------------------------------ | --------------------------------------------------- |
| Action completed — no data to return             | Return `ActionResult` (`{ success: true }`)         |
| Action failed — expected domain outcome          | Return `ActionResult` (`{ success: false, error }`) |
| Function produces data                           | Return `Result<T, string>` — value or typed error   |
| "Invalid input" — caller's contract violation    | Throw `TypeError` or `ValidationError`              |
| "Database unreachable" — infrastructure failure  | Throw, catch at the boundary                        |
| "This should never happen" — invariant violation | Throw `Error` with assertion message                |
| Wrapping a caught error for more context         | Rethrow with `{ cause: err }`                       |
| Returning `void`                                 | Never                                               |
| Swallowing an error silently                     | Never                                               |

## 8. Modules and Imports

### One concern per file.

A file is a module. A module should have a single, stateable purpose. If you
cannot describe what a file exports in one short phrase, the file has too many
concerns. Mixed-concern files couple unrelated code together — a change to the
user model now touches the file that also contains the database pool and the
currency formatter, which means every consumer of any of those things gets
pulled into the change's blast radius.

### No barrel re-exports of an entire directory.

An `index.ts` that re-exports every file in a directory is convenient at first
and becomes a problem at scale for three concrete reasons: it creates circular
dependency risks (file A imports from index, index exports file B, file B imports
from index), it prevents bundler tree-shaking from working correctly (the entire
barrel is pulled in even when only one export is needed), and it makes the true
source of any given export invisible to the reader.

Import from the specific file.

```ts
// The reader cannot tell where any of these come from without reading the barrel.
import { User, Order, formatDate, db } from "../common";

// The import path is the documentation.
import type { User } from "../models/user";
import { formatDate } from "../utils/date";
```

### Imports at the top, in order.

1. Node built-ins (`node:fs`, `node:path`)
2. External packages
3. Internal absolute paths
4. Internal relative paths

A blank line between groups. The reason is scanability: a reader looking for an
external dependency does not want to scan through internal imports to find it,
and a reader looking for a project-internal module does not want to scan through
`node_modules` references. The grouping externalises that information into
structure.

## 9. Comments

### Comments explain _why_, not _what_.

A comment that restates what the code does provides no information the code does
not already provide. It doubles the surface area that must be kept in sync — the
code and the comment can drift, and when they do, the comment actively misleads.
If you feel the need to explain what a line does, that is a signal the code is
unclear. Make the code clearer.

A comment that explains _why_ something is done the way it is provides
information the code cannot express on its own: constraints, historical context,
non-obvious performance reasons, intentional asymmetries.

```ts
// Redundant — states what the multiplication already states.
// Multiply price by quantity
const lineTotal = price * quantity;

// Useful — records a decision the code alone cannot communicate.
// VAT is applied at invoice generation time, not here; including it
// in the line total would cause double-application downstream.
const lineTotal = price * quantity;
```

### Document your contracts, not your mechanics.

JSDoc on exported functions communicates what the function _guarantees_ to its
callers: what inputs it requires, what it returns under which conditions, and
what a caller is expected to do with failures. It is not a place to describe
the implementation.

```ts
/**
 * Looks up a user by ID.
 *
 * Returns { ok: false } if no user exists with that ID — this is a normal
 * outcome, not an error. Throws only if the database connection is
 * unavailable; callers should let that propagate to the request boundary.
 */
async function fetchUser(id: string): Promise<Result<User, string>> { ... }
```

### TODO comments must have an owner and a ticket.

An unattributed `// TODO: fix this` has no owner, no timeline, and no context.
It accumulates. Attach a name and a tracking reference, or the observation is
worthless and should not be committed.

```ts
// No owner, no ticket — will not be resolved.
// TODO: handle this edge case

// Owner and ticket — actionable and traceable.
// TODO(alice): Handle users with no organizationId — JIRA-2891
```

## 10. Classes vs Functions

Prefer functions and plain objects over classes. The reason is scope: a class
introduces a shared mutable `this`, inheritance chains, and a constructor
lifecycle — all of which are overhead that pure functions do not carry. Pay that
overhead when it is genuinely warranted.

Classes are warranted when you have genuine encapsulation needs: **private
mutable state with a well-defined lifecycle**. A connection pool, a stateful
parser, an event emitter, a rate limiter — these have internal state that must
be hidden and a lifecycle (open, use, close) that the class manages. That is
what classes are for.

Classes are not warranted as a way to group related functions. A static-only
class is a module pretending to be a class — it has no state, no lifecycle, and
no benefit over named exports.

```ts
// A module disguised as a class — static methods, no state, no lifecycle.
class UserUtils {
  static formatDisplayName(user: User): string { ... }
  static getInitials(user: User): string { ... }
}

// Named exports are simpler, directly importable, and tree-shakeable.
export function formatDisplayName(user: User): string { ... }
export function getInitials(user: User): string { ... }
```

When you do use a class, it must have a single responsibility. A class that
manages a database connection should not also parse query results. A domain
entity should not contain HTTP logic. The same single-responsibility principle
that applies to functions applies to classes, plus the additional cost of
inheritance — which should be treated with additional suspicion.

## 11. Async Code

### Prefer `async/await` over `.then()` chains.

`.then()` chains are not wrong — they are the native Promise API. But they have
a concrete readability cost compared to `async/await`: error handling requires a
separate `.catch()` that applies to the entire chain rather than a scoped
`try/catch`; intermediate values are not directly accessible between steps without
nesting or outer `let` declarations; and stack traces from rejected promises are
less informative than those from `await` failures in most runtimes.

`async/await` is syntactic sugar over `.then()` and compiles to it. Use the
sugar: it reads as sequential logic, which is easier to follow, easier to debug,
and easier to refactor.

```ts
// Chains — intermediate values (user, permissions) are not directly accessible
// outside their own step; the error handler applies to all steps uniformly.
function loadDashboard(userId: string): Promise<Dashboard> {
  return fetchUser(userId)
    .then((user) => fetchPermissions(user.roleId))
    .then((permissions) => fetchWidgets(permissions))
    .then((widgets) => buildDashboard(widgets));
}

// Sequential and flat — each value is named and available to all subsequent steps.
async function loadDashboard(userId: string): Promise<Dashboard> {
  const user = await fetchUser(userId);
  const permissions = await fetchPermissions(user.roleId);
  const widgets = await fetchWidgets(permissions);
  return buildDashboard(widgets);
}
```

### Run independent async operations in parallel.

Sequential `await` for operations that do not depend on each other serialises
work that could run concurrently. The latency cost is the sum of all operation
durations instead of the maximum. Use `Promise.all` when operations are
independent — it is not an optimisation, it is the correct model.

```ts
// Sequential — total latency is fetchUser time + fetchAppConfig time.
const user = await fetchUser(id);
const config = await fetchAppConfig();

// Concurrent — total latency is max(fetchUser time, fetchAppConfig time).
const [user, config] = await Promise.all([fetchUser(id), fetchAppConfig()]);
```

### Never fire-and-forget without handling the rejection.

An unhandled promise rejection is a silent failure. In Node.js, unhandled
rejections emit a warning and, since Node 15, terminate the process by default.
In browsers, they produce a `unhandledrejection` event that is often invisible
in production. If you start an async operation without awaiting it, you must
attach a `.catch()` — both to handle the failure and to make the fire-and-forget
intent explicit to the reader.

```ts
// No rejection handler — the promise's failure disappears silently.
sendAnalyticsEvent(event);

// Explicit intent, failure acknowledged.
sendAnalyticsEvent(event).catch((err) =>
  logger.warn({ err }, "Analytics event failed — non-critical, continuing")
);
```

## 12. Forbidden Patterns

The patterns below are prohibited because each one has a documented, measurable
downside — not because they look bad. The reason is stated for each. If you
believe a reason is wrong or incomplete, open a discussion; the rule follows
the reason, not the other way around.

### `any` — Prohibited.

`any` disables type inference and type checking for the annotated value and
everything derived from it. See Section 5. There is no legitimate use of `any`
in new code; there is always an alternative. In legacy code that cannot yet be
typed, use `@ts-expect-error` with an explanation rather than spreading `any`
further through the type graph.

### `as unknown as T` — Prohibited.

A double cast via `unknown` tells the compiler to discard what it knows about a
type and accept a new assertion with zero evidence. It is the most aggressive
form of type suppression available without a compiler flag. The type system has
flagged an inconsistency; fix the inconsistency.

### `@ts-ignore` and `@ts-expect-error` without a written explanation — Prohibited.

Suppressions without explanations are undated, unattributed technical debt.
They cannot be evaluated, reviewed, or removed without reverse-engineering the
reason. If the suppression is correct, the reason can be stated in one sentence.
State it.

```ts
// Suppression with no context — cannot be reviewed or removed safely.
// @ts-ignore
doSomething(legacyValue);

// Suppression with rationale and removal condition — reviewable and temporary.
// @ts-expect-error — LegacyWidget predates our type definitions; remove after JIRA-2891.
doSomething(legacyValue);
```

### `void` return type — Prohibited.

See Section 4. A function that returns `void` communicates nothing to its caller
about whether it succeeded or failed. Every function must return an `ActionResult`,
a `Result<T, E>`, or meaningful domain data. If a function currently returns
`void`, it has not been finished.

### `==` instead of `===` — Prohibited.

JavaScript's `==` operator performs implicit type coercion before comparison,
following rules that are non-trivial to memorise and produce counter-intuitive
results (`null == undefined` is `true`; `0 == ""` is `true`; `0 == "0"` is
`true` but `"" == "0"` is `false`). `===` performs no coercion. There is no
situation in this codebase where coercion-based equality is the correct choice.

If you need to check for both `null` and `undefined`, write
`value === null || value === undefined`. It is two characters longer and
unambiguous.

### Mutable module-level state without explicit ownership — Prohibited.

A module-level variable that is read and written by multiple functions creates
implicit coupling between those functions through shared state. Changes to that
state are invisible at call sites; the order of calls matters in non-obvious
ways; and concurrent execution (worker threads, parallel async operations) can
produce data races. If shared mutable state is genuinely required, wrap it in
an explicit interface with named accessors that make every mutation visible.

### `console.log` in committed code — Prohibited.

`console.log` has no log levels, no structured fields, no automatic timestamps,
and cannot be filtered or silenced in production without monkey-patching. It was
designed as a development tool. Use a structured logger (`pino`, `winston`,
`@std/log`, or equivalent) that supports levels, JSON output, and runtime
configuration. The cost is one import and a slightly different call signature.
The benefit is observable, filterable, structured output in production.

## Final Words

There is no such thing as "clean code." There is code that is consistent and
code that is not. There is code that makes its intent legible and code that
conceals it. Those are not aesthetic categories — they are practical ones, with
measurable consequences for the time it takes to understand, modify, and debug
a system.

Every rule in this document is an attempt to reduce the cost of reading and
modifying code. Some rules are grounded in language semantics (ASI, coercion,
call-stack limits). Some are grounded in human cognitive constraints (working
memory, nesting depth). Some are conventions chosen for consistency, with the
reason stated. If a rule does not have a stated reason, that is a gap — open a
pull request against this document and add one.

This document is not finished. It will evolve as the codebase evolves, as the
language evolves, and as the team's experience accumulates. Any contributor is
welcome to propose changes. State your reasoning. The document changes when the
reasoning is sound, not when the preference is strong.

---

> Write code as if the reviewer knows where you live.

_This guide is maintained by the engineering team. Propose changes via pull
request. Rule changes require a stated reason and a review._
