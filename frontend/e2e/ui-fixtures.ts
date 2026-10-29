import type { Page } from '@playwright/test'

/** Synthetic UI fixtures only. Existing real-API journeys continue to prove the server's authorization. */
export type UiRole = 'guest' | 'buyer' | 'supplier' | 'admin'
export const RFQ_ID = '01ja110000000000000000000a'
export const QUOTED_ID = '01ja110000000000000000000b'
const area = { id: 1, name: 'ريف دمشق — الزبلطاني والمنطقة الصناعية' }
export const categories = [{ id: 1, slug: 'bearings', name: 'بيليا ورولمان (محامل)' }]
const longName = 'عبد الرحمن محمد أحمد صاحب ورشة الصيانة الصناعية'

export const rfq = {
  id: RFQ_ID, status: 'open', accepts_quotes: true, selected_quote_id: null,
  category: categories[0]!, description: 'بيليا لمحرك مضخة المياه في ورشة الصيانة',
  part_number: '6205-2RS-INDUSTRIAL-PART-NUMBER', machine_make: 'شركة المعدات الصناعية', machine_model: 'MODEL-2026',
  quantity: 100000, unit: 'piece', urgency: 'line_stopped', area,
  closes_at: '2026-11-04T12:00:00Z', created_at: '2026-10-28T09:00:00Z', photos_count: 0, quotes_count: 2, photos: [],
}
export const quote = {
  id: 1, supplier: { name: 'مستودع قطع الغيار والصيانة الصناعية', area }, unit_price: '999999999999.99',
  currency: 'SYP', condition: 'new', brand: 'SKF', origin: 'السويد', stock_status: 'on_order', lead_time_days: 3,
  fulfillment: 'either', valid_until: '2026-11-10', price_expired: false,
  notes: 'عرض على القطعة المطلوبة، يرجى مراجعة رقم القطعة قبل الاختيار.', updated_at: '2026-10-28T10:00:00Z', selected: false,
}
const ownQuote = { ...quote, status: 'submitted' as const }
const adminRfq = {
  ...rfq, status: 'pending_review', category: null, triaged_at: null,
  buyer: { company_id: 2, name: 'ورشة الصيانة الصناعية', whatsapp_phone: '+963944000111' },
}
const company = {
  id: 7, type: 'supplier', name: 'مستودع قطع الغيار الصناعية', whatsapp_phone: '+963944000111', area,
  address_text: 'المنطقة الصناعية', status: 'pending', verified_at: null, created_at: rfq.created_at,
  members: [{ user_id: 11, name: longName, email: 'long-workshop-email-address@example.test', role: 'owner', suspended: false }],
  categories: [{ id: 1, name: categories[0]!.name, status: 'pending' }],
}
const metrics = {
  period_days: 30, since: null, generated_at: rfq.created_at,
  rfqs: { created: 12, by_status: { pending_review: 1, open: 6, closed: 3, cancelled: 1, expired: 1, rejected: 0 }, published: 10, with_quote: 7, with_quote_rate: 0.7, with_selection: 3 },
  first_quote: { sample: 7, median_minutes: 120 }, triage: { sample: 2, median_minutes: 45 },
  contacts: { reveals: 9, rfqs: 4 }, queue: { suppliers_pending: 2, specialties_pending: 1, rfqs_pending_review: 3 },
}
const paged = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 2, total: 21, per_page: 20, unread: 1 } })

export async function installUiFixture(page: Page, role: UiRole) {
  const me = role === 'guest' ? null : {
    id: 3, name: longName, email: 'workshop@example.test', is_admin: role === 'admin',
    company: role === 'admin' ? null : { id: 2, type: role, name: 'ورشة الصيانة الصناعية', whatsapp_phone: '+963944000111', area, address_text: null, status: 'approved', role: 'owner' },
  }
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }))
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/me') return route.fulfill({ status: me ? 200 : 401, json: me ? { data: me } : { message: 'يجب تسجيل الدخول أولاً.' } })
    if (route.request().method() !== 'GET') throw new Error(`Unexpected mutation during UI audit: ${path}`)
    const responses: Record<string, unknown> = {
      '/api/areas': { data: [area] }, '/api/categories': { data: categories },
      '/api/notifications/unread-count': { data: { unread: 1 } },
      '/api/notifications': paged([{ id: '6f0c2b1e-0000-4000-8000-000000000001', kind: role === 'supplier' ? 'rfq_matched' : 'quote_received', data: { rfq_id: RFQ_ID, description: rfq.description, category: categories[0]!.name }, read: false, created_at: rfq.created_at }]),
      '/api/rfqs': paged([rfq]), [`/api/rfqs/${RFQ_ID}`]: { data: rfq },
      [`/api/rfqs/${RFQ_ID}/quotes`]: { data: [quote, { ...quote, id: 2, supplier: { ...quote.supplier, name: 'محل السيور والمحامل' }, currency: 'USD', unit_price: '25.00' }] },
      '/api/supplier/categories': { data: [{ id: 1, name: categories[0]!.name, status: 'approved' }, { id: 2, name: 'سيور وقشاط نقل الحركة', status: null }] },
      '/api/supplier/rfqs': paged([{ ...rfq, my_quote: null }]),
      [`/api/supplier/rfqs/${RFQ_ID}`]: { data: { ...rfq, my_quote: null } },
      [`/api/supplier/rfqs/${QUOTED_ID}`]: { data: { ...rfq, id: QUOTED_ID, my_quote: ownQuote } },
      '/api/admin/metrics': { data: metrics }, '/api/admin/companies': paged([company]),
      '/api/admin/rfqs': paged([adminRfq]), [`/api/admin/rfqs/${RFQ_ID}`]: { data: adminRfq },
      '/api/admin/categories': { data: categories.map((c) => ({ ...c, is_active: true, sort: 10, rfqs_count: 5, open_rfqs_count: 3, suppliers_count: 2 })) },
      '/api/admin/audit-logs': paged([{ id: 1, action: 'company.approved', actor: { id: 3, name: longName, email: 'admin@example.test', is_admin: true }, subject: { type: 'company', id: 7, label: company.name, ref: null }, meta: { from: 'pending', to: 'approved' }, ip: '127.0.0.1', created_at: rfq.created_at }]),
    }
    if (!(path in responses)) throw new Error(`Unexpected UI audit request: ${path}`)
    await route.fulfill({ json: responses[path] })
  })
}
