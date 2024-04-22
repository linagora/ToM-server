import { defineConfig, PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = defineConfig({
  use: {
    baseURL: 'http://127.0.0.1:4173'
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    timeout: 120000
  },
  testDir: 'tests'
})

export default config
