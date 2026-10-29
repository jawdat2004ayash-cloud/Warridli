import { apiFetch, ensureCsrfCookie } from './api'
import type { Page } from './rfqs'

/** Mirrors backend `NotificationResource` / `App\Enums\NotificationKind` (docs/API.md, D39). */
export type NotificationKind =
  | 'supplier_approved'
  | 'supplier_rejected'
  | 'specialty_approved'
  | 'specialty_rejected'
  | 'rfq_matched'
  | 'quote_selected'
  | 'quote_received'
  | 'rfq_triaged'
  | 'rfq_rejected'

export type AppNotification = {
  id: string
  kind: NotificationKind | string
  data: { rfq_id?: string; description?: string; category?: string | null }
  read: boolean
  created_at: string
}

export type NotificationPage = Page<AppNotification> & { meta: Page<AppNotification>['meta'] & { unread: number } }

type Wrapped<T> = { data: T }

export const listNotifications = (page: number, signal?: AbortSignal) =>
  apiFetch<NotificationPage>(`/api/notifications${page > 1 ? `?page=${page}` : ''}`, { signal })

export const getUnreadCount = async (signal?: AbortSignal) =>
  (await apiFetch<Wrapped<{ unread: number }>>('/api/notifications/unread-count', { signal })).data.unread

export async function markNotificationRead(id: string): Promise<AppNotification> {
  await ensureCsrfCookie()
  return (await apiFetch<Wrapped<AppNotification>>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })).data
}

export async function markAllNotificationsRead(): Promise<void> {
  await ensureCsrfCookie()
  await apiFetch('/api/notifications/read-all', { method: 'POST' })
}

export type NotificationText = { title: string; text?: string; link?: string }

/** The Arabic wording and destination of each kind. The server stores only kind + ids/short texts. */
export function describeNotification(n: AppNotification): NotificationText {
  const { rfq_id: rfq, description, category } = n.data
  const quoted = category ? `«${category}»` : ''
  switch (n.kind) {
    case 'supplier_approved':
      return { title: 'تمت الموافقة على حساب المورّد', text: 'تصلك الآن طلبات الأسعار في تخصصاتك المعتمدة.', link: '/supplier/rfqs' }
    case 'supplier_rejected':
      return { title: 'لم تتم الموافقة على حساب المورّد', text: 'تواصل مع إدارة ورّدلي لمعرفة التفاصيل.', link: '/account' }
    case 'specialty_approved':
      return { title: `اعتُمد تخصص ${quoted}`, text: 'ستصلك طلبات الأسعار في هذا التصنيف.', link: '/supplier/rfqs' }
    case 'specialty_rejected':
      return { title: `لم يُعتمد تخصص ${quoted}`, text: 'راجع تخصصاتك، ويمكنك طلبه مرة أخرى.', link: '/supplier/categories' }
    case 'rfq_matched':
      return { title: `طلب سعر جديد في ${quoted}`, text: description, link: rfq && `/supplier/rfqs/${rfq}` }
    case 'quote_selected':
      return { title: 'اختار المشتري عرضك', text: description, link: rfq && `/supplier/rfqs/${rfq}` }
    case 'quote_received':
      return { title: 'وصلك عرض سعر جديد', text: description, link: rfq && `/rfqs/${rfq}` }
    case 'rfq_triaged':
      return { title: `وصل طلبك إلى المورّدين في ${quoted}`, text: description, link: rfq && `/rfqs/${rfq}` }
    case 'rfq_rejected':
      return { title: 'لم يُقبل طلبك', text: description ? `${description} — تواصل مع إدارة ورّدلي إن كان طلب قطعة فعلاً.` : undefined, link: rfq && `/rfqs/${rfq}` }
    default:
      return { title: 'إشعار جديد' }
  }
}
