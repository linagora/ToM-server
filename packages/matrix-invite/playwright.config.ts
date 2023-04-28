import { defineConfig, PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = defineConfig({
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173
  },
  testDir: 'tests'
})

export default config
