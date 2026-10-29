import { expect, test } from '@playwright/test'
import { apiLogin, createTestAdmin, expectNoHorizontalScroll, register, resetRateLimits, spa, xsrfHeaders } from './helpers.ts'

/**
 * Real-browser admin journey (M4a): a buyer sends an "I don't know the category" request and a new supplier asks
 * for the bearings specialty → the admin approves the supplier and its specialty, inspects and classifies the
 * request (which then reaches the supplier), adds and deactivates a category, and finds the decisions in the audit
 * trail. Non-admins are refused by the API itself. Desktop + mobile; warridli_test only.
 */

test.beforeAll(resetRateLimits)

test('admin vets a supplier, classifies an unknown request, manages categories and reads the audit trail', async ({ page, browser }, testInfo) => {
  const project = testInfo.project.name
  const stamp = `${Date.now()}-${project}`
  const description = `قطعة دائرية فيها كرات معدنية ${stamp}`
  let rfqId = ''
  let supplierEmail = ''
  const supplier = await browser.newContext({ baseURL: testInfo.project.use.baseURL })

  try {
    await test.step('a buyer sends a request without knowing the category', async () => {
      const buyer = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
      try {
        await register(buyer.request, `${project}-adm-buyer`)
        const areas = (await (await buyer.request.get('/api/areas')).json()) as { data: { id: number }[] }
        const response = await buyer.request.post('/api/rfqs', {
          headers: await xsrfHeaders(buyer.request),
          multipart: { description, quantity: '2', unit: 'piece', urgency: 'urgent', area_id: String(areas.data[0]!.id), category: 'unknown' },
        })
        expect(response.status()).toBe(201)
        rfqId = ((await response.json()) as { data: { id: string } }).data.id
      } finally {
        await buyer.close()
      }
    })

    await test.step('a new supplier asks for the bearings specialty', async () => {
      supplierEmail = await register(supplier.request, `${project}-adm-supplier`, 'supplier')
      const categories = (await (await supplier.request.get('/api/categories')).json()) as { data: { id: number; slug: string }[] }
      const bearings = categories.data.find((c) => c.slug === 'bearings')!.id
      const saved = await supplier.request.put('/api/supplier/categories', { headers: await xsrfHeaders(supplier.request), data: { category_ids: [bearings] } })
      expect(saved.status()).toBe(200)
    })

    await test.step('non-admins are refused by the API and see no admin pages', async () => {
      const denied = await supplier.request.get('/api/admin/metrics', { headers: spa })
      expect(denied.status()).toBe(403)
      const probe = await supplier.request.post(`/api/admin/rfqs/${rfqId}/triage`, { headers: await xsrfHeaders(supplier.request), data: { category_id: 1 } })
      expect(probe.status()).toBe(403)
    })

    const admin = createTestAdmin(project)
    await apiLogin(page.request, admin.email, admin.password)

    await test.step('overview: waiting work and figures with definitions', async () => {
      await page.goto('/admin')
      await expect(page.getByRole('heading', { name: 'نظرة عامة' })).toBeVisible()
      await expect(page.getByRole('link', { name: /طلبات بلا تصنيف\s*صنّفها الآن/ })).toBeVisible()
      await expect(page.getByText('الوقت حتى أول عرض (الوسيط)')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: testInfo.outputPath('admin-overview.png'), fullPage: true })
    })

    await test.step('approve the supplier, then its specialty', async () => {
      await page.getByRole('navigation', { name: 'أقسام الإدارة' }).getByRole('link', { name: /المورّدون والشركات/ }).click()
      await page.getByRole('searchbox').fill(supplierEmail)
      await page.getByRole('button', { name: 'ابحث' }).click()
      const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /محل قطع غيار/ }) })
      await expect(card).toHaveCount(1)
      await expect(card.getByText('قيد المراجعة', { exact: true })).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: testInfo.outputPath('admin-companies.png'), fullPage: true })

      await card.getByRole('button', { name: 'وافق على المورّد' }).click()
      await expect(card.getByText(/كمورّد معتمد/)).toBeVisible()
      await card.getByRole('button', { name: 'نعم، وافق' }).click()
      await expect(page.getByText('تمت الموافقة على المورّد.')).toBeVisible()
      await expect(card.getByText('معتمدة', { exact: true })).toBeVisible()

      await card.getByRole('button', { name: 'اعتمد التخصص' }).click()
      await card.getByRole('button', { name: 'نعم، اعتمد' }).click()
      await expect(page.getByText('تم اعتماد التخصص.')).toBeVisible()
      await expect(card.getByText('معتمد', { exact: true })).toBeVisible()
    })

    await test.step('inspect and classify the unknown request', async () => {
      await page.goto(`/admin/rfqs/${rfqId}`)
      await expect(page.getByRole('heading', { name: description })).toBeVisible()
      await expect(page.getByText('معمل البلاستيك (اختبار)', { exact: false })).toBeVisible()
      await page.getByRole('button', { name: 'صنّف الطلب وأرسله للمورّدين' }).click()
      await expect(page.getByText('اختر التصنيف أولاً.')).toBeVisible()
      await page.getByRole('radio', { name: /بيليا ورولمان/ }).check()
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: testInfo.outputPath('admin-triage.png'), fullPage: true })
      await page.getByRole('button', { name: 'صنّف الطلب وأرسله للمورّدين' }).click()
      await expect(page.getByText(/ويبقى مفتوحاً للعروض 7 أيام من الآن/)).toBeVisible()
      await page.getByRole('button', { name: 'نعم، أرسله' }).click()
      await expect(page.getByText(/الطلب مصنّف في «بيليا ورولمان/)).toBeVisible()
      await expect(page.getByRole('radio')).toHaveCount(0)
    })

    await test.step('the classified request now reaches the approved supplier', async () => {
      const inbox = (await (await supplier.request.get('/api/supplier/rfqs', { headers: spa })).json()) as { data: { id: string }[] }
      expect(inbox.data.map((r) => r.id)).toContain(rfqId)
    })

    await test.step('add a category, then deactivate it; buyers no longer see it', async () => {
      const name = `تصنيف تجريبي ${stamp}`
      await page.goto('/admin/categories')
      const form = page.getByRole('region', { name: 'أضف تصنيفاً' })
      await form.getByRole('textbox', { name: /اسم التصنيف/ }).fill(name)
      await form.getByRole('button', { name: 'أضف التصنيف' }).click()
      await expect(page.getByText('تمت إضافة التصنيف.')).toBeVisible()
      let publicNames = ((await (await page.request.get('/api/categories')).json()) as { data: { name: string }[] }).data.map((c) => c.name)
      expect(publicNames).toContain(name)

      const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) })
      await row.getByRole('button', { name: 'عطّل التصنيف' }).click()
      await row.getByRole('button', { name: 'نعم، عطّله' }).click()
      await expect(page.getByText('تم تعطيل التصنيف.')).toBeVisible()
      await expect(row.getByText('معطّل', { exact: true })).toBeVisible()
      publicNames = ((await (await page.request.get('/api/categories')).json()) as { data: { name: string }[] }).data.map((c) => c.name)
      expect(publicNames).not.toContain(name)
      await expectNoHorizontalScroll(page)
    })

    await test.step('the audit trail shows the decisions with the admin\'s name', async () => {
      await page.goto('/admin/audit')
      await page.getByRole('combobox', { name: 'نوع العملية' }).selectOption('rfq')
      await page.getByRole('button', { name: 'اعرض' }).click()
      const entry = page.getByRole('listitem').filter({ hasText: 'تصنيف طلب وإرساله للمورّدين' }).filter({ hasText: description.slice(0, 20) }).first()
      await expect(entry).toBeVisible()
      await expect(entry.getByText('مدير الاختبار')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: testInfo.outputPath('admin-audit.png'), fullPage: true })
    })

    await test.step('a supplier opening /admin sees the "admins only" page', async () => {
      const supplierPage = await supplier.newPage()
      await supplierPage.goto('/admin')
      await expect(supplierPage.getByText('هذه الصفحات لإدارة ورّدلي فقط')).toBeVisible()
      await supplierPage.close()
    })
  } finally {
    await supplier.close()
  }
})
