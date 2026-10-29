import { expect, test, type Page } from '@playwright/test'
import { installUiFixture, QUOTED_ID, RFQ_ID, type UiRole } from './ui-fixtures.ts'

async function checkSemantics(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  for (const control of await page.locator('button, input:not([type="hidden"]), select, textarea').all()) {
    if (!(await control.isVisible())) continue // Closed <details> content intentionally has no accessible name yet.
    await expect(control).toHaveAccessibleName(/\S/)
  }
  const brokenReferences = await page.locator('[aria-describedby], [aria-labelledby]').evaluateAll((nodes) => nodes.flatMap((node) =>
    ['aria-describedby', 'aria-labelledby'].flatMap((attr) => (node.getAttribute(attr) ?? '').split(/\s+/).filter((id) => id && !document.getElementById(id))),
  ))
  expect(brokenReferences).toEqual([])
}

const screens: Record<UiRole, string[]> = {
  guest: ['/login', '/register', '/register/buyer', '/register/supplier', '/forgot-password', '/reset-password?token=fixture&email=fixture%40example.test'],
  buyer: ['/account', '/rfqs', '/rfqs/new', `/rfqs/${RFQ_ID}`, '/notifications'],
  supplier: ['/account', '/supplier/categories', '/supplier/rfqs', `/supplier/rfqs/${RFQ_ID}`, `/supplier/rfqs/${QUOTED_ID}`, '/notifications'],
  admin: ['/account', '/admin', '/admin/companies', '/admin/rfqs', `/admin/rfqs/${RFQ_ID}`, '/admin/categories', '/admin/audit'],
}

for (const role of Object.keys(screens) as UiRole[]) {
  test(`${role}: Arabic semantics, named controls and responsive reflow`, async ({ page }, info) => {
    test.setTimeout(180_000)
    await installUiFixture(page, role)
    const widths = info.project.name === 'desktop' ? [320, 768, 1280] : [320, 360, 390]
    for (const path of screens[role]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)
      await checkSemantics(page)
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 })
        const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)
        if (width === 320) await page.screenshot({ path: info.outputPath(`${role}-${path.replace(/[^a-z0-9]/gi, '-')}-320.png`), fullPage: true })
        expect(overflow, `${role} ${path} at ${width}px`).toBeLessThanOrEqual(1)
      }
    }
  })
}

test('keyboard skip navigation and SPA navigation give a named page and predictable focus', async ({ page }) => {
  await installUiFixture(page, 'guest')
  await page.goto('/login')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'تخطَّ إلى المحتوى' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page).toHaveTitle('تسجيل الدخول — ورّدلي')
  await page.getByRole('link', { name: 'نسيت كلمة المرور؟' }).click()
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page).toHaveTitle(/استعادة كلمة المرور — ورّدلي/)
})

test('buyer quote confirmation supports keyboard context, Escape and focus return', async ({ page }) => {
  await installUiFixture(page, 'buyer')
  await page.goto(`/rfqs/${RFQ_ID}`)
  const card = page.getByRole('article').first()
  const choose = card.getByRole('button', { name: 'اختر هذا العرض', exact: true })
  await choose.focus()
  await page.keyboard.press('Enter')
  const group = card.getByRole('group', { name: /ستختار عرض/ })
  await expect(group).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(choose).toBeFocused()
  await expect(group).toHaveCount(0)
})

test('supplier withdrawal supports keyboard context, Escape and focus return', async ({ page }) => {
  await installUiFixture(page, 'supplier')
  await page.goto(`/supplier/rfqs/${QUOTED_ID}`)
  const withdraw = page.getByRole('button', { name: 'اسحب العرض', exact: true })
  await withdraw.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('group', { name: /هل تريد سحب عرضك/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(withdraw).toBeFocused()
})

test('closing a buyer request returns keyboard focus on cancel', async ({ page }) => {
  await installUiFixture(page, 'buyer')
  await page.goto(`/rfqs/${RFQ_ID}`)
  const trigger = page.getByRole('button', { name: 'أغلق الطلب دون اختيار عرض' })
  await trigger.click()
  await expect(page.getByRole('group', { name: /هل تريد إغلاق الطلب/ })).toBeFocused()
  await page.getByRole('button', { name: 'تراجع', exact: true }).click()
  await expect(trigger).toBeFocused()
})

test('empty, loading and failed notifications remain understandable and retry works', async ({ page }) => {
  await installUiFixture(page, 'buyer')
  let release = () => {}
  const waiting = new Promise<void>((resolve) => { release = resolve })
  let state: 'loading' | 'empty' | 'error' = 'loading'
  await page.route(/\/api\/notifications(?:\?.*)?$/, async (route) => {
    if (state === 'loading') await waiting
    await route.fulfill(state === 'error'
      ? { status: 500, json: { message: 'test-only error' } }
      : { json: { data: [], meta: { unread: 0, current_page: 1, last_page: 1, total: 0, per_page: 20 } } })
  })
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'الإشعارات', exact: true })).toBeVisible()
  await expect(page.getByRole('main').locator('[aria-busy="true"]').first()).toBeVisible()
  await expect(page.getByText('جارٍ التحميل…').first()).toBeAttached()
  state = 'empty'
  release()
  await expect(page.getByText('لا توجد إشعارات بعد')).toBeVisible()
  state = 'error'
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('تعذّر تحميل الإشعارات')
  state = 'empty'
  await page.getByRole('button', { name: 'أعد المحاولة' }).click()
  await expect(page.getByText('لا توجد إشعارات بعد')).toBeVisible()
})

test('design token text and control pairs retain their contrast thresholds', async ({ page }) => {
  await installUiFixture(page, 'guest')
  await page.goto('/login')
  const checks = await page.evaluate(() => {
    const tokens = getComputedStyle(document.documentElement)
    const luminance = (name: string) => {
      const hex = tokens.getPropertyValue(name).trim().replace('#', '')
      const channels = [0, 2, 4].map((offset) => {
        const n = parseInt(hex.slice(offset, offset + 2), 16) / 255
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
      })
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
    }
    const pairs: [string, string, number][] = []
    for (const surface of ['--c-paper', '--c-surface', '--c-surface-sunk']) {
      for (const ink of ['--c-ink', '--c-ink-2', '--c-ink-3']) pairs.push([ink, surface, 4.5])
    }
    for (const tone of ['ok', 'warn', 'danger', 'info', 'muted', 'signal']) pairs.push([`--c-${tone}`, `--c-${tone}-soft`, 4.5])
    pairs.push(['--c-surface', '--c-signal', 4.5], ['--c-ink-inverse', '--c-graphite', 4.5], ['--c-line-strong', '--c-surface', 3], ['--c-line-strong', '--c-paper', 3])
    return pairs.map(([a, b, minimum]) => {
      const x = luminance(a), y = luminance(b)
      return { pair: `${a}/${b}`, minimum, ratio: (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    })
  })
  for (const check of checks) expect(check.ratio, check.pair).toBeGreaterThanOrEqual(check.minimum)
})

test('image validation is announced and associated with the upload control', async ({ page }) => {
  await installUiFixture(page, 'buyer')
  await page.goto('/rfqs/new')
  const input = page.locator('input[type=file]')
  await input.setInputFiles({ name: 'unsupported.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') })
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAccessibleDescription(/JPG|PNG|WebP/)
  await expect(page.locator('#rfq-photos-problem')).toHaveAttribute('role', 'alert')
})

test('high contrast mode retains a visible keyboard focus indicator and native select affordance', async ({ page }) => {
  await installUiFixture(page, 'guest')
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/register/buyer')
  const email = page.getByLabel(/البريد الإلكتروني/)
  await email.focus()
  await page.keyboard.press('Tab')
  const focus = await page.locator(':focus').evaluate((el) => ({ outline: getComputedStyle(el).outlineStyle, shadow: getComputedStyle(el).boxShadow }))
  expect(focus.outline !== 'none' || focus.shadow !== 'none').toBe(true)
  expect(await page.getByLabel(/المنطقة/).evaluate((el) => getComputedStyle(el).appearance)).toBe('auto')
})

test('revealed contact details receive focus and lead to the WhatsApp action by Tab', async ({ page }) => {
  await installUiFixture(page, 'buyer')
  await page.route(/\/api\/rfqs\/[^/]+\/quotes\/\d+\/contact$/, (route) => route.fulfill({ json: { data: { phone: '+963944000111', whatsapp_url: 'https://wa.me/963944000111?text=test-only' } } }))
  await page.goto(`/rfqs/${RFQ_ID}`)
  const card = page.getByRole('article').first()
  await card.getByRole('button', { name: 'أظهر رقم واتساب المورّد' }).click()
  const contact = card.getByRole('region', { name: 'بيانات التواصل مع المورّد' })
  await expect(contact).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(contact.getByRole('link', { name: /افتح المحادثة/ })).toBeFocused()
})

test('200 percent text sizing and the longest unit price retain readable reflow', async ({ page }, info) => {
  await installUiFixture(page, 'buyer')
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(`/rfqs/${RFQ_ID}`)
  const number = page.getByRole('article').first().locator('p[data-long] .num')
  await expect(number).toBeVisible()
  expect(await number.evaluate((el) => el.getClientRects().length)).toBe(1)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await page.screenshot({ path: info.outputPath('buyer-text-200-percent.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: 'اختر هذا العرض', exact: true }).first()).toBeVisible()
})
