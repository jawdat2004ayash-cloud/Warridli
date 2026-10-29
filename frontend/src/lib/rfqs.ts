import type { RfqStatus, Urgency } from '../components/ui/Badge'
import { apiFetch, ensureCsrfCookie } from './api'
import type { Area } from './auth'
import type { Currency } from './format'
import type { Fulfillment, QuoteCondition, StockStatus } from './supplier'

/** Mirrors backend `RfqResource` / `CategoryResource` (docs/API.md). */
export type Category = { id: number; slug: string; name: string }

export type Unit = 'piece' | 'set' | 'meter'

export const UNIT_LABELS: Record<Unit, string> = {
  piece: 'قطعة',
  set: 'طقم',
  meter: 'متر',
}

export const URGENCY_OPTIONS: { value: Urgency; label: string; hint: string }[] = [
  { value: 'normal', label: 'عادي', hint: 'أحتاجها خلال أيام.' },
  { value: 'urgent', label: 'مستعجل', hint: 'أحتاجها اليوم أو غداً.' },
  { value: 'line_stopped', label: 'الخط متوقف', hint: 'الآلة أو خط الإنتاج واقف بسببها الآن.' },
]

export type RfqPhoto = { id: number; url: string; width: number; height: number }

export type Rfq = {
  id: string
  status: RfqStatus
  /** False once the answer window passed, even before the scheduler marks it expired. */
  accepts_quotes: boolean
  selected_quote_id: number | null
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
  /** Submitted (not withdrawn) supplier quotes. */
  quotes_count: number
  /** Only in the detail response. */
  photos?: RfqPhoto[]
}

export type Page<T> = {
  data: T[]
  meta: { current_page: number; last_page: number; total: number; per_page: number }
}

/** The literal the API expects when the buyer doesn't know the category (→ admin review). */
export const UNKNOWN_CATEGORY = 'unknown'

export type NewRfqInput = {
  description: string
  part_number?: string
  machine_make?: string
  machine_model?: string
  quantity: number
  unit: Unit
  urgency: Urgency
  area_id: number
  category: string
  photos: File[]
}

type Wrapped<T> = { data: T }

export const getCategories = async (signal?: AbortSignal) =>
  (await apiFetch<Wrapped<Category[]>>('/api/categories', { signal })).data

export const listRfqs = (page: number, signal?: AbortSignal) => apiFetch<Page<Rfq>>(`/api/rfqs?page=${page}`, { signal })

export const getRfq = async (id: string, signal?: AbortSignal) =>
  (await apiFetch<Wrapped<Rfq>>(`/api/rfqs/${encodeURIComponent(id)}`, { signal })).data

export async function createRfq(input: NewRfqInput): Promise<Rfq> {
  const form = new FormData()
  form.append('description', input.description)
  if (input.part_number) form.append('part_number', input.part_number)
  if (input.machine_make) form.append('machine_make', input.machine_make)
  if (input.machine_model) form.append('machine_model', input.machine_model)
  form.append('quantity', String(input.quantity))
  form.append('unit', input.unit)
  form.append('urgency', input.urgency)
  form.append('area_id', String(input.area_id))
  form.append('category', input.category)
  input.photos.forEach((photo) => form.append('photos[]', photo, photo.name))

  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<Rfq>>('/api/rfqs', { method: 'POST', body: form })).data
}

/** A supplier's quote as the buyer compares it (backend `BuyerQuoteResource`). No phone: see revealContact. */
export type BuyerQuote = {
  id: number
  supplier: { name: string; area: Area }
  unit_price: string
  currency: Currency
  condition: QuoteCondition
  brand: string | null
  origin: string | null
  stock_status: StockStatus
  lead_time_days: number
  fulfillment: Fulfillment
  valid_until: string
  price_expired: boolean
  notes: string | null
  updated_at: string
  selected: boolean
}

export type SupplierContact = { phone: string; whatsapp_url: string }

/** The buyer's point of view (the supplier form uses its own wording). */
export const BUYER_FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  pickup: 'تستلمها من محل المورّد',
  supplier_delivery: 'يوصلها المورّد إليك',
  either: 'استلام من المحل أو توصيل',
}

/** The buyer may choose a quote or close while open, and after the answer window passed (D34). */
export const isClosable = (rfq: Pick<Rfq, 'status'>) => rfq.status === 'open' || rfq.status === 'expired'

export const getQuotes = async (id: string, signal?: AbortSignal) =>
  (await apiFetch<Wrapped<BuyerQuote[]>>(`/api/rfqs/${encodeURIComponent(id)}/quotes`, { signal })).data

export async function selectQuote(id: string, quote: Pick<BuyerQuote, 'id' | 'updated_at'>): Promise<Rfq> {
  await ensureCsrfCookie()
  return (
    await apiFetch<Wrapped<Rfq>>(`/api/rfqs/${encodeURIComponent(id)}/quotes/${quote.id}/select`, {
      method: 'POST',
      body: { seen_updated_at: quote.updated_at },
    })
  ).data
}

export async function closeRfq(id: string): Promise<Rfq> {
  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<Rfq>>(`/api/rfqs/${encodeURIComponent(id)}/close`, { method: 'POST' })).data
}

export async function revealContact(id: string, quoteId: number): Promise<SupplierContact> {
  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<SupplierContact>>(`/api/rfqs/${encodeURIComponent(id)}/quotes/${quoteId}/contact`, { method: 'POST' })).data
}

export async function cancelRfq(id: string): Promise<Rfq> {
  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<Rfq>>(`/api/rfqs/${encodeURIComponent(id)}/cancel`, { method: 'POST' })).data
}
