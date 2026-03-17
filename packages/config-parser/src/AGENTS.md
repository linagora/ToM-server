<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# config-parser/src/

## Purpose
TypeScript source for the `@twake/config-parser` package. Contains a single `index.ts` file implementing the entire configuration loading, validation, and type coercion pipeline. No subdirectories.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `twakeConfig()` function, `ConfigDescription` type, all internal helpers (coerceValue, loadConfigFromFile, applyEnvironmentVariables, etc.), and all error classes |

## For AI Agents

### Working In This Directory
- All logic is in a single file — keep it that way unless the file grows substantially
- Error classes (`ConfigError`, `InvalidNumberFormatError`, etc.) are exported for consumer use
- `useOldParser` flag exists for backwards compatibility — default is `true`; new code should use `false`

<!-- MANUAL: -->
