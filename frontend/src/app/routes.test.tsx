import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { mockApi } from '../test/mockApi'
import { Providers } from './Providers'
import { routes } from './router'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('routes', () => {
  it('renders the layout with a skip link and the home page', () => {
    mockApi({ 'GET /api/me': () => json({}, 401) })
    renderAt('/')
    expect(screen.getByRole('link', { name: 'تخطَّ إلى المحتوى' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('shows a 404 state for unknown paths', () => {
    mockApi({ 'GET /api/me': () => json({}, 401) })
    renderAt('/does-not-exist')
    expect(screen.getByText('الصفحة غير موجودة')).toBeInTheDocument()
  })

  it('design specimen reports a healthy API through /api/health', async () => {
    const fetch = mockApi({
      'GET /api/me': () => json({}, 401),
      'GET /api/health': () => json({ status: 'ok', database: 'ok' }),
    })

    renderAt('/design')

    expect(await screen.findByText(/قاعدة البيانات: متصلة/)).toBeInTheDocument()
    expect(fetch.mock.calls.map(([input]) => input)).toContain('/api/health')
  })

  it('design specimen shows an error state with retry when the API is down', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))

    renderAt('/design')

    // Network errors are retried twice (Providers) before the error state appears.
    const title = await screen.findByText('الخادم غير متاح', {}, { timeout: 8000 })
    const alert = title.closest('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert).toHaveTextContent('تعذّر الاتصال بالخادم')
  }, 10_000)

  it('shows login and register links in the header for guests', async () => {
    mockApi({ 'GET /api/me': () => json({}, 401) })
    renderAt('/')
    const nav = await screen.findByRole('navigation', { name: 'الحساب' })
    expect(await within(nav).findByRole('link', { name: 'تسجيل الدخول' })).toHaveAttribute('href', '/login')
    expect(within(nav).getByRole('link', { name: 'حساب جديد' })).toHaveAttribute('href', '/register')
  })
})
