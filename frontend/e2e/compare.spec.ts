import { expect, test, type APIRequestContext, type Browser, type TestInfo } from '@playwright/test'
import { artisan, expectNoHorizontalScroll, register, resetRateLimits, spa, xsrfHeaders } from './helpers.ts'

/**
 * Real-browser buyer decision (M3c): two approved suppliers quote; the buyer compares (cheapest first), reveals one
 * supplier's WhatsApp number, is protected when a supplier edits a price while the page is open, chooses a quote
 * (closing the RFQ); the chosen supplier is told, the other learns nothing; another buyer gets 404. Desktop + mobile.
 */

test.beforeAll(resetRateLimits)

async function newContext(browser: Browser, testInfo: TestInfo) {
  return browser.newContext({ baseURL: testInfo.project.use.baseURL })
}

async function approvedSupplier(request: APIRequestContext, label: string, bearingsId: number) {
  const email = await register(request, label, 'supplier')
  expect((await request.put('/api/supplier/categories', { headers: await xsrfHeaders(request), data: { category_ids: [bearingsId] } })).status()).toBe(200)
  artisan(`warridli:approve-supplier ${email} --force --no-interaction`)
}

async function putQuote(request: APIRequestContext, rfqId: string, overrides: Record<string, unknown>) {
  const validUntil = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const response = await request.put(`/api/supplier/rfqs/${rfqId}/quote`, {
    headers: await xsrfHeaders(request),
    data: { currency: 'SYP', condition: 'new', stock_status: 'in_stock', fulfillment: 'pickup', valid_until: validUntil, ...overrides },
  })
  expect(response.status()).toBe(200)
}

test('buyer compares quotes, reveals a number, survives a concurrent edit and chooses a quote', async ({ page, browser }, testInfo) => {
  const project = testInfo.project.name
  const description = `بيليا مكبس ${Date.now()}-${project}`

  // Buyer + RFQ (real API, buyer's own browser context).
  await register(page.request, `${project}-cmp-buyer`)
  const categories = (await (await page.request.get('/api/categories')).json()) as { data: { id: number; slug: string }[] }
  const bearingsId = categories.data.find((c) => c.slug === 'bearings')!.id
  const areas = (await (await page.request.get('/api/areas')).json()) as { data: { id: number }[] }
  const created = await page.request.post('/api/rfqs', {
    headers: await xsrfHeaders(page.request),
    multipart: { description, quantity: '4', unit: 'piece', urgency: 'normal', area_id: String(areas.data[0]!.id), category: String(bearingsId) },
  })
  expect(created.status()).toBe(201)
  const rfqId = ((await created.json()) as { data: { id: string } }).data.id

  // Two approved suppliers quote.
  const supplierA = await newContext(browser, testInfo)
  const supplierB = await newContext(browser, testInfo)
  try {
    await approvedSupplier(supplierA.request, `${project}-cmp-a`, bearingsId)
    await approvedSupplier(supplierB.request, `${project}-cmp-b`, bearingsId)
    await putQuote(supplierA.request, rfqId, { unit_price: '90000', stock_status: 'on_order', lead_time_days: 3, notes: 'أصلية مع فاتورة' })
    await putQuote(supplierB.request, rfqId, { unit_price: '120000' })

    await test.step('compare: cheapest first, totals, no phone numbers on the page', async () => {
      await page.goto(`/rfqs/${rfqId}`)
      await expect(page.getByText('وصلك 2 عروض')).toBeVisible()
      const cards = page.getByRole('article')
      await expect(cards).toHaveCount(2)
      await expect(cards.first()).toContainText('الأرخص')
      await expect(cards.first()).toContainText('360,000')
      await expect(cards.first()).toContainText('خلال 3 أيام')
      await expect(page.locator('main')).not.toContainText('+963')
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: testInfo.outputPath('compare-quotes.png'), fullPage: true })
    })

    await test.step('reveal the cheapest supplier\'s WhatsApp', async () => {
      const first = page.getByRole('article').first()
      await first.getByRole('button', { name: 'أظهر رقم واتساب المورّد' }).click()
      await expect(first.getByText('+963944123456')).toBeVisible()
      await expect(first.getByRole('link', { name: /افتح المحادثة في واتساب/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/963944123456\?text=/)
    })

    await test.step('a supplier edits its price while the page is open → clear refusal, fresh price shown', async () => {
      await page.waitForTimeout(1100) // updated_at has one-second precision
      await putQuote(supplierB.request, rfqId, { unit_price: '130000' })
      const second = page.getByRole('article').nth(1)
      await second.getByRole('button', { name: 'اختر هذا العرض' }).click()
      await second.getByRole('button', { name: 'نعم، اختر هذا العرض' }).click()
      await expect(page.getByText('عدّل المورّد هذا العرض بعد أن فتحت الصفحة. راجع السعر الجديد ثم اختر من جديد.')).toBeVisible()
      await expect(page.getByRole('article').nth(1)).toContainText('520,000') // 4 × 130,000, reloaded
    })

    await test.step('choose the cheapest quote (with confirmation) → RFQ closed', async () => {
      const first = page.getByRole('article').first()
      await first.getByRole('button', { name: 'اختر هذا العرض' }).click()
      await first.getByRole('button', { name: 'نعم، اختر هذا العرض' }).click()
      await expect(page.getByText('اخترت عرضاً وأغلقت الطلب.')).toBeVisible()
      await expect(page.getByText('العرض الذي اخترته')).toBeVisible()
      await expect(page.getByRole('button', { name: 'اختر هذا العرض' })).toHaveCount(0)
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: testInfo.outputPath('compare-chosen.png'), fullPage: true })
    })

    await test.step('the chosen supplier is told; the other learns nothing about the winner', async () => {
      const aPage = await supplierA.newPage()
      await aPage.goto(`/supplier/rfqs/${rfqId}`)
      await expect(aPage.getByText('اختار المشتري عرضك.')).toBeVisible()

      const b = await supplierB.request.get(`/api/supplier/rfqs/${rfqId}`, { headers: spa })
      const bJson = JSON.stringify(await b.json())
      expect(bJson).toContain('"selected":false')
      expect(bJson).not.toContain('90000')
    })
  } finally {
    await supplierA.close()
    await supplierB.close()
  }

  await test.step('another buyer gets 404 for the quotes', async () => {
    const other = await newContext(browser, testInfo)
    try {
      await register(other.request, `${project}-cmp-other`)
      expect((await other.request.get(`/api/rfqs/${rfqId}/quotes`, { headers: spa })).status()).toBe(404)
    } finally {
      await other.close()
    }
  })
})
