import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: 'http://localhost:4173'
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173'
  },
  testDir: 'tests'
})
