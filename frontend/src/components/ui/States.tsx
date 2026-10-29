import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './States.module.css'

type EmptyStateProps = {
  title: string
  description?: string
  icon?: IconName
  tone?: 'neutral' | 'danger'
  action?: ReactNode
}

/** Empty and error states share one layout; errors are announced to screen readers. */
export function EmptyState({ title, description, icon = 'box', tone = 'neutral', action }: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${styles[tone]}`} role={tone === 'danger' ? 'alert' : undefined}>
      <span className={styles.emptyIcon}>
        <Icon name={icon} size={28} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {description && <p className={styles.emptyText}>{description}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  )
}

/** Loading placeholder. Wrap groups in an element with aria-busy and a visually-hidden label. */
export function Skeleton({ width = '100%', height = '1rem' }: { width?: string; height?: string }) {
  return <span className={styles.skeleton} style={{ inlineSize: width, blockSize: height }} aria-hidden="true" />
}

export function SkeletonCard() {
  return (
    <div className={styles.skeletonCard} aria-busy="true">
      <span className="visually-hidden">جارٍ التحميل…</span>
      <Skeleton width="40%" height="1.25rem" />
      <Skeleton width="90%" />
      <Skeleton width="70%" />
      <div className={styles.skeletonRow}>
        <Skeleton width="5rem" height="1.5rem" />
        <Skeleton width="7rem" height="1.5rem" />
      </div>
    </div>
  )
}
