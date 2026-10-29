import type { RfqStatus, Urgency } from '../components/ui/Badge'
import { apiFetch, ensureCsrfCookie } from './api'
import type { Area } from './auth'
import type { Currency } from './format'
import type { Category, Page, RfqPhoto, Unit } from './rfqs'

/** Mirrors backend `SupplierRfqResource`, `QuoteResource`, `SupplierCategoryResource` (docs/API.md). */
export type QuoteCondition = 'new' | 'used' | 'refurbished'
export type StockStatus = 'in_stock' | 'on_order'
export type Fulfillment = 'pickup' | 'supplier_delivery' | 'either'

export type Quote = {
  status: 'submitted' | 'withdrawn'
  /** Decimal string from the server, e.g. "125000.50" — never parsed into the request. */
  unit_price: string
  currency: Currency
  condition: QuoteCondition
  brand: string | null
  origin: string | null
  stock_status: StockStatus
  lead_time_days: number
  fulfillment: Fulfillment
  valid_until: string
  notes: string | null
  updated_at: string
  /** The buyer chose this quote (the RFQ is then closed). */
  selected: boolean
}

/** No buyer identity on purpose (D4). */
export type SupplierRfq = {
  id: string
  status: RfqStatus
  accepts_quotes: boolean
  category: Category | null
  description: string
  part_number: string | null
  machine_make: string | null
  machine_model: string | null
  quantity: number
  unit: Unit
  urgency: Urgency
  area: Area
  closes_at: string
  created_at: string
  photos_count: number
  photos?: RfqPhoto[]
  my_quote: Quote | null
}

export type SpecialtyStatus = 'pending' | 'approved' | null
export type Specialty = { id: number; name: string; status: SpecialtyStatus }

export type QuoteInput = {
  unit_price: string
  currency: Currency
  condition: QuoteCondition
  brand?: string
  origin?: string
  stock_status: StockStatus
  lead_time_days?: number
  fulfillment: Fulfillment
  valid_until: string
  notes?: string
}

export type InboxTab = 'new' | 'quoted'

export const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'SYP', label: 'ليرة سورية' },
  { value: 'USD', label: 'دولار' },
]

/** "يوم واحد / يومان / 3 أيام / 11 يوماً" — Arabic number agreement for lead times. */
export function daysLabel(n: number): string {
  if (n === 1) return 'يوم واحد'
  if (n === 2) return 'يومين'
  if (n >= 3 && n <= 10) return `${n} أيام`
  return `${n} يوماً`
}

export const CONDITION_LABELS: Record<QuoteCondition, { label: string; hint: string }> = {
  new: { label: 'جديدة', hint: 'لم تُستعمل من قبل.' },
  used: { label: 'مستعملة', hint: 'مفكوكة من آلة وتعمل.' },
  refurbished: { label: 'مجدّدة', hint: 'مستعملة وأُعيد إصلاحها.' },
}

export const STOCK_LABELS: Record<StockStatus, { label: string; hint: string }> = {
  in_stock: { label: 'متوفرة عندي الآن', hint: 'جاهزة للاستلام.' },
  on_order: { label: 'أحتاج وقتاً لتأمينها', hint: 'أطلبها أو أجلبها خلال أيام.' },
}

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  pickup: 'يستلمها المشتري من محلي',
  supplier_delivery: 'أوصلها أنا للمشتري',
  either: 'الاثنان ممكنان',
}

export const MAX_VALID_DAYS = 60

/** YYYY-MM-DD as seen in Damascus (D6b), optionally shifted by whole days. */
export function damascusDate(addDays = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + addDays)
  return date.toISOString().slice(0, 10)
}
type Wrapped<T> = { data: T }

export const listInbox = (tab: InboxTab, page: number, signal?: AbortSignal) =>
  apiFetch<Page<SupplierRfq>>(`/api/supplier/rfqs?tab=${tab}&page=${page}`, { signal })

export const getSupplierRfq = async (id: string, signal?: AbortSignal) =>
  (await apiFetch<Wrapped<SupplierRfq>>(`/api/supplier/rfqs/${encodeURIComponent(id)}`, { signal })).data

export async function saveQuote(id: string, input: QuoteInput): Promise<SupplierRfq> {
  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<SupplierRfq>>(`/api/supplier/rfqs/${encodeURIComponent(id)}/quote`, { method: 'PUT', body: input })).data
}

export async function withdrawQuote(id: string): Promise<SupplierRfq> {
  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<SupplierRfq>>(`/api/supplier/rfqs/${encodeURIComponent(id)}/quote/withdraw`, { method: 'POST' })).data
}

export const getSpecialties = async (signal?: AbortSignal) =>
  (await apiFetch<Wrapped<Specialty[]>>('/api/supplier/categories', { signal })).data

export async function saveSpecialties(categoryIds: number[]): Promise<Specialty[]> {
  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<Specialty[]>>('/api/supplier/categories', { method: 'PUT', body: { category_ids: categoryIds } })).data
}

/**
 * Normalizes what a trader types as a price: Arabic-Indic digits, thousands separators (, ٬ space),
 * Arabic decimal separator (٫). Returns null if it isn't a plain positive number with ≤ 2 decimals.
 */
export function normalizePrice(input: string): string | null {
  const latin = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/[,٬\s]/g, '')
  return /^\d+(\.\d{1,2})?$/.test(latin) ? latin : null
}
