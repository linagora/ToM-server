import { sveltekit } from '@sveltejs/kit/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  return {
    plugins: [sveltekit()],
    test: {
      include: ['src/**/*.{test,spec}.{js,ts}']
    },
    server: {
      port: parseInt(env.PORT || '3000')
    }
  }
})
