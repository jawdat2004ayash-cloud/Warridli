import { expect, test } from '@playwright/test'
import { readFile, stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import { installUiFixture } from './ui-fixtures.ts'

// Exercise the actual build, including hashed chunks and its failure boundary. Only synthetic API data.
const dist = path.resolve(import.meta.dirname, '../dist')
let server: Server
let origin: string
let manifest: Record<string, { file: string; isDynamicEntry?: boolean }>
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const chunk = (source: string) => `/` + manifest[`src/pages/${source}.tsx`]!.file

test.beforeAll(async () => {
  manifest = JSON.parse(await readFile(path.join(dist, '.vite/manifest.json'), 'utf8'))
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
      let file = path.resolve(dist, `.${pathname}`)
      const relative = path.relative(dist, file)
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return }
      if (!path.extname(pathname) || (await stat(file)).isDirectory()) file = path.join(dist, 'index.html')
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
      res.end(await readFile(file))
    } catch { res.writeHead(404).end() }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No local build server port')
  origin = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())) })

test('production defers page code until navigation and retains route guards', async ({ page }) => {
  await installUiFixture(page, 'guest')
  const requested = new Set<string>()
  page.on('request', (request) => requested.add(new URL(request.url()).pathname))
  await page.goto(origin)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(requested.has(chunk('auth/LoginPage'))).toBe(false)
  expect(requested.has(chunk('DesignSpecimenPage'))).toBe(false)
  for (const [key, value] of Object.entries(manifest)) {
    if (key.startsWith('src/pages/admin/') && value.isDynamicEntry) expect(requested.has(`/${value.file}`)).toBe(false)
  }
  await page.getByRole('navigation', { name: 'الحساب' }).getByRole('link', { name: 'تسجيل الدخول' }).click()
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  expect(requested.has(chunk('auth/LoginPage'))).toBe(true)
  await page.goto(`${origin}/admin/companies`)
  await expect(page).toHaveURL(/\/login\?next=/)
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'المورّدون والشركات' })).toHaveCount(0)
})

test('production chunk failure has a private accessible retry and a full reload recovers', async ({ page }) => {
  await installUiFixture(page, 'guest')
  const loginChunk = `**${chunk('auth/LoginPage')}`
  await page.route(loginChunk, (route) => route.fulfill({ status: 503, body: 'synthetic chunk failure' }))
  await page.goto(`${origin}/login`)
  await expect(page.getByRole('heading', { name: 'تعذّر تحميل الصفحة', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page).toHaveTitle('تعذّر تحميل الصفحة — ورّدلي')
  await expect(page.locator('body')).not.toContainText('synthetic chunk failure')
  await expect(page.locator('body')).not.toContainText(/TypeError|Failed to fetch|\/assets\//)
  await page.unroute(loginChunk)
  await page.getByRole('button', { name: 'أعد تحميل الصفحة', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('تسجيل الدخول — ورّدلي')
})

test('slow production page code preserves skip navigation and focus across loading', async ({ page }) => {
  await installUiFixture(page, 'guest')
  let release!: () => void
  let requested = false
  const ready = new Promise<void>((resolve) => { release = resolve })
  await page.route(`**${chunk('auth/LoginPage')}`, async (route) => { requested = true; await ready; await route.continue() })
  try {
    await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' })
    // Wait for the blocked chunk, not an ambiguous skeleton: React can retain a hidden auth placeholder.
    await expect.poll(() => requested).toBe(true)
    await expect(page.getByRole('main')).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'تخطَّ إلى المحتوى' })
    await expect(skip).toBeFocused()
    release()
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible()
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('main')).toBeFocused()
  } finally { release() }
})
