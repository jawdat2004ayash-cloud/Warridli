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

const guest = () => json({ message: 'يجب تسجيل الدخول أولاً.' }, 401)
const areas = () => json({ data: [{ id: 3, name: 'دمشق — الزبلطاني' }] })
const buyer = {
  id: 7,
  name: 'أبو خالد',
  email: 'k@example.com',
  is_admin: false,
  company: {
    id: 2,
    type: 'buyer',
    name: 'ورشة الأمل',
    whatsapp_phone: '+963944123456',
    area: { id: 3, name: 'دمشق — الزبلطاني' },
    address_text: null,
    status: 'approved',
    role: 'owner',
  },
}

describe('password reset error guidance', () => {
  it('focuses an error summary and clears corrected errors without moving focus from the field', async () => {
    mockApi({ 'GET /api/me': guest })
    const user = userEvent.setup()
    renderAt('/reset-password?token=test-only&email=k%40example.com')
    await user.click(await screen.findByRole('button', { name: 'احفظ كلمة المرور' }))
    const summary = await screen.findByRole('alert')
    expect(summary).toHaveFocus()
    await user.click(within(summary).getByRole('link', { name: /كلمة المرور قصيرة/ }))
    const password = screen.getByLabelText(/^كلمة المرور الجديدة/)
    expect(password).toHaveFocus()
    await user.type(password, 'safe-password1')
    expect(password).not.toHaveAttribute('aria-invalid')
    expect(password).toHaveFocus()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('announces a server password rejection, including M5a input validation', async () => {
    mockApi({
      'GET /api/me': guest, 'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/auth/reset-password': () => json({ errors: { password: ['كلمة المرور طويلة جداً. قصّرها.'] } }, 422),
    })
    const user = userEvent.setup()
    renderAt('/reset-password?token=test-only&email=k%40example.com')
    await user.type(await screen.findByLabelText(/^كلمة المرور الجديدة/), 'safe-password1')
    await user.type(screen.getByLabelText(/أعد كتابة/), 'safe-password1')
    await user.click(screen.getByRole('button', { name: 'احفظ كلمة المرور' }))
    expect(await screen.findByRole('alert')).toHaveFocus()
    expect(screen.getByLabelText(/^كلمة المرور الجديدة/)).toHaveAccessibleDescription(/كلمة المرور طويلة جداً/)
  })
})

describe('login page', () => {
  it('logs in and lands on the account page with a success message', async () => {
    const fetch = mockApi({
      'GET /api/me': guest,
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/auth/login': () => json({ data: buyer }),
    })
    const user = userEvent.setup()
    const router = renderAt('/login')

    await user.type(await screen.findByLabelText(/البريد الإلكتروني/), 'k@example.com')
    await user.type(screen.getByLabelText(/^كلمة المرور/), 'secret123')
    await user.click(screen.getByRole('button', { name: 'دخول' }))

    expect(await screen.findByText('أهلاً أبو خالد، تم تسجيل دخولك.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
    expect(screen.getByText('ورشة الأمل')).toBeInTheDocument()
    expect(calledKeys(fetch)).toContain('POST /api/auth/login')
  })

  it('validates in Arabic before sending anything', async () => {
    const fetch = mockApi({ 'GET /api/me': guest })
    const user = userEvent.setup()
    renderAt('/login')

    await user.click(await screen.findByRole('button', { name: 'دخول' }))

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveFocus()
    expect(within(summary).getByRole('link', { name: 'اكتب بريدك الإلكتروني.' })).toHaveAttribute('href', '#login-email')
    expect(calledKeys(fetch)).toEqual(['GET /api/me'])
  })

  it('shows the wrong-credentials message, focuses it and clears the password', async () => {
    mockApi({
      'GET /api/me': guest,
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/auth/login': () =>
        json({ message: 'x', errors: { email: ['البريد الإلكتروني أو كلمة المرور غير صحيحة.'] } }, 422),
    })
    const user = userEvent.setup()
    renderAt('/login')

    await user.type(await screen.findByLabelText(/البريد الإلكتروني/), 'k@example.com')
    const password = screen.getByLabelText(/^كلمة المرور/)
    await user.type(password, 'wrong123')
    await user.click(screen.getByRole('button', { name: 'دخول' }))

    const alert = await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
    expect(alert.closest('[role="alert"]')).toHaveFocus()
    expect(password).toHaveValue('')
  })

  it('explains a suspended account', async () => {
    mockApi({
      'GET /api/me': guest,
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/auth/login': () => json({ message: 'x' }, 403),
    })
    const user = userEvent.setup()
    renderAt('/login')

    await user.type(await screen.findByLabelText(/البريد الإلكتروني/), 'k@example.com')
    await user.type(screen.getByLabelText(/^كلمة المرور/), 'secret123')
    await user.click(screen.getByRole('button', { name: 'دخول' }))

    expect(await screen.findByText('هذا الحساب موقوف.')).toBeInTheDocument()
  })

  it('toggles password visibility with an accessible button', async () => {
    mockApi({ 'GET /api/me': guest })
    const user = userEvent.setup()
    renderAt('/login')

    const password = await screen.findByLabelText(/^كلمة المرور/)
    const toggle = screen.getByRole('button', { name: 'إظهار' })
    expect(password).toHaveAttribute('type', 'password')
    await user.click(toggle)
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'إخفاء' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('registration', () => {
  it('offers both account types', async () => {
    mockApi({ 'GET /api/me': guest })
    renderAt('/register')

    expect(await screen.findByRole('link', { name: /أحتاج قطعة غيار/ })).toHaveAttribute('href', '/register/buyer')
    expect(screen.getByRole('link', { name: /أبيع قطع غيار/ })).toHaveAttribute('href', '/register/supplier')
  })

  it('lists every client-side problem in an error summary and sends nothing', async () => {
    const fetch = mockApi({ 'GET /api/me': guest, 'GET /api/areas': areas })
    const user = userEvent.setup()
    renderAt('/register/buyer')

    await user.type(await screen.findByLabelText(/رقم الواتساب/), '011 222')
    await user.click(screen.getByRole('button', { name: 'إنشاء الحساب' }))

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveFocus()
    expect(within(summary).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'اكتب اسمك.',
      'اكتب بريدك الإلكتروني.',
      'اختر كلمة مرور.',
      'اكتب اسم المنشأة.',
      'رقم الواتساب غير صحيح. اكتب رقم موبايل سوري مثل 0944123456.',
      'اختر المنطقة.',
    ])
    expect(calledKeys(fetch)).not.toContain('POST /api/auth/register')
  })

  it('removes a field error as soon as the field is corrected, without stealing focus', async () => {
    mockApi({ 'GET /api/me': guest, 'GET /api/areas': areas })
    const user = userEvent.setup()
    renderAt('/register/buyer')

    await user.click(await screen.findByRole('button', { name: 'إنشاء الحساب' }))
    const summary = await screen.findByRole('alert')
    const name = screen.getByLabelText(/^الاسم/)
    expect(name).toHaveAttribute('aria-invalid', 'true')

    await user.type(name, 'أبو خالد')

    expect(name).not.toHaveAttribute('aria-invalid')
    expect(name).toHaveFocus()
    expect(within(summary).queryByText('اكتب اسمك.')).toBeNull()
    expect(within(summary).getByText('اكتب بريدك الإلكتروني.')).toBeInTheDocument()
  })

  it('submits a supplier registration and shows the pending-review notice', async () => {
    let body: Record<string, unknown> = {}
    mockApi({
      'GET /api/me': guest,
      'GET /api/areas': areas,
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/auth/register': (init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>
        return json({ data: { ...buyer, company: { ...buyer.company, type: 'supplier', status: 'pending' } } }, 201)
      },
    })
    const user = userEvent.setup()
    renderAt('/register/supplier')

    await user.type(await screen.findByLabelText(/^الاسم/), 'أبو خالد')
    await user.type(screen.getByLabelText(/البريد الإلكتروني/), 'k@example.com')
    await user.type(screen.getByLabelText(/^كلمة المرور/), 'secret123')
    await user.type(screen.getByLabelText(/أعد كتابة/), 'secret123')
    await user.type(screen.getByLabelText(/اسم المحل/), 'محل النور')
    await user.type(screen.getByLabelText(/رقم الواتساب/), '0944 123 456')
    await user.selectOptions(await screen.findByLabelText(/المنطقة/), '3')
    await user.click(screen.getByRole('button', { name: 'إنشاء الحساب' }))

    expect(await screen.findByText('تم إنشاء حسابك بنجاح.')).toBeInTheDocument()
    expect(screen.getByText('حسابك قيد المراجعة')).toBeInTheDocument()
    expect(body).toMatchObject({ account_type: 'supplier', area_id: 3, whatsapp_phone: '0944 123 456', company_name: 'محل النور' })
    expect(body).not.toHaveProperty('address_text')
  })

  it('maps server validation errors onto the fields', async () => {
    mockApi({
      'GET /api/me': guest,
      'GET /api/areas': areas,
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/auth/register': () =>
        json({ message: 'x', errors: { email: ['هذا البريد مسجّل مسبقاً. جرّب تسجيل الدخول أو استعادة كلمة المرور.'] } }, 422),
    })
    const user = userEvent.setup()
    renderAt('/register/buyer')

    await user.type(await screen.findByLabelText(/^الاسم/), 'أبو خالد')
    await user.type(screen.getByLabelText(/البريد الإلكتروني/), 'k@example.com')
    await user.type(screen.getByLabelText(/^كلمة المرور/), 'secret123')
    await user.type(screen.getByLabelText(/أعد كتابة/), 'secret123')
    await user.type(screen.getByLabelText(/اسم الورشة/), 'ورشة الأمل')
    await user.type(screen.getByLabelText(/رقم الواتساب/), '0944123456')
    await user.selectOptions(await screen.findByLabelText(/المنطقة/), '3')
    await user.click(screen.getByRole('button', { name: 'إنشاء الحساب' }))

    const email = screen.getByLabelText(/البريد الإلكتروني/)
    await screen.findByRole('alert')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription(/هذا البريد مسجّل مسبقاً/)
  })
})

describe('account page', () => {
  it('sends guests to login with a return path', async () => {
    mockApi({ 'GET /api/me': guest })
    const router = renderAt('/account')

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?next=%2Faccount')
    expect(screen.getByText('سجّل الدخول للمتابعة.')).toBeInTheDocument()
  })

  it('logs out and confirms it on the login page', async () => {
    const fetch = mockApi({
      'GET /api/me': () => json({ data: buyer }),
      'GET /sanctum/csrf-cookie': csrfOk,
      'POST /api/auth/logout': () => json(null, 204),
    })
    const user = userEvent.setup()
    const router = renderAt('/account')

    await user.click(await screen.findByRole('button', { name: 'تسجيل الخروج' }))

    expect(await screen.findByText('سجّلت الخروج بنجاح.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(calledKeys(fetch)).toContain('POST /api/auth/logout')
  })

  it('redirects logged-in users away from the login page', async () => {
    mockApi({ 'GET /api/me': () => json({ data: buyer }) })
    const router = renderAt('/login')

    expect(await screen.findByRole('heading', { name: 'حسابي' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
  })
})
