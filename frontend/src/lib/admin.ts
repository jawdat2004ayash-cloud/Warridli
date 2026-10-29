import type { RfqStatus, Urgency } from '../components/ui/Badge'
import { apiFetch, ensureCsrfCookie } from './api'
import type { Area, CompanyStatus, CompanyType } from './auth'
import type { Category, Page, RfqPhoto, Unit } from './rfqs'

/** Mirrors backend `AdminCompanyResource`, `AdminRfqResource`, `AdminCategoryResource`, `AuditLogResource` (docs/API.md). */
export type AdminMember = { user_id: number; name: string; email: string; role: 'owner' | 'member'; suspended: boolean }
export type AdminSpecialty = { id: number; name: string; status: 'pending' | 'approved' }

export type AdminCompany = {
  id: number
  type: CompanyType
  name: string
  whatsapp_phone: string
  area: Area
  address_text: string | null
  status: CompanyStatus
  verified_at: string | null
  created_at: string
  members: AdminMember[]
  categories: AdminSpecialty[]
}

export type CompanyTransition = 'approve' | 'reject' | 'suspend' | 'reactivate'

export type AdminRfq = {
  id: string
  status: RfqStatus
  category: Category | null
  description: string
  part_number: string | null
  machine_make: string | null
  machine_model: string | null
  quantity: number
  unit: Unit
  urgency: Urgency
  area: Area
  buyer: { company_id: number; name: string; whatsapp_phone: string }
  closes_at: string
  created_at: string
  triaged_at: string | null
  photos_count: number
  photos?: RfqPhoto[]
}

export type AdminCategory = {
  id: number
  slug: string
  name: string
  is_active: boolean
  sort: number
  rfqs_count: number
  open_rfqs_count: number
  suppliers_count: number
}

export type MetricsPeriod = '7' | '30' | '90' | 'all'

export type Metrics = {
  period_days: number | null
  since: string | null
  generated_at: string
  rfqs: {
    created: number
    by_status: Record<RfqStatus, number>
    published: number
    with_quote: number
    with_quote_rate: number | null
    with_selection: number
  }
  first_quote: { sample: number; median_minutes: number | null }
  triage: { sample: number; median_minutes: number | null }
  contacts: { reveals: number; rfqs: number }
  queue: { suppliers_pending: number; specialties_pending: number; rfqs_pending_review: number }
}

export type AuditEntry = {
  id: number
  action: string
  actor: null | { id: number; name: string; email: string; is_admin: boolean }
  subject: null | { type: string; id: number; label: string | null; ref: string | null }
  meta: Record<string, string | number | boolean | null> | null
  ip: string | null
  created_at: string
}

export type CompanyFilter = { status?: CompanyStatus; pending_categories?: boolean; q?: string; page: number }
export type AuditFilter = { group?: string; actor?: string; subject_type?: string; subject_id?: string; from?: string; to?: string; page: number }

type Wrapped<T> = { data: T }

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue
    search.set(key, value === true ? '1' : String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

async function post<T>(path: `/api/${string}`, body?: unknown, method: 'POST' | 'PATCH' = 'POST'): Promise<T> {
  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<T>>(path, { method, body })).data
}

export const listCompanies = (filter: CompanyFilter, signal?: AbortSignal) =>
  apiFetch<Page<AdminCompany>>(`/api/admin/companies${query(filter)}`, { signal })

export const transitionCompany = (id: number, transition: CompanyTransition, reason?: string) =>
  post<AdminCompany>(`/api/admin/companies/${id}/${transition}`, reason ? { reason } : {})

export const setUserSuspension = (userId: number, suspend: boolean, reason?: string) =>
  post<{ id: number; name: string; suspended: boolean }>(`/api/admin/users/${userId}/${suspend ? 'suspend' : 'reactivate'}`, reason ? { reason } : {})

export const reviewSpecialty = (companyId: number, categoryId: number, decision: 'approve' | 'reject', reason?: string) =>
  post<AdminCompany>(`/api/admin/supplier-categories/${companyId}/${categoryId}/${decision}`, reason ? { reason } : {})

export const listAdminRfqs = (status: RfqStatus, page: number, signal?: AbortSignal) =>
  apiFetch<Page<AdminRfq>>(`/api/admin/rfqs${query({ status, page: page > 1 ? page : undefined })}`, { signal })

export const getAdminRfq = async (id: string, signal?: AbortSignal) =>
  (await apiFetch<Wrapped<AdminRfq>>(`/api/admin/rfqs/${encodeURIComponent(id)}`, { signal })).data

export const triageRfq = (id: string, categoryId: number) =>
  post<AdminRfq>(`/api/admin/rfqs/${encodeURIComponent(id)}/triage`, { category_id: categoryId })

export const rejectRfq = (id: string, reason: string) => post<AdminRfq>(`/api/admin/rfqs/${encodeURIComponent(id)}/reject`, { reason })

export const listAdminCategories = async (signal?: AbortSignal) =>
  (await apiFetch<Wrapped<AdminCategory[]>>('/api/admin/categories', { signal })).data

export const createCategory = (input: { name_ar: string; sort?: number }) => post<AdminCategory>('/api/admin/categories', input)

export const updateCategory = (id: number, input: { name_ar?: string; sort?: number; is_active?: boolean }) =>
  post<AdminCategory>(`/api/admin/categories/${id}`, input, 'PATCH')

export const getMetrics = async (period: MetricsPeriod, signal?: AbortSignal) =>
  (await apiFetch<Wrapped<Metrics>>(`/api/admin/metrics?period=${period}`, { signal })).data

export const listAuditLogs = (filter: AuditFilter, signal?: AbortSignal) =>
  apiFetch<Page<AuditEntry>>(`/api/admin/audit-logs${query({ ...filter, page: filter.page > 1 ? filter.page : undefined })}`, { signal })

/** Arabic count agreement: 1 → one, 2 → dual, 3–10 → plural, 11+ → singular (تمييز). */
function counted(n: number, [one, two, few, many]: [string, string, string, string]): string {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${n} ${few}`
  return `${n} ${many}`
}

/** "45 دقيقة", "3 ساعات", "يومين" — rounded to the unit an operator thinks in. */
export function durationLabel(minutes: number): string {
  if (minutes < 1) return 'أقل من دقيقة'
  if (minutes < 60) return counted(Math.round(minutes), ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'])
  const hours = Math.round(minutes / 60)
  if (hours < 48) return counted(hours, ['ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة'])
  return counted(Math.round(minutes / 1440), ['يوم واحد', 'يومين', 'أيام', 'يوماً'])
}

export const suppliersLabel = (n: number) =>
  n === 0 ? 'لا يوجد مورّد معتمد' : counted(n, ['مورّد معتمد واحد', 'مورّدان معتمدان', 'مورّدين معتمدين', 'مورّداً معتمداً'])

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  pending: 'قيد المراجعة',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  suspended: 'موقوفة',
}

/** Audit actions in plain Arabic (D21). Unknown codes are shown as they are. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.registered': 'إنشاء حساب جديد',
  'auth.login': 'تسجيل دخول',
  'auth.logout': 'تسجيل خروج',
  'auth.password_reset_requested': 'طلب رابط استعادة كلمة المرور',
  'auth.password_reset': 'تغيير كلمة المرور عبر رابط الاستعادة',
  'admin.created': 'إنشاء حساب مدير',
  'company.approved': 'الموافقة على شركة',
  'company.rejected': 'رفض شركة',
  'company.suspended': 'إيقاف شركة',
  'company.reactivated': 'إعادة تفعيل شركة',
  'user.suspended': 'إيقاف مستخدم',
  'user.reactivated': 'إعادة تفعيل مستخدم',
  'supplier_category.requested': 'طلب تخصص من مورّد',
  'supplier_category.removed': 'إزالة تخصص من مورّد',
  'supplier_category.approved': 'اعتماد تخصص مورّد',
  'supplier_category.rejected': 'رفض تخصص مورّد',
  'category.created': 'إضافة تصنيف',
  'category.updated': 'تعديل تصنيف',
  'category.activated': 'تفعيل تصنيف',
  'category.deactivated': 'تعطيل تصنيف',
  'rfq.created': 'إرسال طلب سعر',
  'rfq.cancelled': 'إلغاء طلب من المشتري',
  'rfq.closed': 'إغلاق طلب دون اختيار',
  'rfq.expired': 'انتهاء مدة استقبال العروض',
  'rfq.quote_selected': 'اختيار عرض وإغلاق الطلب',
  'rfq.triaged': 'تصنيف طلب وإرساله للمورّدين',
  'rfq.rejected': 'رفض طلب',
  'quote.submitted': 'إرسال عرض سعر',
  'quote.updated': 'تعديل عرض سعر',
  'quote.resubmitted': 'إعادة إرسال عرض سعر',
  'quote.withdrawn': 'سحب عرض سعر',
}

export const AUDIT_GROUPS: { value: string; label: string }[] = [
  { value: 'company', label: 'الشركات (موافقة، رفض، إيقاف)' },
  { value: 'supplier_category', label: 'تخصصات المورّدين' },
  { value: 'user', label: 'المستخدمون (إيقاف وتفعيل)' },
  { value: 'rfq', label: 'طلبات الأسعار' },
  { value: 'quote', label: 'عروض الأسعار' },
  { value: 'category', label: 'التصنيفات' },
  { value: 'auth', label: 'الدخول والحسابات' },
  { value: 'admin', label: 'حسابات المدراء' },
]

export const META_LABELS: Record<string, string> = {
  reason: 'السبب',
  from: 'الحالة السابقة',
  to: 'الحالة الجديدة',
  was: 'الحالة السابقة',
  company_type: 'نوع الشركة',
  category_id: 'رقم التصنيف',
  name: 'الاسم',
  name_from: 'الاسم السابق',
  changed: 'الحقول المعدّلة',
  is_active: 'مفعّل',
  sort: 'الترتيب',
  status: 'الحالة',
  photos: 'عدد الصور',
  closes_at: 'آخر موعد للعروض',
  sessions_revoked: 'جلسات أُنهيت',
  quote_id: 'رقم العرض',
  rfq_id: 'رقم الطلب',
  unit_price: 'سعر الوحدة',
  currency: 'العملة',
  supplier_company_id: 'رقم شركة المورّد',
  source: 'المصدر',
}

/** Status codes that appear in meta values (from / to / was). */
export const META_VALUE_LABELS: Record<string, string> = {
  ...COMPANY_STATUS_LABELS,
  pending_review: 'قيد التصنيف',
  open: 'مفتوح للعروض',
  closed: 'مُغلق',
  cancelled: 'مُلغى',
  expired: 'منتهي',
  buyer: 'مشترٍ',
  supplier: 'مورّد',
  console: 'سطر الأوامر',
}
