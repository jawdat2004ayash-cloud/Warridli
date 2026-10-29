import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Providers } from '../../app/Providers'
import { routes } from '../../app/router'
import { durationLabel, suppliersLabel } from '../../lib/admin'
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

const adminMe = () => json({ data: { id: 1, name: 'مدير ورّدلي', email: 'admin@example.com', is_admin: true, company: null } })

const metrics = (overrides: Record<string, unknown> = {}) => ({
  period_days: 30,
  since: '2026-09-30T12:00:00+00:00',
  generated_at: '2026-10-30T12:00:00+00:00',
  rfqs: {
    created: 12,
    by_status: { pending_review: 1, open: 6, closed: 3, cancelled: 1, expired: 1, rejected: 0 },
    published: 10,
    with_quote: 7,
    with_quote_rate: 0.7,
    with_selection: 3,
  },
  first_quote: { sample: 7, median_minutes: 120 },
  triage: { sample: 2, median_minutes: 45 },
  contacts: { reveals: 9, rfqs: 4 },
  queue: { suppliers_pending: 2, specialties_pending: 1, rfqs_pending_review: 3 },
  ...overrides,
})

const page = <T,>(data: T[], lastPage = 1) => ({ data, meta: { current_page: 1, last_page: lastPage, total: data.length, per_page: 20 } })

const supplier = {
  id: 7,
  type: 'supplier',
  name: 'مستودع النور',
  whatsapp_phone: '+963944111222',
  area: { id: 2, name: 'دمشق — الزبلطاني' },
  address_text: null,
  status: 'pending',
  verified_at: null,
  created_at: '2026-10-28T09:00:00+00:00',
  members: [{ user_id: 11, name: 'أبو أحمد', email: 'noor@example.com', role: 'owner', suspended: false }],
  categories: [{ id: 1, name: 'بيليا', status: 'pending' }],
}

const RFQ = '01jadm0000000000000000000a'
const pendingRfq = {
  id: RFQ,
  status: 'pending_review',
  category: null,
  description: 'قطعة دائرية فيها كرات',
  part_number: null,
  machine_make: 'مضخة',
  machine_model: null,
  quantity: 2,
  unit: 'piece',
  urgency: 'urgent',
  area: { id: 4, name: 'ريف دمشق — جرمانا' },
  buyer: { company_id: 3, name: 'ورشة الأمل', whatsapp_phone: '+963944000111' },
  closes_at: '2026-11-04T10:00:00+00:00',
  created_at: '2026-10-28T10:00:00+00:00',
  triaged_at: null,
  photos_count: 1,
  photos: [{ id: 5, url: `/api/admin/rfqs/${RFQ}/photos/5`, width: 800, height: 600 }],
}

const categories = [
  { id: 1, slug: 'bearings', name: 'بيليا', is_active: true, sort: 10, rfqs_count: 4, open_rfqs_count: 2, suppliers_count: 3 },
  { id: 2, slug: 'belts', name: 'سيور', is_active: true, sort: 20, rfqs_count: 0, open_rfqs_count: 0, suppliers_count: 0 },
  { id: 3, slug: 'old', name: 'قديم', is_active: false, sort: 30, rfqs_count: 1, open_rfqs_count: 0, suppliers_count: 0 },
]

const base = { 'GET /api/me': adminMe, 'GET /api/admin/metrics?period=30': () => json({ data: metrics() }) }

describe('admin area access (UX only — the API enforces it)', () => {
  it('tells a non-admin the pages are for administrators and calls no admin API', async () => {
    const fetch = mockApi({
      'GET /api/me': () => json({ data: { id: 9, name: 'مشترٍ', email: 'b@example.com', is_admin: false, company: null } }),
    })
    renderAt('/admin/companies')

    expect(await screen.findByText('هذه الصفحات لإدارة ورّدلي فقط')).toBeInTheDocument()
    expect(calledKeys(fetch).some((k) => k.includes('/api/admin'))).toBe(false)
  })

  it('links admins to the panel from their account page (the header hides it on phones)', async () => {
    mockApi({ 'GET /api/me': adminMe })
    renderAt('/account')
    expect(await screen.findByRole('link', { name: 'افتح لوحة الإدارة' })).toHaveAttribute('href', '/admin')
  })

  it('shows the admin link in the header only for admins', async () => {
    mockApi({ ...base })
    renderAt('/admin')
    expect(await screen.findByRole('link', { name: 'الإدارة' })).toHaveAttribute('href', '/admin')
  })
})

describe('overview', () => {
  it('shows waiting work as links and figures with their definitions, no charts', async () => {
    const fetch = mockApi({ ...base, 'GET /api/admin/metrics?period=7': () => json({ data: metrics({ period_days: 7 }) }) })
    renderAt('/admin')

    const queue = await screen.findByRole('link', { name: /طلبات بلا تصنيف\s*صنّفها الآن/ })
    expect(queue).toHaveAttribute('href', '/admin/rfqs')
    expect(screen.getByText('70')).toBeInTheDocument()
    expect(screen.getByText('ساعتين')).toBeInTheDocument() // 120 min, shown in hours
    expect(screen.getByText(/نصف الطلبات أسرع من هذا الرقم/)).toBeInTheDocument()
    expect(document.querySelector('svg[role="img"], canvas')).toBeNull()

    await userEvent.click(screen.getByRole('link', { name: 'آخر 7 أيام' }))
    expect(await screen.findByRole('link', { name: 'آخر 7 أيام', current: 'page' })).toBeInTheDocument()
    expect(calledKeys(fetch)).toContain('GET /api/admin/metrics?period=7')
  })

  it('shows a dash, not 0%, when nothing reached suppliers', async () => {
    mockApi({ ...base, 'GET /api/admin/metrics?period=30': () => json({ data: metrics({ rfqs: { ...metrics().rfqs, published: 0, with_quote: 0, with_quote_rate: null } }) }) })
    renderAt('/admin')
    const row = (await screen.findByText('تلقّت عرض سعر واحداً على الأقل')).closest('div')!
    expect(within(row).getByText('—')).toBeInTheDocument()
  })
})

describe('supplier vetting', () => {
  it('approves a pending supplier after confirmation and reports success', async () => {
    const fetch = mockApi({
      ...base,
      'GET /api/admin/companies?status=pending&page=1': () => json(page([supplier])),
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/admin/companies/7/approve': () => json({ data: { ...supplier, status: 'approved' } }),
    })
    renderAt('/admin/companies')

    await userEvent.click(await screen.findByRole('button', { name: 'وافق على المورّد' }))
    expect(screen.getByText(/ستُفعَّل «مستودع النور» كمورّد معتمد/)).toBeInTheDocument()
    expect(screen.getByLabelText(/ملاحظة/)).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'نعم، وافق' }))

    expect(await screen.findByText('تمت الموافقة على المورّد.')).toBeInTheDocument()
    const post = fetch.mock.calls.find(([url]) => url === '/api/admin/companies/7/approve')!
    expect(JSON.parse(String(post[1]?.body))).toEqual({})
  })

  it('requires a reason before rejecting, and Escape backs out', async () => {
    const fetch = mockApi({
      ...base,
      'GET /api/admin/companies?status=pending&page=1': () => json(page([supplier])),
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/admin/companies/7/reject': () => json({ data: { ...supplier, status: 'rejected' } }),
    })
    renderAt('/admin/companies')

    const trigger = await screen.findByRole('button', { name: 'ارفض' })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'ارفض' })).toHaveFocus())

    await userEvent.click(screen.getByRole('button', { name: 'ارفض' }))
    await userEvent.click(screen.getByRole('button', { name: 'نعم، ارفض' }))
    expect(screen.getByText(/اكتب السبب بوضوح/)).toBeInTheDocument()
    expect(calledKeys(fetch)).not.toContain('POST /api/admin/companies/7/reject')

    await userEvent.type(screen.getByRole('textbox', { name: /السبب/ }), 'لم نتمكن من التحقق من المحل')
    await userEvent.click(screen.getByRole('button', { name: 'نعم، ارفض' }))
    expect(await screen.findByText('تم رفض المورّد.')).toBeInTheDocument()
    const post = fetch.mock.calls.find(([url]) => url === '/api/admin/companies/7/reject')!
    expect(JSON.parse(String(post[1]?.body))).toEqual({ reason: 'لم نتمكن من التحقق من المحل' })
  })

  it('approves a pending specialty from the specialties view', async () => {
    const approved = { ...supplier, status: 'approved' }
    const fetch = mockApi({
      ...base,
      'GET /api/admin/companies?pending_categories=1&page=1': () => json(page([approved])),
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/admin/supplier-categories/7/1/approve': () => json({ data: { ...approved, categories: [{ id: 1, name: 'بيليا', status: 'approved' }] } }),
    })
    renderAt('/admin/companies?view=specialties')

    await userEvent.click(await screen.findByRole('button', { name: 'اعتمد التخصص' }))
    expect(screen.getByText(/طلبات تصنيف «بيليا» من الآن/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'نعم، اعتمد' }))
    expect(await screen.findByText('تم اعتماد التخصص.')).toBeInTheDocument()
    expect(calledKeys(fetch)).toContain('POST /api/admin/supplier-categories/7/1/approve')
  })

  it('searches across all companies', async () => {
    const fetch = mockApi({
      ...base,
      'GET /api/admin/companies?status=pending&page=1': () => json(page([])),
      'GET /api/admin/companies?q=%D8%A7%D9%84%D9%86%D9%88%D8%B1&page=1': () => json(page([supplier])),
    })
    renderAt('/admin/companies')

    expect(await screen.findByText('لا يوجد مورّد جديد بانتظار المراجعة.')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'النور{Enter}')
    expect(await screen.findByRole('heading', { name: 'مستودع النور' })).toBeInTheDocument()
    expect(calledKeys(fetch)).toContain('GET /api/admin/companies?q=%D8%A7%D9%84%D9%86%D9%88%D8%B1&page=1')
  })
})

describe('triage of unknown-category requests', () => {
  const triageApi = (extra: Record<string, () => Response> = {}) =>
    mockApi({
      ...base,
      [`GET /api/admin/rfqs/${RFQ}`]: () => json({ data: pendingRfq }),
      'GET /api/admin/categories': () => json({ data: categories }),
      'GET /sanctum/csrf-cookie': csrfOk,
      ...extra,
    })

  it('shows the request safely, offers only active categories with their supplier counts, then sends it', async () => {
    let current: Record<string, unknown> = pendingRfq
    const fetch = triageApi({
      [`GET /api/admin/rfqs/${RFQ}`]: () => json({ data: current }),
      [`POST /api/admin/rfqs/${RFQ}/triage`]: () => {
        current = { ...pendingRfq, status: 'open', category: { id: 1, slug: 'bearings', name: 'بيليا' } }
        return json({ data: current })
      },
    })
    renderAt(`/admin/rfqs/${RFQ}`)

    expect(await screen.findByRole('heading', { name: 'قطعة دائرية فيها كرات' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'صورة القطعة 1' })).toHaveAttribute('src', `/api/admin/rfqs/${RFQ}/photos/5`)
    expect(screen.getByText('ورشة الأمل', { exact: false })).toBeInTheDocument()
    expect(await screen.findByRole('radio', { name: /سيور\s*لا يوجد مورّد معتمد/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /قديم/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'صنّف الطلب وأرسله للمورّدين' }))
    expect(screen.getByRole('alert')).toHaveTextContent('اختر التصنيف أولاً.')
    expect(calledKeys(fetch)).not.toContain(`POST /api/admin/rfqs/${RFQ}/triage`)

    await userEvent.click(screen.getByRole('radio', { name: /بيليا/ }))
    await userEvent.click(screen.getByRole('button', { name: 'صنّف الطلب وأرسله للمورّدين' }))
    expect(screen.getByText(/سيصل الطلب إلى 3 مورّدين معتمدين في «بيليا»/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'نعم، أرسله' }))

    expect(await screen.findByText('الطلب مصنّف في «بيليا» ووصل إلى المورّدين.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
    const post = fetch.mock.calls.find(([url]) => url === `/api/admin/rfqs/${RFQ}/triage`)!
    expect(JSON.parse(String(post[1]?.body))).toEqual({ category_id: 1 })
  })

  it('warns before sending to a category with no approved supplier', async () => {
    triageApi()
    renderAt(`/admin/rfqs/${RFQ}`)
    await userEvent.click(await screen.findByRole('radio', { name: /سيور/ }))
    await userEvent.click(screen.getByRole('button', { name: 'صنّف الطلب وأرسله للمورّدين' }))
    expect(screen.getByText(/لا يوجد مورّد معتمد في هذا التصنيف حالياً/)).toBeInTheDocument()
  })

  it('explains a conflict when another admin decided first', async () => {
    triageApi({
      [`POST /api/admin/rfqs/${RFQ}/triage`]: () => json({ message: 'لا يمكن تصنيف طلب حالته «مفتوح للعروض». ربما عالجه مدير آخر أو ألغاه المشتري؛ حدّث الصفحة.' }, 409),
    })
    renderAt(`/admin/rfqs/${RFQ}`)
    await userEvent.click(await screen.findByRole('radio', { name: /بيليا/ }))
    await userEvent.click(screen.getByRole('button', { name: 'صنّف الطلب وأرسله للمورّدين' }))
    await userEvent.click(screen.getByRole('button', { name: 'نعم، أرسله' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ربما عالجه مدير آخر')
  })

  it('lists the queue with the waiting time and an empty state', async () => {
    mockApi({ ...base, 'GET /api/admin/rfqs?status=pending_review': () => json(page([])) })
    renderAt('/admin/rfqs')
    expect(await screen.findByText('لا توجد طلبات بانتظار التصنيف')).toBeInTheDocument()
  })
})

describe('categories', () => {
  it('adds a category, maps a duplicate-name error to the field, and deactivates with an explanation', async () => {
    let posts = 0
    const fetch = mockApi({
      ...base,
      'GET /api/admin/categories': () => json({ data: categories }),
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/admin/categories': () =>
        ++posts === 1
          ? json({ message: 'x', errors: { name_ar: ['يوجد تصنيف بهذا الاسم. اختر اسماً مختلفاً أو عدّل التصنيف الموجود.'] } }, 422)
          : json({ data: { ...categories[1], id: 9, name: 'محركات' } }, 201),
      'PATCH /api/admin/categories/1': () => json({ data: { ...categories[0], is_active: false } }),
    })
    renderAt('/admin/categories')

    const form = (await screen.findByRole('heading', { name: 'أضف تصنيفاً' })).closest('section')!
    await userEvent.type(within(form).getByRole('textbox', { name: /اسم التصنيف/ }), 'بيليا')
    await userEvent.click(within(form).getByRole('button', { name: 'أضف التصنيف' }))
    expect(await within(form).findByText(/يوجد تصنيف بهذا الاسم/)).toBeInTheDocument()

    await userEvent.clear(within(form).getByRole('textbox', { name: /اسم التصنيف/ }))
    await userEvent.type(within(form).getByRole('textbox', { name: /اسم التصنيف/ }), 'محركات')
    await userEvent.click(within(form).getByRole('button', { name: 'أضف التصنيف' }))
    expect(await screen.findByText('تمت إضافة التصنيف.')).toBeInTheDocument()

    const bearings = screen.getByRole('heading', { name: 'بيليا' }).closest('li')!
    expect(within(bearings).getByText('3 مورّدين معتمدين')).toBeInTheDocument()
    await userEvent.click(within(bearings).getByRole('button', { name: 'عطّل التصنيف' }))
    expect(within(bearings).getByText(/الطلبات الحالية \(2 مفتوحة\) والمورّدون المعتمدون فيه يبقون كما هم/)).toBeInTheDocument()
    await userEvent.click(within(bearings).getByRole('button', { name: 'نعم، عطّله' }))
    expect(await screen.findByText('تم تعطيل التصنيف.')).toBeInTheDocument()
    const patch = fetch.mock.calls.find(([url]) => url === '/api/admin/categories/1')!
    expect(JSON.parse(String(patch[1]?.body))).toEqual({ is_active: false })
    expect(screen.queryByRole('button', { name: /احذف/ })).toBeNull()
  })
})

describe('audit trail', () => {
  const entries = [
    {
      id: 2,
      action: 'company.rejected',
      actor: { id: 1, name: 'مدير ورّدلي', email: 'admin@example.com', is_admin: true },
      subject: { type: 'company', id: 7, label: 'مستودع النور', ref: null },
      meta: { from: 'pending', to: 'rejected', reason: 'لم نتحقق من المحل' },
      ip: '127.0.0.1',
      created_at: '2026-10-29T08:00:00+00:00',
    },
    { id: 1, action: 'rfq.expired', actor: null, subject: { type: 'rfq', id: 4, label: 'بيليا', ref: RFQ }, meta: null, ip: null, created_at: '2026-10-28T08:00:00+00:00' },
  ]

  it('shows who, what, on what and when in plain Arabic, and filters by type', async () => {
    const fetch = mockApi({
      ...base,
      'GET /api/admin/audit-logs': () => json(page(entries)),
      'GET /api/admin/audit-logs?group=company': () => json(page([entries[0]])),
    })
    renderAt('/admin/audit')

    const first = (await screen.findByText('رفض شركة')).closest('li')!
    expect(within(first).getByText('لم نتحقق من المحل')).toBeInTheDocument()
    expect(within(first).getByText('السبب:')).toBeInTheDocument()
    expect(within(first).getByText('قيد المراجعة')).toBeInTheDocument()
    expect(screen.getByText('النظام (مهمة تلقائية أو سطر الأوامر)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'بيليا' })).toHaveAttribute('href', `/admin/rfqs/${RFQ}`)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'نوع العملية' }), 'company')
    await userEvent.click(screen.getByRole('button', { name: 'اعرض' }))
    expect(await screen.findByRole('button', { name: 'امسح التصفية' })).toBeInTheDocument()
    expect(calledKeys(fetch)).toContain('GET /api/admin/audit-logs?group=company')
  })
})

describe('wording helpers', () => {
  it('agrees Arabic numbers with their nouns', () => {
    expect(durationLabel(0.5)).toBe('أقل من دقيقة')
    expect(durationLabel(1)).toBe('دقيقة واحدة')
    expect(durationLabel(2)).toBe('دقيقتين')
    expect(durationLabel(7)).toBe('7 دقائق')
    expect(durationLabel(45)).toBe('45 دقيقة')
    expect(durationLabel(180)).toBe('3 ساعات')
    expect(durationLabel(60 * 30)).toBe('30 ساعة')
    expect(durationLabel(60 * 24 * 4)).toBe('4 أيام')
    expect(suppliersLabel(0)).toBe('لا يوجد مورّد معتمد')
    expect(suppliersLabel(1)).toBe('مورّد معتمد واحد')
    expect(suppliersLabel(2)).toBe('مورّدان معتمدان')
    expect(suppliersLabel(12)).toBe('12 مورّداً معتمداً')
  })
})
