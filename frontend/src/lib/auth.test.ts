import { describe, expect, it } from 'vitest'
import { calledKeys, csrfOk, json, mockApi } from '../test/mockApi'
import { ApiError } from './api'
import { getMe, login, logout, safeNextPath } from './auth'

const me = { id: 1, name: 'أبو خالد', email: 'k@example.com', is_admin: false, company: null }

describe('auth client', () => {
  it('treats 401 on /api/me as "guest", not as an error', async () => {
    mockApi({ 'GET /api/me': () => json({ message: 'x' }, 401) })
    await expect(getMe()).resolves.toBeNull()
  })

  it('propagates other /api/me failures', async () => {
    mockApi({ 'GET /api/me': () => json({}, 500) })
    await expect(getMe()).rejects.toBeInstanceOf(ApiError)
  })

  it('fetches the CSRF cookie before logging in and sends the XSRF header', async () => {
    const fetch = mockApi({
      'GET /sanctum/csrf-cookie': () => {
        document.cookie = 'XSRF-TOKEN=abc%3D123; path=/'
        return csrfOk()
      },
      'POST /api/auth/login': () => json({ data: me }),
    })

    await expect(login('k@example.com', 'secret123')).resolves.toEqual(me)

    expect(calledKeys(fetch)).toEqual(['GET /sanctum/csrf-cookie', 'POST /api/auth/login'])
    const init = fetch.mock.calls[1]?.[1] ?? {}
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('abc=123')
    expect(init.credentials).toBe('same-origin')
  })

  it('refreshes CSRF before logout too', async () => {
    const fetch = mockApi({ 'GET /sanctum/csrf-cookie': csrfOk, 'POST /api/auth/logout': () => json(null, 204) })
    await logout()
    expect(calledKeys(fetch)).toEqual(['GET /sanctum/csrf-cookie', 'POST /api/auth/logout'])
  })

  it.each([
    ['/account', '/account'],
    ['/rfqs?x=1', '/rfqs?x=1'],
    ['//evil.example', null],
    ['https://evil.example', null],
    ['/\\evil.example', null],
    ['', null],
    [null, null],
  ])('safeNextPath(%s) → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected)
  })
})
