import { execSync } from 'node:child_process'
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { BACKEND_DIR, backendEnv, E2E_WEB_PORT } from './env.ts'

/** Runs an artisan command against the e2e Laravel config (warridli_test only, see env.ts). */
export const artisan = (args: string) =>
  execSync(`php artisan ${args}`, { cwd: BACKEND_DIR, env: { ...process.env, ...backendEnv }, stdio: 'ignore' })

/**
 * An admin account in warridli_test only (APP_ENV=e2e refuses any other DB). The real path for people is the
 * interactive `warridli:create-admin` (D19); here the generated credentials travel in environment variables,
 * never on the command line.
 */
export function createTestAdmin(label: string) {
  const stamp = `${Date.now()}-${label}`
  const admin = { email: `e2e-admin-${stamp}@example.test`, password: `Adm-${stamp}-x9`, name: 'مدير الاختبار' }
  execSync(
    `php artisan tinker --execute="$u = new App\\Models\\User; $u->forceFill(['name' => getenv('E2E_ADMIN_NAME'), 'email' => getenv('E2E_ADMIN_EMAIL'), 'password' => bcrypt(getenv('E2E_ADMIN_PASSWORD')), 'is_admin' => true])->save();"`,
    {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...backendEnv, E2E_ADMIN_NAME: admin.name, E2E_ADMIN_EMAIL: admin.email, E2E_ADMIN_PASSWORD: admin.password },
      stdio: 'ignore',
    },
  )
  return admin
}

export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const response = await request.post('/api/auth/login', { headers: await xsrfHeaders(request), data: { email, password } })
  expect(response.status()).toBe(200)
}

/** Earlier specs use up the per-IP registration budget (5/min); reset rate-limit counters (test DB only). */
export const resetRateLimits = () => artisan('cache:clear --no-interaction')

// Sanctum only treats requests from the SPA's own origin as session requests (D13); the browser sends these itself.
export const spa = { Origin: `http://localhost:${E2E_WEB_PORT}`, Referer: `http://localhost:${E2E_WEB_PORT}/`, Accept: 'application/json' }

export async function xsrfHeaders(request: APIRequestContext) {
  await request.get('/sanctum/csrf-cookie', { headers: spa })
  const xsrf = (await request.storageState()).cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? ''
  return { ...spa, 'X-XSRF-TOKEN': decodeURIComponent(xsrf) }
}

/** Registers a fresh account through the real API with the context's cookies (session + XSRF); returns its email. */
export async function register(request: APIRequestContext, label: string, type: 'buyer' | 'supplier' = 'buyer') {
  const headers = await xsrfHeaders(request)
  const areas = (await (await request.get('/api/areas')).json()) as { data: { id: number }[] }
  const stamp = `${Date.now()}-${label}`
  const email = `e2e-${type}-${stamp}@example.test`
  const response = await request.post('/api/auth/register', {
    headers,
    data: {
      name: type === 'buyer' ? 'أبو خالد' : 'أبو سامر',
      email,
      password: `Wr-${stamp}-x9`, // generated per run, never logged
      password_confirmation: `Wr-${stamp}-x9`,
      account_type: type,
      // Distinct supplier names make comparison screenshots readable.
      company_name: type === 'buyer' ? 'معمل البلاستيك (اختبار)' : `محل قطع غيار ${label.split('-').pop()} (اختبار)`,
      whatsapp_phone: '0944123456',
      area_id: areas.data[0]!.id,
    },
  })
  expect(response.status()).toBe(201)
  return email
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}
