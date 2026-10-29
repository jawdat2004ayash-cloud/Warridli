import { expect, test, type APIRequestContext } from '@playwright/test'
import { artisan, expectNoHorizontalScroll, register, resetRateLimits, spa, xsrfHeaders } from './helpers.ts'

/**
 * Real-browser notifications (M4b): approval + specialty + a matching request reach the supplier's bell; opening a
 * notification marks it read and lands on the request; the supplier's quote reaches the buyer's bell; the logged-in
 * buyer's home page offers "request a price" instead of sign-up links. Desktop + mobile; warridli_test only.
 */

test.beforeAll(resetRateLimits)

async function categoryId(request: APIRequestContext, slug: string) {
  const categories = (await (await request.get('/api/categories')).json()) as { data: { id: number; slug: string }[] }
  return categories.data.find((c) => c.slug === slug)!.id
}

test('supplier and buyer are notified of the events that concern them', async ({ page, browser }, testInfo) => {
  const project = testInfo.project.name
  const description = `بيليا ضاغط الهواء ${Date.now()}-${project}`
  const supplierContext = await browser.newContext({ ...testInfo.project.use, baseURL: testInfo.project.use.baseURL })
  const supplier = await supplierContext.newPage()
  let rfqId = ''

  try {
    await test.step('a supplier is approved together with its bearings specialty (CLI, same audited actions)', async () => {
      const email = await register(supplier.request, `${project}-ntf-supplier`, 'supplier')
      const bearings = await categoryId(supplier.request, 'bearings')
      expect((await supplier.request.put('/api/supplier/categories', { headers: await xsrfHeaders(supplier.request), data: { category_ids: [bearings] } })).status()).toBe(200)
      artisan(`warridli:approve-supplier ${email} --force --no-interaction`)
    })

    await test.step('the logged-in buyer sees "request a price" on the home page, not sign-up links', async () => {
      await register(page.request, `${project}-ntf-buyer`)
      await page.goto('/')
      await expect(page.getByRole('link', { name: 'اطلب سعر قطعة الآن' })).toBeVisible()
      await expect(page.getByRole('main').getByRole('link', { name: 'أنشئ حساباً جديداً' })).toHaveCount(0)
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: testInfo.outputPath('home-buyer.png'), fullPage: true })
      await page.getByRole('link', { name: 'اطلب سعر قطعة الآن' }).click()
      await expect(page).toHaveURL(/\/rfqs\/new$/)
    })

    await test.step('the buyer posts a bearings request (real API)', async () => {
      const areas = (await (await page.request.get('/api/areas')).json()) as { data: { id: number }[] }
      const response = await page.request.post('/api/rfqs', {
        headers: await xsrfHeaders(page.request),
        multipart: { description, quantity: '1', unit: 'piece', urgency: 'normal', area_id: String(areas.data[0]!.id), category: String(await categoryId(page.request, 'bearings')) },
      })
      expect(response.status()).toBe(201)
      rfqId = ((await response.json()) as { data: { id: string } }).data.id
    })

    await test.step('the supplier\'s bell counts 3; opening the request notification marks it read and opens the request', async () => {
      await supplier.goto('/')
      const bell = supplier.getByRole('link', { name: 'الإشعارات — 3 غير مقروءة' })
      await expect(bell).toBeVisible()
      await bell.click()
      await expect(supplier.getByRole('heading', { name: 'الإشعارات' })).toBeVisible()
      await expect(supplier.getByRole('link', { name: /تمت الموافقة على حساب المورّد/ })).toBeVisible()
      await expect(supplier.getByRole('link', { name: /اعتُمد تخصص «بيليا ورولمان/ })).toBeVisible()
      await expectNoHorizontalScroll(supplier)
      await supplier.screenshot({ path: testInfo.outputPath('notifications-supplier.png'), fullPage: true })

      await supplier.getByRole('link', { name: new RegExp(description) }).click()
      await expect(supplier).toHaveURL(new RegExp(`/supplier/rfqs/${rfqId}$`))
      await expect(supplier.getByRole('heading', { name: description })).toBeVisible()
      await expect(supplier.getByRole('link', { name: 'الإشعارات — 2 غير مقروءة' })).toBeVisible()
    })

    await test.step('the supplier quotes; the buyer is told and lands on the comparison', async () => {
      const quote = await supplier.request.put(`/api/supplier/rfqs/${rfqId}/quote`, {
        headers: await xsrfHeaders(supplier.request),
        data: { unit_price: '75000', currency: 'SYP', condition: 'new', stock_status: 'in_stock', fulfillment: 'pickup', valid_until: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) },
      })
      expect(quote.status()).toBe(200)

      await page.goto('/rfqs')
      await page.getByRole('link', { name: 'الإشعارات — 1 غير مقروءة' }).click()
      await page.getByRole('link', { name: /وصلك عرض سعر جديد/ }).first().click()
      await expect(page).toHaveURL(new RegExp(`/rfqs/${rfqId}$`))
      await expect(page.getByText(/وصلك\s*1\s*عرض/)).toBeVisible()
      await expect(page.getByRole('link', { name: /^الإشعارات$/ })).toBeVisible()
    })

    await test.step('the supplier marks everything read; the badge disappears', async () => {
      await supplier.goto('/notifications')
      await supplier.getByRole('button', { name: 'علّم الكل كمقروء' }).click()
      await expect(supplier.getByText('قرأت كل الإشعارات.')).toBeVisible()
      await expect(supplier.getByRole('link', { name: /^الإشعارات$/ })).toBeVisible()
    })

    await test.step('one person\'s notifications are invisible to another', async () => {
      const mine = (await (await supplier.request.get('/api/notifications', { headers: spa })).json()) as { data: { id: string }[] }
      const response = await page.request.post(`/api/notifications/${mine.data[0]!.id}/read`, { headers: await xsrfHeaders(page.request) })
      expect(response.status()).toBe(404)
    })
  } finally {
    await supplierContext.close()
  }
})
