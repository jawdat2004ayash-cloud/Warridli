import { expect, test, type APIRequestContext } from '@playwright/test'
import { artisan, expectNoHorizontalScroll, register, resetRateLimits, spa, xsrfHeaders } from './helpers.ts'

/**
 * Real-browser supplier journey (M3b): a supplier chooses specialties, is approved (CLI, as an operator would
 * until the admin panel exists), finds the buyer's request in its inbox without any buyer identity, quotes,
 * edits, withdraws and re-submits; an approved supplier in another specialty gets 404. Desktop + mobile.
 */

test.beforeAll(resetRateLimits)

async function categoryId(request: APIRequestContext, slug: string) {
  const categories = (await (await request.get('/api/categories')).json()) as { data: { id: number; slug: string }[] }
  return categories.data.find((c) => c.slug === slug)!.id
}

test('approved supplier finds a matching request and manages its quote; others cannot see it', async ({ page, browser }, testInfo) => {
  const stamp = `${Date.now()}-${testInfo.project.name}`
  const description = `بيليا مضخة التبريد ${stamp}`
  let rfqId = ''

  await test.step('a buyer posts a bearings request (real API)', async () => {
    const buyer = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
    try {
      await register(buyer.request, `${testInfo.project.name}-buyer`)
      const areas = (await (await buyer.request.get('/api/areas')).json()) as { data: { id: number }[] }
      const response = await buyer.request.post('/api/rfqs', {
        headers: await xsrfHeaders(buyer.request),
        multipart: {
          description,
          part_number: '6205-2RS',
          quantity: '4',
          unit: 'piece',
          urgency: 'urgent',
          area_id: String(areas.data[0]!.id),
          category: String(await categoryId(buyer.request, 'bearings')),
        },
      })
      expect(response.status()).toBe(201)
      rfqId = ((await response.json()) as { data: { id: string } }).data.id
    } finally {
      await buyer.close()
    }
  })

  await test.step('supplier under review chooses specialties, then is approved', async () => {
    const email = await register(page.request, `${testInfo.project.name}-supplier`, 'supplier')
    await page.goto('/supplier/rfqs')
    await expect(page.getByText('حسابك قيد المراجعة')).toBeVisible()
    await page.getByRole('link', { name: 'اختر تخصصاتك الآن' }).click()
    await page.getByRole('checkbox', { name: /بيليا ورولمان/ }).check()
    await page.getByRole('button', { name: 'احفظ التخصصات' }).click()
    await expect(page.getByText('تم حفظ تخصصاتك.')).toBeVisible()
    await expectNoHorizontalScroll(page)

    artisan(`warridli:approve-supplier ${email} --force --no-interaction`)
  })

  await test.step('the request is in the inbox, without the buyer\'s identity', async () => {
    await page.goto('/supplier/rfqs')
    const row = page.getByRole('link', { name: new RegExp(description) })
    await expect(row).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: testInfo.outputPath('supplier-inbox.png'), fullPage: true })
    await row.click()
    await expect(page.getByRole('heading', { name: description })).toBeVisible()
    await expect(page.locator('main')).not.toContainText('معمل البلاستيك')
    await expect(page.locator('main')).not.toContainText('0944123456')
  })

  await test.step('submit a quote (price typed with separators), see the total and the confirmation', async () => {
    await page.getByLabel(/^سعر القطعة الواحدة/).fill('125,000')
    await expect(page.getByText('500,000')).toBeVisible()
    await page.getByRole('radio', { name: /أحتاج وقتاً لتأمينها/ }).check()
    await page.getByLabel(/^خلال كم يوم تتوفر/).fill('3')
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: testInfo.outputPath('supplier-quote-form.png'), fullPage: true })
    await page.getByRole('button', { name: 'أرسل العرض' }).click()
    await expect(page.getByText('تم إرسال عرضك.')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('supplier-quote-sent.png'), fullPage: true })
  })

  await test.step('edit, withdraw (with confirmation) and re-submit', async () => {
    await page.getByRole('button', { name: 'عدّل العرض' }).click()
    await page.getByLabel(/^سعر القطعة الواحدة/).fill('119000')
    await page.getByRole('button', { name: 'احفظ التعديل' }).click()
    await expect(page.getByText('تم حفظ التعديل على عرضك.')).toBeVisible()

    await page.getByRole('button', { name: 'اسحب العرض' }).click()
    await page.getByRole('button', { name: 'نعم، اسحب العرض' }).click()
    await expect(page.getByText('سحبت عرضك. لم يعد يظهر للمشتري.')).toBeVisible()

    await page.getByRole('button', { name: 'قدّم عرضاً من جديد' }).click()
    await expect(page.getByLabel(/^سعر القطعة الواحدة/)).toHaveValue('119000')
    await page.getByRole('button', { name: 'أرسل العرض' }).click()
    await expect(page.getByText('تم إرسال عرضك.')).toBeVisible()

    const api = await page.request.get(`/api/supplier/rfqs/${rfqId}`, { headers: spa })
    expect(((await api.json()) as { data: { my_quote: { unit_price: string; status: string } } }).data.my_quote).toMatchObject({ unit_price: '119000.00', status: 'submitted' })
  })

  await test.step('an approved supplier in another specialty gets 404', async () => {
    const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
    try {
      const email = await register(other.request, `${testInfo.project.name}-other`, 'supplier')
      artisan(`warridli:approve-supplier ${email} --force --no-interaction`) // approved, no specialties
      expect((await other.request.get(`/api/supplier/rfqs/${rfqId}`, { headers: spa })).status()).toBe(404)
      const quote = await other.request.put(`/api/supplier/rfqs/${rfqId}/quote`, { headers: await xsrfHeaders(other.request), data: { unit_price: '1' } })
      expect(quote.status()).toBe(404)
      const otherPage = await other.newPage()
      await otherPage.goto(`/supplier/rfqs/${rfqId}`)
      await expect(otherPage.getByText('هذا الطلب غير متاح لك')).toBeVisible()
    } finally {
      await other.close()
    }
  })
})
