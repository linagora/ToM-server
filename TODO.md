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
      "@twake/common-settings": ["./packages/common-settings/src"],
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

## Improve TOM router in composes

The tom-matrix-client router has its rule label commented out on line 283,
but the remaining configuration labels (entrypoints, tls, priority, middlewares)
on lines 284-287 are still active. This creates a router without a matching rule,
which Traefik may reject or handle unexpectedly.

Either uncomment the rule or comment out all related labels for this router.

## Common Settings Bridge

### Multi threading support

The Common Settings Bridge should be updated to support multi-threading.
Each message should be processed in its own thread to improve performance
and responsiveness, especially under high load.

### Avatar Max Size Checks Configuration + Homeserver max upload size

The current implementation of avatar max size checks in the Common Settings Bridge
is configurable. However, it does not take into account the maximum upload size
set by the homeserver. This could lead to situations where users attempt to upload
avatars that exceed the homeserver's limits, resulting in failed uploads.
