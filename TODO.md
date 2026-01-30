# TODOs

## TS Build File

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

## Limit Avatar upload size in common-settings-bridge

Add timeouts and size limits to outbound HTTP calls; prevent unbounded avatar downloads.

Two HTTP calls lack timeouts and can stall indefinitely:

- Synapse Admin API request has no timeout
- External avatar fetch has no timeout and no size limit

The avatar fetch is particularly risky—it downloads the entire buffer without
validating content-length or total bytes, creating memory exhaustion and SSRF exposure.
Node 18.20.8 natively supports fetch and AbortController, so implement timeouts
on both calls and add a size cap on avatar downloads:

Example implementation for avatar fetch

```typescript
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 10_000)
const response = await fetch(externalUrl, { signal: controller.signal })

clearTimeout(timeout)

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`)
}

const contentLength = Number(response.headers.get('content-length') || 0)
if (contentLength && contentLength > MAX_AVATAR_BYTES) {
  throw new Error(`Avatar too large: ${contentLength} bytes`)
}

const contentType = response.headers.get('content-type') ?? 'image/png'

const buffer = Buffer.from(await response.arrayBuffer())
if (buffer.length > MAX_AVATAR_BYTES) {
  throw new Error(`Avatar too large: ${buffer.length} bytes`)
}
```

## Improve TOM router in composes

The tom-matrix-client router has its rule label commented out on line 283,
but the remaining configuration labels (entrypoints, tls, priority, middlewares)
on lines 284-287 are still active. This creates a router without a matching rule,
which Traefik may reject or handle unexpectedly.

Either uncomment the rule or comment out all related labels for this router.

## Orchestration order verification doesn't actually verify order.

*packages/common-settings-bridge/src/bridge.test.ts*

The test attempts to verify call order by setting up mock implementations that
push to a callOrder array, but this approach has issues:

1. The first handleMessageFn call (line 571) executes before the order-tracking
   mocks are set up
2. After jest.clearAllMocks() and re-running, the mocks are called but the array
   population happens asynchronously
3. The test only verifies that each function was called, not the actual execution
   order

Consider either removing the order verification claim or using Jest's
mockFn.mock.invocationCallOrder to properly verify order.

Alternative approach using invocationCallOrder:

```typescript
// After handleMessageFn completes, verify order:
const parseOrder = (parseMessage as jest.Mock).mock.invocationCallOrder[0]
const validateOrder = (validateMessage as jest.Mock).mock.invocationCallOrder[0]
const getSettingsOrder = mockSettingsRepo.getUserSettings.mock.invocationCallOrder[0]
// ... etc

expect(parseOrder).toBeLessThan(validateOrder)
expect(validateOrder).toBeLessThan(getSettingsOrder)
// ... verify complete order chain
```

## Implement timeout and size validation for avatar uploads using uploadContentFromUrl()

The matrix-appservice-bridge SDK's uploadContentFromUrl() method doesn't expose
parameters for request timeouts or maximum file size limits. The effective size
limit is governed by the homeserver's media repository configuration
(m.upload.size), which may be unknown or misconfigured. Additionally, timeout
parameters don't apply to the upload side.

To prevent memory exhaustion from large external URLs, wrap the call with a custom
implementation:

- Add a timeout for the external URL fetch
- Perform a pre-flight HEAD request to check content-length before downloading
- Enforce a local maximum file size limit before uploading to the homeserver

Alternatively, verify the homeserver's media upload limit is appropriately
configured via GET /_matrix/media/v3/config.
