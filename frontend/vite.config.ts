import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// The SPA and the Laravel API must be same-origin for Sanctum cookie auth (D-A2).
// In dev, Vite proxies /api and /sanctum to Laravel, so the browser only ever talks to :5173.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    build: { manifest: true }, // inspect the actual production entry dependency graph in M5c checks
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget },
        '/sanctum': { target: apiTarget },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'], // e2e/ is Playwright's

      setupFiles: ['./src/test/setup.ts'],
      css: { modules: { classNameStrategy: 'non-scoped' } },
    },
  }
})
