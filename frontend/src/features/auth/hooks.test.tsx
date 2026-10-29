import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { Me, RegisterInput } from '../../lib/auth'
import { csrfOk, json, mockApi } from '../../test/mockApi'
import { meQueryKey, useLogin, useRegister } from './hooks'

const nextUser: Me = { id: 2, name: 'مستخدم آخر', email: 'next@example.test', is_admin: false, company: null }

describe('session identity changes', () => {
  it.each(['login', 'register'] as const)('clears an expired session\'s private data and pending requests on %s', async (operation) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // The old session expired without a successful logout, so its company-scoped query keys still exist.
    client.setQueryData(meQueryKey, null)
    client.setQueryData(['notifications', 'page', 1], ['previous account private notification'])
    client.setQueryData(['rfqs'], ['previous company private request'])
    let oldSignal: AbortSignal | undefined
    const pending = client.fetchQuery({
      queryKey: ['rfqs', 'old-request'],
      queryFn: ({ signal }) => {
        oldSignal = signal
        return new Promise<string>(() => {})
      },
    }).catch(() => undefined)
    mockApi({
      'GET /sanctum/csrf-cookie': csrfOk,
      [`POST /api/auth/${operation}`]: () => json({ data: nextUser }),
    })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => ({ login: useLogin(), register: useRegister() }), { wrapper })

    await act(async () => {
      if (operation === 'login') await result.current.login.mutateAsync({ email: nextUser.email, password: 'test-only-password1' })
      else await result.current.register.mutateAsync({ email: nextUser.email } as RegisterInput)
    })

    expect(client.getQueryData(meQueryKey)).toEqual(nextUser)
    expect(client.getQueryData(['notifications', 'page', 1])).toBeUndefined()
    expect(client.getQueryData(['rfqs'])).toBeUndefined()
    expect(oldSignal?.aborted).toBe(true)
    await pending
    client.clear()
  })
})
