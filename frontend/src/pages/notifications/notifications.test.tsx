import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Providers } from '../../app/Providers'
import { routes } from '../../app/router'
import { describeNotification, type AppNotification } from '../../lib/notifications'
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

const company = (type: 'buyer' | 'supplier', status = 'approved') => ({
  id: 3,
  type,
  name: 'ورشة الأمل',
  whatsapp_phone: '+963944000111',
  area: { id: 1, name: 'دمشق' },
  address_text: null,
  status,
  role: 'owner',
})
const meAs = (c: ReturnType<typeof company> | null, isAdmin = false) => () =>
  json({ data: { id: 9, name: 'أبو خالد', email: 'b@example.com', is_admin: isAdmin, company: c } })

const RFQ = '01jnot0000000000000000000a'
const unreadQuote: AppNotification = {
  id: '6f0c2b1e-0000-4000-8000-000000000001',
  kind: 'quote_received',
  data: { rfq_id: RFQ, description: 'بيليا مضخة المياه', category: 'بيليا' },
  read: false,
  created_at: '2026-10-30T09:00:00+00:00',
}
const readTriage: AppNotification = {
  id: '6f0c2b1e-0000-4000-8000-000000000002',
  kind: 'rfq_triaged',
  data: { rfq_id: RFQ, description: 'قطعة دائرية', category: 'بيليا' },
  read: true,
  created_at: '2026-10-29T09:00:00+00:00',
}
const page = (data: AppNotification[], unread: number) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length, per_page: 20, unread } })

describe('home page: the next step for who you are', () => {
  it('offers sign-up / log-in to guests', async () => {
    mockApi({ 'GET /api/me': () => json({ message: 'x' }, 401) })
    renderAt('/')
    expect(await screen.findByRole('link', { name: 'أنشئ حساباً جديداً' })).toHaveAttribute('href', '/register')
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'تسجيل الدخول' })).toHaveAttribute('href', '/login')
  })

  it('gives a logged-in buyer a prominent "request a price" action and no sign-up links', async () => {
    mockApi({ 'GET /api/me': meAs(company('buyer')), 'GET /api/notifications/unread-count': () => json({ data: { unread: 0 } }) })
    renderAt('/')
    expect(await screen.findByRole('link', { name: 'اطلب سعر قطعة الآن' })).toHaveAttribute('href', '/rfqs/new')
    expect(screen.queryByRole('link', { name: 'أنشئ حساباً جديداً' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'تسجيل الدخول' })).toBeNull()
  })

  it('sends suppliers to their requests (approved) or specialties (under review), admins to the panel', async () => {
    mockApi({ 'GET /api/me': meAs(company('supplier', 'pending')), 'GET /api/notifications/unread-count': () => json({ data: { unread: 0 } }) })
    renderAt('/')
    expect(await screen.findByRole('link', { name: 'اختر تخصصاتك' })).toHaveAttribute('href', '/supplier/categories')
  })

  it('sends admins to the panel', async () => {
    mockApi({ 'GET /api/me': meAs(null, true) })
    renderAt('/')
    expect(await screen.findByRole('link', { name: 'افتح لوحة الإدارة' })).toHaveAttribute('href', '/admin')
  })
})

describe('header bell', () => {
  it('shows the unread count to company members, in text for screen readers too', async () => {
    mockApi({ 'GET /api/me': meAs(company('buyer')), 'GET /api/notifications/unread-count': () => json({ data: { unread: 3 } }) })
    renderAt('/account')
    const bell = await screen.findByRole('link', { name: 'الإشعارات — 3 غير مقروءة' })
    expect(bell).toHaveAttribute('href', '/notifications')
    expect(bell).toHaveTextContent('3')
  })

  it('is absent for admins (they receive none) and never polls for them', async () => {
    const fetch = mockApi({ 'GET /api/me': meAs(null, true) })
    renderAt('/account')
    expect(await screen.findByRole('link', { name: /أبو خالد/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /الإشعارات/ })).toBeNull()
    expect(calledKeys(fetch).some((k) => k.includes('/api/notifications'))).toBe(false)
  })
})

describe('notifications page', () => {
  it('lists notifications with their wording, marks unread ones, and opens the related request after marking it read', async () => {
    const fetch = mockApi({
      'GET /api/me': meAs(company('buyer')),
      'GET /api/notifications/unread-count': () => json({ data: { unread: 1 } }),
      'GET /api/notifications': () => json(page([unreadQuote, readTriage], 1)),
      'GET /sanctum/csrf-cookie': csrfOk,
      [`POST /api/notifications/${unreadQuote.id}/read`]: () => json({ data: { ...unreadQuote, read: true } }),
      [`GET /api/rfqs/${RFQ}`]: () => json({ message: 'x' }, 404),
    })
    const router = renderAt('/notifications')

    expect(await screen.findByText('لديك', { exact: false })).toHaveTextContent('لديك 1 غير مقروءة.')
    const item = screen.getByRole('link', { name: /وصلك عرض سعر جديد/ })
    expect(item).toHaveTextContent('جديد:')
    expect(screen.getByRole('link', { name: /وصل طلبك إلى المورّدين في «بيليا»/ })).not.toHaveTextContent('جديد:')

    await userEvent.click(item)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/rfqs/${RFQ}`))
    expect(calledKeys(fetch)).toContain(`POST /api/notifications/${unreadQuote.id}/read`)
  })

  it('marks everything as read in one action', async () => {
    let unread = 1
    const fetch = mockApi({
      'GET /api/me': meAs(company('buyer')),
      'GET /api/notifications/unread-count': () => json({ data: { unread } }),
      'GET /api/notifications': () => json(page(unread ? [unreadQuote] : [{ ...unreadQuote, read: true }], unread)),
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/notifications/read-all': () => {
        unread = 0
        return json({ data: { unread: 0 } })
      },
    })
    renderAt('/notifications')

    await userEvent.click(await screen.findByRole('button', { name: 'علّم الكل كمقروء' }))
    expect(await screen.findByText('قرأت كل الإشعارات.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'علّم الكل كمقروء' })).toBeNull()
    expect(calledKeys(fetch)).toContain('POST /api/notifications/read-all')
  })

  it('explains the empty state and offers a retry on errors', async () => {
    let fail = true
    mockApi({
      'GET /api/me': meAs(company('supplier')),
      'GET /api/notifications/unread-count': () => json({ data: { unread: 0 } }),
      'GET /api/notifications': () => (fail ? json({ message: 'x' }, 500) : json(page([], 0))),
    })
    renderAt('/notifications')

    expect(await screen.findByText('تعذّر تحميل الإشعارات', undefined, { timeout: 5000 })).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'أعد المحاولة' }))
    expect(await screen.findByText('لا توجد إشعارات بعد')).toBeInTheDocument()
  })
})

describe('notification wording', () => {
  const n = (kind: string, data: AppNotification['data'] = {}): AppNotification => ({ id: 'x', kind, data, read: false, created_at: '' })

  it('links each kind to the page where the person acts on it', () => {
    expect(describeNotification(n('rfq_matched', { rfq_id: 'R', category: 'بيليا', description: 'd' }))).toEqual({ title: 'طلب سعر جديد في «بيليا»', text: 'd', link: '/supplier/rfqs/R' })
    expect(describeNotification(n('quote_selected', { rfq_id: 'R' })).link).toBe('/supplier/rfqs/R')
    expect(describeNotification(n('quote_received', { rfq_id: 'R' })).link).toBe('/rfqs/R')
    expect(describeNotification(n('rfq_rejected', { rfq_id: 'R', description: 'd' })).title).toBe('لم يُقبل طلبك')
    expect(describeNotification(n('supplier_approved')).link).toBe('/supplier/rfqs')
    expect(describeNotification(n('specialty_rejected', { category: 'سيور' }))).toMatchObject({ title: 'لم يُعتمد تخصص «سيور»', link: '/supplier/categories' })
    expect(describeNotification(n('something_new'))).toEqual({ title: 'إشعار جديد' })
  })
})
