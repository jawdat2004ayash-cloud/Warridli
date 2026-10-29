import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Providers } from '../../app/Providers'
import { routes } from '../../app/router'
import { damascusDate, daysLabel, normalizePrice } from '../../lib/supplier'
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
  id: 5,
  type: 'supplier',
  name: 'محل النور',
  whatsapp_phone: '+963944123456',
  area: { id: 3, name: 'دمشق — الزبلطاني' },
  address_text: null,
  status: 'approved',
  role: 'owner',
}
const me = (status = 'approved') => () => json({ data: { id: 9, name: 'أبو سامر', email: 's@example.com', is_admin: false, company: { ...company, status } } })

const ID = '01jcsup0000000000000000000'
const rfq = {
  id: ID,
  status: 'open',
  accepts_quotes: true,
  category: { id: 1, slug: 'bearings', name: 'بيليا ورولمان (محامل)' },
  description: 'بيليا محرك مضخة المياه',
  part_number: '6205-2RS',
  machine_make: null,
  machine_model: null,
  quantity: 4,
  unit: 'piece',
  urgency: 'urgent',
  area: { id: 4, name: 'ريف دمشق — جرمانا' },
  closes_at: '2026-11-03T10:00:00+00:00',
  created_at: '2026-10-27T10:00:00+00:00',
  photos_count: 0,
  photos: [],
  my_quote: null,
}
const quote = {
  status: 'submitted',
  unit_price: '125000.00',
  currency: 'SYP',
  condition: 'new',
  brand: 'SKF',
  origin: null,
  stock_status: 'in_stock',
  lead_time_days: 0,
  fulfillment: 'pickup',
  valid_until: damascusDate(7),
  notes: null,
  updated_at: '2026-10-28T10:00:00+00:00',
}
const page = (data: unknown[]) => json({ data, meta: { current_page: 1, last_page: 1, total: data.length, per_page: 20 } })

describe('normalizePrice', () => {
  it('accepts how traders type prices and rejects the rest', () => {
    expect(normalizePrice('125,000')).toBe('125000')
    expect(normalizePrice('١٢٥٬٠٠٠')).toBe('125000')
    expect(normalizePrice('12٫5')).toBe('12.5')
    expect(normalizePrice('12.555')).toBeNull()
    expect(normalizePrice('مية')).toBeNull()
    expect(normalizePrice('-5')).toBeNull()
  })
})

describe('daysLabel', () => {
  it('uses Arabic number agreement', () => {
    expect([1, 2, 3, 10, 11].map(daysLabel)).toEqual(['يوم واحد', 'يومين', '3 أيام', '10 أيام', '11 يوماً'])
  })
})

describe('supplier inbox', () => {
  it('lists new requests without any buyer identity and links to details', async () => {
    mockApi({ 'GET /api/me': me(), 'GET /api/supplier/rfqs?tab=new&page=1': () => page([rfq]) })
    renderAt('/supplier/rfqs')

    const link = await screen.findByRole('link', { name: /بيليا محرك مضخة المياه/ })
    expect(link).toHaveAttribute('href', `/supplier/rfqs/${ID}`)
    expect(within(link).getByText('ريف دمشق — جرمانا')).toBeInTheDocument()
    expect(within(link).getByText('مستعجل')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'طلبات جديدة' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows my quote on the "my quotes" tab', async () => {
    mockApi({ 'GET /api/me': me(), 'GET /api/supplier/rfqs?tab=quoted&page=1': () => page([{ ...rfq, my_quote: quote }]) })
    renderAt('/supplier/rfqs?tab=quoted')

    const link = await screen.findByRole('link', { name: /بيليا محرك مضخة المياه/ })
    expect(within(link).getByText(/عرضك:/)).toBeInTheDocument()
    expect(within(link).getByText('125,000')).toBeInTheDocument()
  })

  it('explains an empty inbox and points to specialties', async () => {
    mockApi({ 'GET /api/me': me(), 'GET /api/supplier/rfqs?tab=new&page=1': () => page([]) })
    renderAt('/supplier/rfqs')

    expect(await screen.findByText('لا توجد طلبات جديدة الآن')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'راجع تخصصاتي' })).toHaveAttribute('href', '/supplier/categories')
  })

  it('tells a supplier under review to wait, without loading requests', async () => {
    const fetch = mockApi({ 'GET /api/me': me('pending') })
    renderAt('/supplier/rfqs')

    expect(await screen.findByText('حسابك قيد المراجعة')).toBeInTheDocument()
    expect(calledKeys(fetch).some((k) => k.includes('/api/supplier/rfqs'))).toBe(false)
  })
})

describe('supplier RFQ page and quote', () => {
  it('sends a quote with a normalized price and shows the total and a success message', async () => {
    let body: Record<string, unknown> | null = null
    mockApi({
      'GET /api/me': me(),
      [`GET /api/supplier/rfqs/${ID}`]: () => json({ data: rfq }),
      'GET /sanctum/csrf-cookie': csrfOk,
      [`PUT /api/supplier/rfqs/${ID}/quote`]: (init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>
        return json({ data: { ...rfq, my_quote: quote } })
      },
    })
    const user = userEvent.setup()
    renderAt(`/supplier/rfqs/${ID}`)

    expect(await screen.findByRole('heading', { name: 'بيليا محرك مضخة المياه' })).toBeInTheDocument()
    expect(screen.getByText(/لا نعرض اسم المشتري ولا رقمه/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^سعر القطعة الواحدة/), '١٢٥,٠٠٠')
    expect(screen.getByText('500,000')).toBeInTheDocument() // 4 × 125,000
    await user.click(screen.getByRole('button', { name: 'أرسل العرض' }))

    expect(await screen.findByText('تم إرسال عرضك.')).toBeInTheDocument()
    expect(body).toMatchObject({ unit_price: '125000', currency: 'SYP', condition: 'new', stock_status: 'in_stock', fulfillment: 'pickup', valid_until: damascusDate(7) })
    expect(body).not.toHaveProperty('lead_time_days')
    expect(screen.getByRole('button', { name: 'عدّل العرض' })).toBeInTheDocument()
  })

  it('checks the price and waiting days before calling the API', async () => {
    const fetch = mockApi({ 'GET /api/me': me(), [`GET /api/supplier/rfqs/${ID}`]: () => json({ data: rfq }) })
    const user = userEvent.setup()
    renderAt(`/supplier/rfqs/${ID}`)

    await user.click(await screen.findByRole('radio', { name: /أحتاج وقتاً لتأمينها/ }))
    await user.click(screen.getByRole('button', { name: 'أرسل العرض' }))

    const summary = await screen.findByRole('alert')
    expect(within(summary).getByText('اكتب سعر القطعة الواحدة.')).toBeInTheDocument()
    expect(within(summary).getByText('اكتب خلال كم يوم تتوفر القطعة.')).toBeInTheDocument()
    expect(calledKeys(fetch)).not.toContain(`PUT /api/supplier/rfqs/${ID}/quote`)
  })

  it('edits an existing quote with the form pre-filled', async () => {
    let body: Record<string, unknown> | null = null
    mockApi({
      'GET /api/me': me(),
      [`GET /api/supplier/rfqs/${ID}`]: () => json({ data: { ...rfq, my_quote: quote } }),
      'GET /sanctum/csrf-cookie': csrfOk,
      [`PUT /api/supplier/rfqs/${ID}/quote`]: (init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>
        return json({ data: { ...rfq, my_quote: { ...quote, unit_price: '119000.00' } } })
      },
    })
    const user = userEvent.setup()
    renderAt(`/supplier/rfqs/${ID}`)

    await user.click(await screen.findByRole('button', { name: 'عدّل العرض' }))
    const price = screen.getByLabelText(/^سعر القطعة الواحدة/)
    expect(price).toHaveValue('125000')
    await user.clear(price)
    await user.type(price, '119000')
    await user.click(screen.getByRole('button', { name: 'احفظ التعديل' }))

    expect(await screen.findByText('تم حفظ التعديل على عرضك.')).toBeInTheDocument()
    expect(body).toMatchObject({ unit_price: '119000', brand: 'SKF' })
  })

  it('withdraws only after confirmation', async () => {
    const fetch = mockApi({
      'GET /api/me': me(),
      [`GET /api/supplier/rfqs/${ID}`]: () => json({ data: { ...rfq, my_quote: quote } }),
      'GET /sanctum/csrf-cookie': csrfOk,
      [`POST /api/supplier/rfqs/${ID}/quote/withdraw`]: () => json({ data: { ...rfq, my_quote: { ...quote, status: 'withdrawn' } } }),
    })
    const user = userEvent.setup()
    renderAt(`/supplier/rfqs/${ID}`)

    await user.click(await screen.findByRole('button', { name: 'اسحب العرض' }))
    expect(calledKeys(fetch)).not.toContain(`POST /api/supplier/rfqs/${ID}/quote/withdraw`)
    await user.click(screen.getByRole('button', { name: 'نعم، اسحب العرض' }))

    expect(await screen.findByText('سحبت عرضك. لم يعد يظهر للمشتري.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'قدّم عرضاً من جديد' })).toBeInTheDocument()
  })

  it('offers no form when the request no longer accepts quotes', async () => {
    mockApi({ 'GET /api/me': me(), [`GET /api/supplier/rfqs/${ID}`]: () => json({ data: { ...rfq, status: 'cancelled', accepts_quotes: false, my_quote: quote } }) })
    renderAt(`/supplier/rfqs/${ID}`)

    expect(await screen.findByText('هذا الطلب لم يعد يستقبل عروضاً')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /أرسل العرض|عدّل العرض|اسحب العرض/ })).not.toBeInTheDocument()
  })

  it('says the request is not available for 404', async () => {
    mockApi({ 'GET /api/me': me(), [`GET /api/supplier/rfqs/${ID}`]: () => json({ message: 'x' }, 404) })
    renderAt(`/supplier/rfqs/${ID}`)

    expect(await screen.findByText('هذا الطلب غير متاح لك')).toBeInTheDocument()
  })
})

describe('supplier specialties', () => {
  it('shows status per category and saves the selection', async () => {
    let body: unknown = null
    mockApi({
      'GET /api/me': me('pending'),
      'GET /api/supplier/categories': () =>
        json({ data: [{ id: 1, name: 'بيليا', status: 'approved' }, { id: 2, name: 'سيور', status: null }] }),
      'GET /sanctum/csrf-cookie': csrfOk,
      'PUT /api/supplier/categories': (init) => {
        body = JSON.parse(String(init?.body))
        return json({ data: [{ id: 1, name: 'بيليا', status: 'approved' }, { id: 2, name: 'سيور', status: 'pending' }] })
      },
    })
    const user = userEvent.setup()
    renderAt('/supplier/categories')

    expect(await screen.findByRole('checkbox', { name: /بيليا/ })).toBeChecked()
    expect(screen.getByText('معتمد')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /سيور/ }))
    await user.click(screen.getByRole('button', { name: 'احفظ التخصصات' }))

    expect(await screen.findByText('تم حفظ تخصصاتك.')).toBeInTheDocument()
    expect(body).toEqual({ category_ids: [1, 2] })
    expect(screen.getByText('قيد المراجعة', { selector: 'span' })).toBeInTheDocument()
  })
})
