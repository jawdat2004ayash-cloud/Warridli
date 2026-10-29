import { defineConfig } from '@playwright/test'
import { E2E_WEB_PORT } from './e2e/env.ts'

/**
 * Real-browser auth tests (D8): installed Chrome, real Laravel + MariaDB, real Sanctum cookies/CSRF.
 * Servers (5174 / 8020, never the dev ports) are started and stopped by e2e/global-setup.ts;
 * Laravel runs with APP_ENV=e2e against warridli_test only (guarded in AppServiceProvider).
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1, // one shared test DB and rate limiter
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${E2E_WEB_PORT}`,
    channel: 'chrome',
    locale: 'ar-SY',
    timezoneId: 'Asia/Damascus',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
})
