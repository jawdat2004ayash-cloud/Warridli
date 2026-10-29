import { useEffect, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './Notice.module.css'

type Tone = 'ok' | 'info' | 'warn' | 'danger'

const ICONS: Record<Tone, IconName> = { ok: 'check', info: 'clock', warn: 'clock', danger: 'alert' }

type NoticeProps = {
  tone?: Tone
  title: string
  children?: ReactNode
  /** Errors interrupt (alert); everything else is announced politely (status). */
  role?: 'alert' | 'status'
  /** Move keyboard/screen-reader focus here when shown (e.g. a failed submit). */
  focusOnMount?: boolean
}

/**
 * Inline, persistent message inside the page flow — for outcomes the user must not miss
 * (account created, wrong password, account under review). Toasts are for transient feedback.
 */
export function Notice({ tone = 'info', title, children, role = tone === 'danger' ? 'alert' : 'status', focusOnMount }: NoticeProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusOnMount) ref.current?.focus()
  }, [focusOnMount])

  return (
    <div ref={ref} className={`${styles.notice} ${styles[tone]}`} role={role} tabIndex={-1}>
      <Icon name={ICONS[tone]} className={styles.icon} />
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.text}>{children}</div>}
      </div>
    </div>
  )
}
