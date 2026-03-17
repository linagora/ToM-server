<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/config-parser

## Purpose
Multi-source configuration loading and validation for all `@twake/*` packages. Loads configuration from JSON files and/or environment variables, applies type coercion (string→number/boolean/array/object), validates required keys, and rejects unknown keys. Has zero runtime dependencies.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Main export — `twakeConfig()` function and `ConfigDescription` type |
| `package.json` | Package manifest (`@twake/config-parser`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `twakeConfig(desc, defaultConfigFile?, useEnv?, useOldParser?)` is the sole public API
- `ConfigDescription` defines each config key's type, default, and required status
- Priority (new parser): env vars > config file > defaults
- Supported types: `number`, `boolean`, `array`, `json`, `object`, `string`
- Unknown keys in the config file throw `UnacceptedKeyError`
- Missing required keys throw `MissingRequiredConfigError`

### Testing Requirements
```bash
npx nx run  @twake/config-parser:test
```

### Common Patterns
```typescript
const config = twakeConfig({
  server_name: { type: 'string', required: true },
  port: { type: 'number', default: 3000 },
  debug: { type: 'boolean', default: false },
}, '/etc/twake/config.json', true);
```

## Dependencies

### Internal
None — this package has no `@twake/*` runtime dependencies.

### External
None — zero runtime dependencies.

<!-- MANUAL: -->
