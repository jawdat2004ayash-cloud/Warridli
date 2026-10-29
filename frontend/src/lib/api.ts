/**
 * Thin client for the Laravel API. Same-origin only (Vite proxy in dev, same domain in prod),
 * cookie-based Sanctum session: no tokens are stored in JS-readable storage.
 */

export type ValidationErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly errors: ValidationErrors

  constructor(status: number, message: string, errors: ValidationErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  get isValidation(): boolean {
    return this.status === 422
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  0: 'تعذّر الاتصال بالخادم. تحقّق من الشبكة ثم أعد المحاولة.',
  401: 'يرجى تسجيل الدخول للمتابعة.',
  403: 'لا تملك صلاحية تنفيذ هذا الإجراء.',
  404: 'العنصر المطلوب غير موجود.',
  409: 'تغيّرت حالة هذا العنصر. حدّث الصفحة ثم حاول مرة أخرى.',
  419: 'انتهت صلاحية الجلسة. حدّث الصفحة وأعد المحاولة.',
  422: 'يرجى مراجعة الحقول المحدّدة.',
  429: 'محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.',
}

export function messageForStatus(status: number): string {
  return STATUS_MESSAGES[status] ?? 'حدث خطأ في الخادم. أعد المحاولة لاحقاً.'
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Must be called once before the first state-changing request (login, register, …). */
export async function ensureCsrfCookie(): Promise<void> {
  const response = await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' })
  if (!response.ok) throw new ApiError(response.status, messageForStatus(response.status))
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function apiFetch<T>(path: `/api/${string}`, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body // browser sets the multipart boundary
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  if (!SAFE_METHODS.has(method)) {
    const xsrf = readCookie('XSRF-TOKEN')
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf
  }

  let response: Response
  try {
    response = await fetch(path, { method, headers, body, credentials: 'same-origin', signal: options.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, messageForStatus(0))
  }

  if (response.status === 204) return undefined as T

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errors =
      response.status === 422 && isRecord(payload) && isRecord(payload.errors)
        ? (payload.errors as ValidationErrors)
        : {}
    throw new ApiError(response.status, businessMessage(response.status, payload) ?? messageForStatus(response.status), errors)
  }

  return payload as T
}

/**
 * F11: 403/409 bodies carry business-rule explanations written by us in Arabic (D20), e.g. "this quote's price
 * expired" — show those. Anything else (English framework text, HTML, other statuses) keeps the generic message.
 */
function businessMessage(status: number, payload: unknown): string | null {
  if (status !== 403 && status !== 409) return null
  const message = isRecord(payload) ? payload.message : null
  return typeof message === 'string' && /[؀-ۿ]/.test(message) && message.length <= 300 ? message : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export type HealthResponse = { status: 'ok' | 'degraded'; database: 'ok' | 'unavailable' }

export const getHealth = (signal?: AbortSignal) => apiFetch<HealthResponse>('/api/health', { signal })
