<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# utils/src/

## Purpose
TypeScript source for the `@twake/utils` package. Two files (`errors.ts` and `utils.ts`) plus an `index.ts` barrel export. Provides Matrix error code constants, HTTP response helpers, request body parsing, parameter validation, and Matrix ID utilities.

## Key Files

| File | Description |
|------|-------------|
| `errors.ts` | `errCodes` object (all `M_*` Matrix error strings), `errMsg()` factory, `defaultMsg()` converter |
| `utils.ts` | `send()`, `jsonContent()`, `validateParameters()`, `epoch()`, `toMatrixId()`, `isMatrixId()`, `isValidUrl()`, `getLocalPart()`, `hostnameRe` regex, `expressAppHandler` type |
| `index.ts` | Re-exports everything from errors.ts and utils.ts |

## For AI Agents

### Working In This Directory
- `errMsg()` is the standard way to construct Matrix error responses — always use it over hand-crafting `{ errcode, error }` objects
- `send()` calls `res.json()` + `res.status()` and ends the response — do not call `res.end()` after it
- `validateParameters()` automatically sends error responses for missing/extra params — callback is only called on success
- Add new Matrix error codes to `errCodes` in `errors.ts` when needed

<!-- MANUAL: -->
