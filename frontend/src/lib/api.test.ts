import { describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, ensureCsrfCookie } from './api'

function mockFetch(response: Response | Error) {
  const fn = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function sentInit(fn: ReturnType<typeof mockFetch>): RequestInit {
  return fn.mock.calls[0]?.[1] ?? {}
}

function sentHeaders(fn: ReturnType<typeof mockFetch>): Record<string, string> {
  return sentInit(fn).headers as Record<string, string>
}

describe('apiFetch', () => {
  it('sends same-origin credentials and JSON headers, without XSRF on GET', async () => {
    document.cookie = 'XSRF-TOKEN=abc'
    const fetch = mockFetch(json({ ok: true }))

    await expect(apiFetch('/api/health')).resolves.toEqual({ ok: true })

    expect(sentInit(fetch).credentials).toBe('same-origin')
    expect(sentHeaders(fetch).Accept).toBe('application/json')
    expect(sentHeaders(fetch)['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('attaches the decoded XSRF-TOKEN cookie on state-changing requests', async () => {
    document.cookie = `XSRF-TOKEN=${encodeURIComponent('tok=en/1')}`
    const fetch = mockFetch(json({}, 201))

    await apiFetch('/api/rfqs', { method: 'POST', body: { a: 1 } })

    expect(sentHeaders(fetch)['X-XSRF-TOKEN']).toBe('tok=en/1')
    expect(sentHeaders(fetch)['Content-Type']).toBe('application/json')
  })

  it('lets the browser set the multipart boundary for FormData', async () => {
    const fetch = mockFetch(json({}, 201))

    await apiFetch('/api/rfqs', { method: 'POST', body: new FormData() })

    expect(sentHeaders(fetch)['Content-Type']).toBeUndefined()
  })

  it('exposes Laravel validation errors on 422', async () => {
    mockFetch(json({ message: 'The given data was invalid.', errors: { quantity: ['bad'] } }, 422))

    const error = await apiFetch('/api/rfqs', { method: 'POST', body: {} }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).isValidation).toBe(true)
    expect((error as ApiError).errors).toEqual({ quantity: ['bad'] })
    expect((error as ApiError).message).toBe('يرجى مراجعة الحقول المحدّدة.')
  })

  it('uses Arabic messages and never surfaces raw server text for other errors', async () => {
    mockFetch(json({ message: 'SQLSTATE[HY000] secret' }, 500))

    const error = (await apiFetch('/api/health').catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(500)
    expect(error.message).not.toContain('SQLSTATE')
  })

  it('shows our Arabic business-rule message for 409/403, but never English or other statuses (F11)', async () => {
    mockFetch(json({ message: 'انتهت صلاحية سعر هذا العرض.' }, 409))
    expect(((await apiFetch('/api/x').catch((e: unknown) => e)) as ApiError).message).toBe('انتهت صلاحية سعر هذا العرض.')

    mockFetch(json({ message: 'Integrity constraint violation' }, 409))
    expect(((await apiFetch('/api/x').catch((e: unknown) => e)) as ApiError).message).toBe('تغيّرت حالة هذا العنصر. حدّث الصفحة ثم حاول مرة أخرى.')

    mockFetch(json({ message: 'رسالة عربية من خطأ داخلي' }, 500))
    expect(((await apiFetch('/api/x').catch((e: unknown) => e)) as ApiError).message).toBe('حدث خطأ في الخادم. أعد المحاولة لاحقاً.')
  })

  it('maps network failures to status 0', async () => {
    mockFetch(new TypeError('Failed to fetch'))

    const error = (await apiFetch('/api/health').catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(0)
  })

  it('returns undefined for 204', async () => {
    mockFetch(new Response(null, { status: 204 }))

    await expect(apiFetch('/api/x', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

describe('ensureCsrfCookie', () => {
  it('requests the Sanctum CSRF cookie same-origin', async () => {
    const fetch = mockFetch(new Response(null, { status: 204 }))

    await ensureCsrfCookie()

    expect(fetch.mock.calls[0]?.[0]).toBe('/sanctum/csrf-cookie')
  })
})
