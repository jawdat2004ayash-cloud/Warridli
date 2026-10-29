import { ApiError, apiFetch, ensureCsrfCookie } from './api'

/** Mirrors backend `MeResource` (docs/API.md). */
export type CompanyType = 'buyer' | 'supplier'
export type CompanyStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export type Area = { id: number; name: string }

export type Me = {
  id: number
  name: string
  email: string
  is_admin: boolean
  company: null | {
    id: number
    type: CompanyType
    name: string
    whatsapp_phone: string
    area: Area
    address_text: string | null
    status: CompanyStatus
    role: 'owner' | 'member'
  }
}

export type RegisterInput = {
  name: string
  email: string
  password: string
  password_confirmation: string
  account_type: CompanyType
  company_name: string
  whatsapp_phone: string
  area_id: number
  address_text?: string
}

type Wrapped<T> = { data: T }

/**
 * Every state-changing auth call first refreshes the XSRF-TOKEN cookie, so a stale
 * token (e.g. after the session expired or after logout) never surfaces as a 419.
 */
async function withCsrf<T>(call: () => Promise<T>): Promise<T> {
  await ensureCsrfCookie()
  return call()
}

/** The current user, or null for guests (401 is an expected answer here, not an error). */
export async function getMe(signal?: AbortSignal): Promise<Me | null> {
  try {
    return (await apiFetch<Wrapped<Me>>('/api/me', { signal })).data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export const login = (email: string, password: string) =>
  withCsrf(async () => (await apiFetch<Wrapped<Me>>('/api/auth/login', { method: 'POST', body: { email, password } })).data)

export const register = (input: RegisterInput) =>
  withCsrf(async () => (await apiFetch<Wrapped<Me>>('/api/auth/register', { method: 'POST', body: input })).data)

export const logout = () => withCsrf(() => apiFetch<void>('/api/auth/logout', { method: 'POST' }))

export const requestPasswordReset = (email: string) =>
  withCsrf(() => apiFetch<unknown>('/api/auth/forgot-password', { method: 'POST', body: { email } }))

export const resetPassword = (input: { token: string; email: string; password: string; password_confirmation: string }) =>
  withCsrf(() => apiFetch<unknown>('/api/auth/reset-password', { method: 'POST', body: input }))

export const getAreas = async (signal?: AbortSignal) => (await apiFetch<Wrapped<Area[]>>('/api/areas', { signal })).data

/** Only same-app paths are allowed as a post-login destination (prevents open redirects). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null
  return next
}
