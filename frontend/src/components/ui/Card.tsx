import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Card.module.css'

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div'
  title?: ReactNode
  meta?: ReactNode
  footer?: ReactNode
}

export function Card({ as: Tag = 'article', title, meta, footer, className, children, ...rest }: CardProps) {
  return (
    <Tag className={[styles.card, className].filter(Boolean).join(' ')} {...rest}>
      {(title || meta) && (
        <header className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {meta && <div className={styles.meta}>{meta}</div>}
        </header>
      )}
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </Tag>
  )
}

/**
 * Part number shown like a stamped inventory tag. Always LTR-isolated so "6205-2RS"
 * never gets reordered by the bidi algorithm inside Arabic text.
 */
export function PartTag({ value, label = 'رقم القطعة' }: { value: string; label?: string }) {
  return (
    <span className={styles.tag}>
      <span className={styles.tagLabel}>{label}</span>
      <bdi dir="ltr" className={styles.tagValue}>
        {value}
      </bdi>
    </span>
  )
}
