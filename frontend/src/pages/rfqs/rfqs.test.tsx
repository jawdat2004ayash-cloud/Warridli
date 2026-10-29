import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '../../app/Providers'
import { routes } from '../../app/router'
import { calledKeys, csrfOk, json, mockApi } from '../../test/mockApi'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

const company = {
  id: 2,
  type: 'buyer',
  name: 'ورشة الأمل',
  whatsapp_phone: '+963944123456',
  area: { id: 3, name: 'دمشق — الزبلطاني' },
  address_text: null,
  status: 'approved',
  role: 'owner',
}
const buyer = { id: 7, name: 'أبو خالد', email: 'k@example.com', is_admin: false, company }
const supplier = { ...buyer, company: { ...company, type: 'supplier' } }

const me = (user: unknown = buyer) => () => json({ data: user })
const areas = () => json({ data: [{ id: 3, name: 'دمشق — الزبلطاني' }, { id: 4, name: 'ريف دمشق — جرمانا' }] })
const categories = () => json({ data: [{ id: 1, slug: 'bearings', name: 'بيليا ورولمان (محامل)' }] })

const rfq = {
  id: '01jcrfq0000000000000000000',
  status: 'pending_review',
  category: null,
  description: 'قطعة لا أعرف اسمها في مضخة المياه',
  part_number: '6205-2RS',
  machine_make: null,
  machine_model: null,
  quantity: 2,
  unit: 'piece',
  urgency: 'line_stopped',
  area: { id: 4, name: 'ريف دمشق — جرمانا' },
  closes_at: '2026-11-03T10:00:00+00:00',
  created_at: '2026-10-27T10:00:00+00:00',
  photos_count: 1,
  photos: [{ id: 9, url: `/api/rfqs/01jcrfq0000000000000000000/photos/9`, width: 800, height: 600 }],
}

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

describe('new RFQ page', () => {
  it('sends a request with photo and "unknown category", then shows the pending-review explanation', async () => {
    let sent: FormData | null = null
    mockApi({
      'GET /api/me': me(),
      'GET /api/areas': areas,
      'GET /api/categories': categories,
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/rfqs': (init) => {
        sent = init?.body as FormData
        return json({ data: rfq }, 201)
      },
    })
    const user = userEvent.setup()
    const router = renderAt('/rfqs/new')

    await user.type(await screen.findByLabelText(/^صف القطعة/), 'قطعة لا أعرف اسمها في مضخة المياه')
    await user.upload(screen.getByLabelText(/صوّر القطعة/), new File(['jpeg'], 'IMG_2001.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByRole('img', { name: 'الصورة 1' })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^رقم القطعة/), '6205-2RS')
    await user.clear(screen.getByLabelText(/^الكمية/))
    await user.type(screen.getByLabelText(/^الكمية/), '٢') // Arabic-Indic digit
    await user.click(screen.getByRole('radio', { name: /الخط متوقف/ }))
    await user.click(await screen.findByRole('radio', { name: /لا أعرف التصنيف/ }))
    await user.selectOptions(screen.getByLabelText(/^أين تحتاج القطعة/), '4')
    await user.click(screen.getByRole('button', { name: 'أرسل الطلب' }))

    expect(await screen.findByText('تم إرسال طلبك، وهو الآن قيد التصنيف.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/rfqs/${rfq.id}`)

    const body = sent as unknown as FormData
    expect(Object.fromEntries([...body.entries()].filter(([, v]) => typeof v === 'string'))).toEqual({
      description: 'قطعة لا أعرف اسمها في مضخة المياه',
      part_number: '6205-2RS',
      quantity: '2',
      unit: 'piece',
      urgency: 'line_stopped',
      area_id: '4',
      category: 'unknown',
    })
    expect(body.getAll('photos[]')).toHaveLength(1)
  })

  it('isolates the Latin part-number example inside the Arabic hint (bidi)', async () => {
    mockApi({ 'GET /api/me': me(), 'GET /api/areas': areas, 'GET /api/categories': categories })
    renderAt('/rfqs/new')

    expect((await screen.findByText(/فاكتبها كما هي/)).textContent).toContain('⁦6205-2RS⁩')
  })

  it('pre-selects the company area and explains missing fields without calling the API', async () => {
    const fetch = mockApi({ 'GET /api/me': me(), 'GET /api/areas': areas, 'GET /api/categories': categories })
    const user = userEvent.setup()
    renderAt('/rfqs/new')

    await screen.findByRole('option', { name: 'ريف دمشق — جرمانا' })
    expect(screen.getByLabelText(/^أين تحتاج القطعة/)).toHaveValue('3')
    await user.click(screen.getByRole('button', { name: 'أرسل الطلب' }))

    const summary = await screen.findByRole('alert')
    expect(within(summary).getByRole('link', { name: 'اكتب وصفاً للقطعة التي تحتاجها.' })).toHaveAttribute('href', '#rfq-description')
    expect(within(summary).getByRole('link', { name: 'اختر تصنيفاً، أو اختر «لا أعرف التصنيف».' })).toHaveAttribute('href', '#rfq-category-first')
    expect(calledKeys(fetch)).not.toContain('POST /api/rfqs')
  })

  it('shows server validation errors (including photo errors) on the matching fields', async () => {
    mockApi({
      'GET /api/me': me(),
      'GET /api/areas': areas,
      'GET /api/categories': categories,
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/rfqs': () =>
        json({ message: 'x', errors: { 'photos.0': ['تعذّر قراءة الصورة رقم 1.'], quantity: ['الكمية كبيرة جداً.'] } }, 422),
    })
    const user = userEvent.setup()
    renderAt('/rfqs/new')

    await user.type(await screen.findByLabelText(/^صف القطعة/), 'سير مروحة')
    await user.click(await screen.findByRole('radio', { name: /بيليا ورولمان/ }))
    await user.click(screen.getByRole('button', { name: 'أرسل الطلب' }))

    const summary = await screen.findByRole('alert')
    expect(within(summary).getByText('تعذّر قراءة الصورة رقم 1.')).toBeInTheDocument()
    expect(within(summary).getByText('الكمية كبيرة جداً.')).toBeInTheDocument()
  })

  it('rejects a non-image file in the picker with a plain message', async () => {
    mockApi({ 'GET /api/me': me(), 'GET /api/areas': areas, 'GET /api/categories': categories })
    const user = userEvent.setup({ applyAccept: false })
    renderAt('/rfqs/new')

    await user.upload(await screen.findByLabelText(/صوّر القطعة/), new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' }))

    expect(await screen.findByText('نوع هذا الملف غير مدعوم. اختر صورة (JPG أو PNG أو WebP).')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'الصورة 1' })).not.toBeInTheDocument()
  })

  it('tells suppliers this page is for buyers', async () => {
    mockApi({ 'GET /api/me': me(supplier) })
    renderAt('/rfqs/new')

    expect(await screen.findByText('طلبات الأسعار للورش والمعامل')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'أرسل الطلب' })).not.toBeInTheDocument()
  })

  it('sends guests to login', async () => {
    mockApi({ 'GET /api/me': () => json({ message: '' }, 401), 'GET /api/areas': areas })
    const router = renderAt('/rfqs/new')

    await screen.findByRole('heading', { name: 'تسجيل الدخول' })
    expect(router.state.location.search).toBe('?next=%2Frfqs%2Fnew')
  })
})

describe('my RFQs list', () => {
  it('shows an empty state with a call to action', async () => {
    mockApi({ 'GET /api/me': me(), 'GET /api/rfqs?page=1': () => json({ data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 20 } }) })
    renderAt('/rfqs')

    expect(await screen.findByText('لم ترسل أي طلب بعد')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'اطلب قطعتك الأولى' })).toHaveAttribute('href', '/rfqs/new')
  })

  it('lists requests with status, urgency and category, linking to details', async () => {
    mockApi({
      'GET /api/me': me(),
      'GET /api/rfqs?page=1': () => json({ data: [{ ...rfq, photos: undefined }], meta: { current_page: 1, last_page: 1, total: 1, per_page: 20 } }),
    })
    renderAt('/rfqs')

    const link = await screen.findByRole('link', { name: /قطعة لا أعرف اسمها/ })
    expect(link).toHaveAttribute('href', `/rfqs/${rfq.id}`)
    expect(within(link).getByText('قيد التصنيف')).toBeInTheDocument()
    expect(within(link).getByText('الخط متوقف')).toBeInTheDocument()
    expect(within(link).getByText('بانتظار التصنيف')).toBeInTheDocument()
  })

  it('shows a retryable error when loading fails', async () => {
    // 4xx: not auto-retried (5xx would be retried first, F4).
    mockApi({ 'GET /api/me': me(), 'GET /api/rfqs?page=1': () => json({}, 403) })
    renderAt('/rfqs')

    expect(await screen.findByText('تعذّر تحميل طلباتك')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'أعد المحاولة' })).toBeInTheDocument()
  })
})

describe('RFQ details', () => {
  it('shows the part, photos and facts', async () => {
    mockApi({ 'GET /api/me': me(), [`GET /api/rfqs/${rfq.id}`]: () => json({ data: rfq }) })
    renderAt(`/rfqs/${rfq.id}`)

    expect(await screen.findByRole('heading', { name: rfq.description })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'صورة القطعة 1' })).toHaveAttribute('src', rfq.photos[0]!.url)
    expect(screen.getByText('6205-2RS')).toBeInTheDocument()
    expect(screen.getByText('طلبك قيد التصنيف')).toBeInTheDocument()
  })

  it('says "not found" for another company\'s or unknown request', async () => {
    mockApi({ 'GET /api/me': me(), 'GET /api/rfqs/nope': () => json({ message: 'x' }, 404) })
    renderAt('/rfqs/nope')

    expect(await screen.findByText('لم نجد هذا الطلب')).toBeInTheDocument()
  })

  it('cancels only after an explicit confirmation', async () => {
    const fetch = mockApi({
      'GET /api/me': me(),
      [`GET /api/rfqs/${rfq.id}`]: () => json({ data: rfq }),
      'GET /sanctum/csrf-cookie': csrfOk,
      [`POST /api/rfqs/${rfq.id}/cancel`]: () => json({ data: { ...rfq, status: 'cancelled' } }),
    })
    const user = userEvent.setup()
    renderAt(`/rfqs/${rfq.id}`)

    await user.click(await screen.findByRole('button', { name: 'إلغاء الطلب' }))
    expect(calledKeys(fetch)).not.toContain(`POST /api/rfqs/${rfq.id}/cancel`)
    await user.click(screen.getByRole('button', { name: 'نعم، ألغِ الطلب' }))

    expect(await screen.findByText('ألغيت هذا الطلب. لن تصل إليه عروض جديدة.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'إلغاء الطلب' })).not.toBeInTheDocument()
  })
})
