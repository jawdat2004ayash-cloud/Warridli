import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
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

const me = () =>
  json({
    data: {
      id: 7,
      name: 'أبو خالد',
      email: 'k@example.com',
      is_admin: false,
      company: { id: 2, type: 'buyer', name: 'ورشة الأمل', whatsapp_phone: '+963944123456', area: { id: 3, name: 'دمشق' }, address_text: null, status: 'approved', role: 'owner' },
    },
  })

const ID = '01jcrfqcmp00000000000000000'
const rfq = {
  id: ID,
  status: 'open',
  accepts_quotes: true,
  selected_quote_id: null,
  category: { id: 1, slug: 'bearings', name: 'بيليا' },
  description: 'بيليا مضخة المياه',
  part_number: null,
  machine_make: null,
  machine_model: null,
  quantity: 4,
  unit: 'piece',
  urgency: 'normal',
  area: { id: 3, name: 'دمشق' },
  closes_at: '2026-11-03T10:00:00+00:00',
  created_at: '2026-10-27T10:00:00+00:00',
  photos_count: 0,
  quotes_count: 3,
  photos: [],
}
const base = {
  supplier: { name: 'محل النور', area: { id: 3, name: 'دمشق — الزبلطاني' } },
  currency: 'SYP',
  condition: 'new',
  brand: null,
  origin: null,
  stock_status: 'in_stock',
  lead_time_days: 0,
  fulfillment: 'pickup',
  valid_until: '2026-11-05',
  price_expired: false,
  notes: null,
  selected: false,
}
const cheap = { ...base, id: 11, unit_price: '90000.00', stock_status: 'on_order', lead_time_days: 3, updated_at: '2026-10-28T08:00:00+00:00' }
const fast = { ...base, id: 12, supplier: { ...base.supplier, name: 'مستودع الأمين' }, unit_price: '120000.00', notes: 'كفالة شهر', updated_at: '2026-10-28T09:00:00+00:00' }
const usd = { ...base, id: 13, supplier: { ...base.supplier, name: 'شركة الشام' }, unit_price: '7.50', currency: 'USD', updated_at: '2026-10-28T07:00:00+00:00' }

const supplierNames = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('buyer quote comparison', () => {
  it('lists quotes cheapest first with totals, marks the cheapest, warns about mixed currencies and shows no phone', async () => {
    mockApi({ 'GET /api/me': me, [`GET /api/rfqs/${ID}`]: () => json({ data: rfq }), [`GET /api/rfqs/${ID}/quotes`]: () => json({ data: [fast, usd, cheap] }) })
    const user = userEvent.setup()
    renderAt(`/rfqs/${ID}`)

    expect(await screen.findByText(/وصلك/)).toHaveTextContent('وصلك 3 عروض')
    expect(supplierNames()).toEqual(['محل النور', 'مستودع الأمين', 'شركة الشام'])
    const first = screen.getByRole('article', { name: 'محل النور' })
    expect(within(first).getByText('الأرخص')).toBeInTheDocument()
    expect(within(first).getByText('360,000')).toBeInTheDocument() // 4 × 90,000
    expect(within(first).getByText('خلال 3 أيام')).toBeInTheDocument()
    expect(screen.getByText('العروض بعملتين مختلفتين')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('+963')

    await user.selectOptions(screen.getByRole('combobox', { name: 'رتّب حسب' }), 'fastest')
    expect(supplierNames()[0]).toBe('مستودع الأمين')
  })

  it('explains an empty comparison', async () => {
    mockApi({ 'GET /api/me': me, [`GET /api/rfqs/${ID}`]: () => json({ data: { ...rfq, quotes_count: 0 } }), [`GET /api/rfqs/${ID}/quotes`]: () => json({ data: [] }) })
    renderAt(`/rfqs/${ID}`)

    expect(await screen.findByText('لم تصل عروض بعد')).toBeInTheDocument()
    expect(screen.getByText('أرسلنا طلبك إلى المورّدين المختصين. ستظهر عروضهم هنا فور وصولها.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'إلغاء الطلب' })).toBeInTheDocument()
  })

  it('reveals the supplier number only on request, with a WhatsApp link', async () => {
    const fetch = mockApi({
      'GET /api/me': me,
      [`GET /api/rfqs/${ID}`]: () => json({ data: rfq }),
      [`GET /api/rfqs/${ID}/quotes`]: () => json({ data: [cheap] }),
      'GET /sanctum/csrf-cookie': csrfOk,
      [`POST /api/rfqs/${ID}/quotes/11/contact`]: () => json({ data: { phone: '+963944111222', whatsapp_url: 'https://wa.me/963944111222?text=x' } }),
    })
    const user = userEvent.setup()
    renderAt(`/rfqs/${ID}`)

    await user.click(await screen.findByRole('button', { name: 'أظهر رقم واتساب المورّد' }))

    expect(await screen.findByText('+963944111222')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /افتح المحادثة في واتساب/ })
    expect(link).toHaveAttribute('href', 'https://wa.me/963944111222?text=x')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(calledKeys(fetch).filter((k) => k.endsWith('/contact'))).toHaveLength(1)
  })

  it('chooses a quote only after confirmation, sending the version the buyer saw', async () => {
    let body: unknown = null
    let chosen = false
    mockApi({
      'GET /api/me': me,
      [`GET /api/rfqs/${ID}`]: () => json({ data: chosen ? { ...rfq, status: 'closed', accepts_quotes: false, selected_quote_id: 11 } : rfq }),
      [`GET /api/rfqs/${ID}/quotes`]: () => json({ data: chosen ? [{ ...cheap, selected: true }, fast] : [cheap, fast] }),
      'GET /sanctum/csrf-cookie': csrfOk,
      [`POST /api/rfqs/${ID}/quotes/11/select`]: (init) => {
        body = JSON.parse(String(init?.body))
        chosen = true
        return json({ data: { ...rfq, status: 'closed', accepts_quotes: false, selected_quote_id: 11 } })
      },
    })
    const user = userEvent.setup()
    renderAt(`/rfqs/${ID}`)

    const card = await screen.findByRole('article', { name: 'محل النور' })
    await user.click(within(card).getByRole('button', { name: 'اختر هذا العرض' }))
    expect(within(card).getByText(/سيُغلق الطلب، ولن تصل عروض جديدة/)).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'نعم، اختر هذا العرض' }))

    expect(await screen.findByText('اخترت عرضاً وأغلقت الطلب.')).toBeInTheDocument()
    expect(body).toEqual({ seen_updated_at: '2026-10-28T08:00:00+00:00' })
    expect(await screen.findByText('العرض الذي اخترته')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'اختر هذا العرض' })).not.toBeInTheDocument()
    // After closing, only the chosen supplier can be contacted.
    expect(within(screen.getByRole('article', { name: 'محل النور' })).getByRole('button', { name: 'أظهر رقم واتساب المورّد' })).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'مستودع الأمين' })).queryByRole('button', { name: 'أظهر رقم واتساب المورّد' })).not.toBeInTheDocument()
  })

  it('shows the server\'s explanation when the quote changed meanwhile, and reloads the quotes', async () => {
    let quoteLoads = 0
    mockApi({
      'GET /api/me': me,
      [`GET /api/rfqs/${ID}`]: () => json({ data: rfq }),
      [`GET /api/rfqs/${ID}/quotes`]: () => {
        quoteLoads++
        return json({ data: [cheap] })
      },
      'GET /sanctum/csrf-cookie': csrfOk,
      [`POST /api/rfqs/${ID}/quotes/11/select`]: () => json({ message: 'عدّل المورّد هذا العرض بعد أن فتحت الصفحة. راجع السعر الجديد ثم اختر من جديد.' }, 409),
    })
    const user = userEvent.setup()
    renderAt(`/rfqs/${ID}`)

    await user.click(await screen.findByRole('button', { name: 'اختر هذا العرض' }))
    await user.click(screen.getByRole('button', { name: 'نعم، اختر هذا العرض' }))

    expect(await screen.findByText('عدّل المورّد هذا العرض بعد أن فتحت الصفحة. راجع السعر الجديد ثم اختر من جديد.')).toBeInTheDocument()
    await screen.findByRole('button', { name: 'اختر هذا العرض' })
    expect(quoteLoads).toBeGreaterThan(1)
  })

  it('does not offer to choose a quote whose price expired', async () => {
    mockApi({ 'GET /api/me': me, [`GET /api/rfqs/${ID}`]: () => json({ data: rfq }), [`GET /api/rfqs/${ID}/quotes`]: () => json({ data: [{ ...cheap, price_expired: true }] }) })
    renderAt(`/rfqs/${ID}`)

    expect(await screen.findByText('انتهت صلاحية السعر')).toBeInTheDocument()
    expect(screen.getByText('لا يمكن اختيار سعر منتهي الصلاحية. تواصل مع المورّد ليجدده.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'اختر هذا العرض' })).not.toBeInTheDocument()
    expect(screen.queryByText('الأرخص')).not.toBeInTheDocument()
  })

  it('closes without choosing once quotes exist, after confirmation', async () => {
    let closed = false
    mockApi({
      'GET /api/me': me,
      [`GET /api/rfqs/${ID}`]: () => json({ data: closed ? { ...rfq, status: 'closed', accepts_quotes: false } : rfq }),
      [`GET /api/rfqs/${ID}/quotes`]: () => json({ data: [cheap] }),
      'GET /sanctum/csrf-cookie': csrfOk,
      [`POST /api/rfqs/${ID}/close`]: () => {
        closed = true
        return json({ data: { ...rfq, status: 'closed', accepts_quotes: false } })
      },
    })
    const user = userEvent.setup()
    renderAt(`/rfqs/${ID}`)

    expect(await screen.findByRole('button', { name: 'أغلق الطلب دون اختيار عرض' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'إلغاء الطلب' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'أغلق الطلب دون اختيار عرض' }))
    await user.click(screen.getByRole('button', { name: 'نعم، أغلق الطلب' }))

    expect(await screen.findByText('أغلقت هذا الطلب دون اختيار عرض.')).toBeInTheDocument()
  })

  it('explains an expired answer window and still allows choosing', async () => {
    mockApi({
      'GET /api/me': me,
      [`GET /api/rfqs/${ID}`]: () => json({ data: { ...rfq, status: 'expired', accepts_quotes: false } }),
      [`GET /api/rfqs/${ID}/quotes`]: () => json({ data: [cheap] }),
    })
    renderAt(`/rfqs/${ID}`)

    expect(await screen.findByText('انتهت مدة استقبال العروض')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'اختر هذا العرض' })).toBeInTheDocument()
  })
})
