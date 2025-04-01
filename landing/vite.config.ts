import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import { defineConfig } from 'vite'

installGlobals()

export default defineConfig({
  server: {
    port: 3000
  },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_lazyRouteDiscovery: true,
        v3_relativeSplatPath: true,
        v3_singleFetch: true,
        v3_throwAbortReason: true
      }
    })
  ]
})
