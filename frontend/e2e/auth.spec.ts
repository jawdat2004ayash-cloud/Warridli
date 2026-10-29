import { expect, test, type Page } from '@playwright/test'

/**
 * Real-browser Sanctum auth journey: registration, session cookie, CSRF, logout invalidation,
 * keyboard-only login, wrong password, supplier registration, phone layout.
 * Runs once per project (desktop, mobile); each run uses fresh, clearly fake accounts.
 */

const SESSION_COOKIE = 'warridli-session'

// Fail fast (instead of timing out field by field) if Laravel/MariaDB isn't really serving through the proxy.
test.beforeAll(async ({ request }) => {
  const health = await request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok', database: 'ok' })
})

function account(project: string, kind: 'buyer' | 'supplier') {
  const stamp = `${Date.now()}-${project}`
  return {
    name: kind === 'buyer' ? 'أبو خالد' : 'أبو سامر',
    email: `e2e-${kind}-${stamp}@example.test`,
    // Generated per run; never logged.
    password: `Wr-${stamp}-x9`,
    company: kind === 'buyer' ? 'ورشة الأمل للصيانة (اختبار)' : 'محل النور لقطع الغيار (اختبار)',
    phone: '٠٩٤٤ ١٢٣ ٤٥٦',
  }
}

/** Raw fetch from the page: same cookies as the app, but deliberately WITHOUT the X-XSRF-TOKEN header. */
const apiStatus = (page: Page, path: string, method: 'GET' | 'POST' = 'GET') =>
  page.evaluate(
    async ([p, m]) => (await fetch(p, { method: m, credentials: 'same-origin', headers: { Accept: 'application/json' } })).status,
    [path, method] as const,
  )

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

async function fillRegistration(page: Page, a: ReturnType<typeof account>) {
  await page.getByLabel(/^الاسم/).fill(a.name)
  await page.getByLabel('البريد الإلكتروني').fill(a.email)
  await page.getByLabel(/^كلمة المرور/).fill(a.password)
  await page.getByLabel('أعد كتابة كلمة المرور').fill(a.password)
  await page.getByLabel(/^اسم (الورشة|المحل)/).fill(a.company)
  await page.getByLabel('رقم الواتساب').fill(a.phone)
  const area = page.getByLabel('المنطقة')
  await expect(area).toBeEnabled() // areas loaded from the real API
  await area.selectOption({ index: 1 })
}

test('buyer: register → session → CSRF → logout → keyboard login', async ({ page, context }, testInfo) => {
  const buyer = account(testInfo.project.name, 'buyer')

  await test.step('register through the UI', async () => {
    await page.goto('/')
    await page.getByRole('link', { name: 'أنشئ حساباً جديداً' }).click()
    await expectNoHorizontalScroll(page)
    await page.getByRole('link', { name: /أحتاج قطعة غيار/ }).click()
    await expect(page.getByRole('heading', { name: 'سجّل ورشتك أو معملك' })).toBeVisible()

    // Empty submit → Arabic error summary that takes focus, nothing sent.
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
    await expect(page.getByRole('alert')).toBeFocused()
    await expect(page.getByRole('alert')).toContainText('اكتب اسمك.')

    await fillRegistration(page, buyer)
    await expect(page.getByRole('alert')).toHaveCount(0) // fixed fields drop their errors immediately
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: testInfo.outputPath('register-filled.png'), fullPage: true })
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click()

    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByText('تم إنشاء حسابك بنجاح.')).toBeVisible()
    await expect(page.getByText(buyer.company)).toBeVisible()
    await expect(page.getByText('+963944123456')).toBeVisible() // normalized by the server
    await page.screenshot({ path: testInfo.outputPath('account.png'), fullPage: true })
  })

  await test.step('session cookie is HttpOnly and survives a reload', async () => {
    const cookies = await context.cookies()
    const session = cookies.find((c) => c.name === SESSION_COOKIE)
    const xsrf = cookies.find((c) => c.name === 'XSRF-TOKEN')
    expect(session?.httpOnly).toBe(true)
    expect(session?.sameSite).toBe('Lax')
    expect(xsrf?.httpOnly).toBe(false) // must be readable so the SPA can echo it
    expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE)

    await page.reload()
    await expect(page.getByRole('heading', { name: 'حسابي' })).toBeVisible()
    expect(await apiStatus(page, '/api/me')).toBe(200)
  })

  await test.step('CSRF: requests without same-origin proof need a valid token', async () => {
    // Laravel 13 CSRF passes if EITHER the browser-set `Sec-Fetch-Site: same-origin` header OR a valid
    // X-XSRF-TOKEN is present. page.request shares this browser's cookies but sends no Fetch Metadata,
    // so it stands in for a forged request that carries the victim's cookies.
    const spa = { Accept: 'application/json', Origin: `http://localhost:${new URL(page.url()).port}`, Referer: page.url() }
    const xsrf = decodeURIComponent((await context.cookies()).find((c) => c.name === 'XSRF-TOKEN')!.value)

    for (const headers of [
      spa, // cookies only, no token
      { ...spa, 'X-XSRF-TOKEN': 'forged-token' },
      { ...spa, 'Sec-Fetch-Site': 'cross-site', 'X-XSRF-TOKEN': 'forged-token' },
    ]) {
      expect((await page.request.post('/api/auth/logout', { headers })).status()).toBe(419)
    }
    expect(await apiStatus(page, '/api/me')).toBe(200) // still logged in

    // The real token is accepted (proves the 419s above were CSRF, not something else) — use a
    // harmless endpoint so we stay logged in.
    const withToken = await page.request.post('/api/auth/forgot-password', {
      headers: { ...spa, 'X-XSRF-TOKEN': xsrf },
      data: { email: 'nobody@example.test' },
    })
    expect(withToken.status()).toBe(200)

    // A non-SPA client holding the cookies but no stateful Origin gets no session at all.
    const direct = await page.request.post('/api/auth/logout', { headers: { Accept: 'application/json', Origin: 'http://evil.example' } })
    expect(direct.status()).toBe(401)
    expect(await apiStatus(page, '/api/me')).toBe(200)
  })

  await test.step('logout invalidates the session on the server', async () => {
    const before = (await context.cookies()).find((c) => c.name === SESSION_COOKIE)!

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('سجّلت الخروج بنجاح.')).toBeVisible()
    expect(await apiStatus(page, '/api/me')).toBe(401)

    // Replaying the old session cookie must not log anyone back in.
    await context.addCookies([before])
    expect(await apiStatus(page, '/api/me')).toBe(401)

    await page.goto('/account')
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/)
  })

  await test.step('wrong password shows a clear Arabic message', async () => {
    await page.getByLabel('البريد الإلكتروني').fill(buyer.email)
    await page.getByLabel(/^كلمة المرور/).fill('not-the-password-1')
    await page.getByRole('button', { name: 'دخول' }).click()
    await expect(page.getByRole('alert')).toHaveText('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
    await expect(page.getByRole('alert')).toBeFocused()
  })

  await test.step('keyboard-only login rotates the session id and returns to the requested page', async () => {
    const guestSession = (await context.cookies()).find((c) => c.name === SESSION_COOKIE)?.value

    await page.getByLabel('البريد الإلكتروني').focus()
    await page.keyboard.press('Control+A')
    await page.keyboard.type(buyer.email)
    await page.keyboard.press('Tab')
    await expect(page.getByLabel(/^كلمة المرور/)).toBeFocused()
    await page.keyboard.type(buyer.password)
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByText(`أهلاً ${buyer.name}، تم تسجيل دخولك.`)).toBeVisible()
    const loggedInSession = (await context.cookies()).find((c) => c.name === SESSION_COOKIE)?.value
    expect(loggedInSession).toBeTruthy()
    expect(loggedInSession).not.toBe(guestSession) // session fixation protection
  })
})

test('supplier: registration lands on "under review"', async ({ page }, testInfo) => {
  const supplier = account(testInfo.project.name, 'supplier')

  await page.goto('/register/supplier')
  await expect(page.getByRole('heading', { name: 'سجّل محلك أو شركتك' })).toBeVisible()
  await fillRegistration(page, supplier)
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()

  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByText('تم إنشاء حسابك بنجاح.')).toBeVisible()
  await expect(page.getByText('حسابك قيد المراجعة')).toBeVisible()
  await expect(page.getByText('قيد المراجعة', { exact: true })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: testInfo.outputPath('supplier-account.png'), fullPage: true })
})

test('login and register pages fit a phone screen', async ({ page }, testInfo) => {
  for (const path of ['/login', '/register', '/register/buyer', '/forgot-password']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalScroll(page)
  }
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true })
})
