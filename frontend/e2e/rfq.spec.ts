import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalScroll, register, resetRateLimits, spa } from './helpers.ts'

/**
 * Real-browser RFQ journey (M3a): a buyer creates a request with a real photo, sees it in details and list;
 * the photo is served privately; another buyer gets 404 for both. Runs per project (desktop, mobile).
 */

test.beforeAll(resetRateLimits)

/** A real 2400×1800 JPEG drawn in the browser (bigger than the 1600 px client limit). */
async function makePhoto(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2400
    canvas.height = 1800
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#8a8f98'
    ctx.fillRect(0, 0, 2400, 1800)
    ctx.fillStyle = '#1d2229'
    ctx.beginPath()
    ctx.arc(1200, 900, 600, 0, Math.PI * 2)
    ctx.fill()
    return canvas.toDataURL('image/jpeg', 0.9)
  })
  return { name: 'IMG_4471.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64') }
}

test('buyer creates an RFQ with a photo; another buyer cannot see it', async ({ page, browser }, testInfo) => {
  await register(page.request, testInfo.project.name)
  let rfqUrl = ''
  let photoUrl = ''

  await test.step('fill the form like a workshop owner would', async () => {
    await page.goto('/rfqs')
    await expect(page.getByText('لم ترسل أي طلب بعد')).toBeVisible()
    await page.getByRole('link', { name: 'اطلب قطعتك الأولى' }).click()
    await expect(page.getByRole('heading', { name: 'ما القطعة التي تحتاجها؟' })).toBeVisible()
    await expectNoHorizontalScroll(page)

    await page.getByLabel(/^صف القطعة/).fill('بيليا محرك مضخة المياه، صار لها صوت عالي')
    await page.getByLabel(/صوّر القطعة/).setInputFiles(await makePhoto(page))
    await expect(page.getByRole('img', { name: 'الصورة 1' })).toBeVisible()
    await page.getByLabel(/^رقم القطعة/).fill('6205-2RS')
    await page.getByRole('radio', { name: /مستعجل/ }).check()
    await page.getByRole('radio', { name: /بيليا ورولمان/ }).check()
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: testInfo.outputPath('rfq-form.png'), fullPage: true })

    await page.getByRole('button', { name: 'أرسل الطلب' }).click()
    await expect(page.getByText('تم إرسال طلبك بنجاح.')).toBeVisible()
    rfqUrl = new URL(page.url()).pathname
    expect(rfqUrl).toMatch(/^\/rfqs\/[0-9a-z]{26}$/)
  })

  await test.step('details show the privately served photo, shrunk before upload', async () => {
    const img = page.getByRole('img', { name: 'صورة القطعة 1' })
    await expect(img).toBeVisible()
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(1600)
    photoUrl = (await img.getAttribute('src'))!
    const photo = await page.request.get(photoUrl, { headers: spa })
    expect(photo.status()).toBe(200)
    expect(photo.headers()['content-type']).toBe('image/jpeg')
    expect(photo.headers()['x-content-type-options']).toBe('nosniff')
    expect(photo.headers()['cache-control']).toContain('no-store')
    await expect(page.getByText('6205-2RS')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: testInfo.outputPath('rfq-detail.png'), fullPage: true })
  })

  await test.step('"I don\'t know the category" goes to review', async () => {
    await page.goto('/rfqs/new')
    await page.getByLabel(/^صف القطعة/).fill('قطعة مطاط تحت المكبس، لا أعرف اسمها')
    await page.getByRole('radio', { name: /لا أعرف التصنيف/ }).check()
    await page.getByRole('button', { name: 'أرسل الطلب' }).click()
    await expect(page.getByText('تم إرسال طلبك، وهو الآن قيد التصنيف.')).toBeVisible()
  })

  await test.step('both requests appear in "my requests"', async () => {
    await page.getByRole('link', { name: 'طلباتي' }).first().click()
    await expect(page.getByRole('link', { name: /بيليا محرك مضخة المياه/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /قطعة مطاط تحت المكبس/ })).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: testInfo.outputPath('rfq-list.png'), fullPage: true })
  })

  await test.step('another buyer gets 404 for the request and its photo', async () => {
    const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
    try {
      await register(other.request, `${testInfo.project.name}-other`)
      expect((await other.request.get(`/api${rfqUrl}`, { headers: spa })).status()).toBe(404)
      expect((await other.request.get(photoUrl, { headers: spa })).status()).toBe(404)
      const otherPage = await other.newPage()
      await otherPage.goto(rfqUrl)
      await expect(otherPage.getByText('لم نجد هذا الطلب')).toBeVisible()
    } finally {
      await other.close()
    }
  })
})

test('the form explains what is missing', async ({ page }, testInfo) => {
  await register(page.request, `${testInfo.project.name}-empty`)
  await page.goto('/rfqs/new')
  await expect(page.getByRole('radio', { name: /لا أعرف التصنيف/ })).toBeVisible()

  await page.getByRole('button', { name: 'أرسل الطلب' }).click()

  const summary = page.getByRole('alert').filter({ hasText: 'اكتب وصفاً للقطعة التي تحتاجها.' })
  await expect(summary).toBeFocused()
  await summary.getByRole('link', { name: 'اكتب وصفاً للقطعة التي تحتاجها.' }).click()
  await expect(page.getByLabel(/^صف القطعة/)).toBeFocused()
})
