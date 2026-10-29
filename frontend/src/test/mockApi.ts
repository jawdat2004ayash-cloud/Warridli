import { vi } from 'vitest'

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

export const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * Stubs global fetch with handlers keyed by "METHOD /path". Unmatched requests fail the test loudly.
 * Returns the mock so tests can assert call order (e.g. CSRF cookie before login).
 */
export function mockApi(handlers: Record<string, Handler>) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${path}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

export const calledKeys = (fetch: ReturnType<typeof mockApi>) =>
  fetch.mock.calls.map(([input, init]) => `${(init?.method ?? 'GET').toUpperCase()} ${String(input)}`)

export const csrfOk = () => new Response(null, { status: 204 })
