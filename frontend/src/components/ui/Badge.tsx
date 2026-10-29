import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'signal'

export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}

/** RFQ lifecycle (docs/ERD.md). Labels are the single source of truth for status wording. */
export type RfqStatus = 'pending_review' | 'open' | 'closed' | 'cancelled' | 'expired' | 'rejected'

const RFQ_STATUS: Record<RfqStatus, { label: string; tone: Tone }> = {
  pending_review: { label: 'قيد التصنيف', tone: 'warn' },
  open: { label: 'مفتوح للعروض', tone: 'info' },
  closed: { label: 'مُغلق', tone: 'ok' },
  cancelled: { label: 'مُلغى', tone: 'muted' },
  expired: { label: 'منتهي', tone: 'muted' },
  rejected: { label: 'مرفوض', tone: 'danger' },
}

export function RfqStatusBadge({ status }: { status: RfqStatus }) {
  const { label, tone } = RFQ_STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}

export type Urgency = 'normal' | 'urgent' | 'line_stopped'

/** "Line stopped" is the only place the hazard stripe is used. */
export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  if (urgency === 'normal') return <Badge tone="muted">عادي</Badge>
  if (urgency === 'urgent') return <Badge tone="signal">مستعجل</Badge>
  return (
    <span className={styles.hazard}>
      <span className={styles.hazardStripe} aria-hidden="true" />
      الخط متوقف
    </span>
  )
}
