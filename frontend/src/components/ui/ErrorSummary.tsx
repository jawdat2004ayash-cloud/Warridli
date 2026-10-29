import { useEffect, useRef } from 'react'
import styles from './ErrorSummary.module.css'

export type SummaryItem = { fieldId?: string; message: string }

type ErrorSummaryProps = {
  items: SummaryItem[]
  /** Increment on every failed submit: focus moves here then, never while the user is typing. */
  focusKey: number
  title?: string
}

/**
 * Shown above a form after a failed submit. Takes focus so keyboard and screen-reader users
 * learn immediately what to fix; each item links to its field. Items shrink as fields are fixed.
 */
export function ErrorSummary({ items, focusKey, title = 'يرجى تصحيح ما يلي:' }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusKey > 0) ref.current?.focus()
  }, [focusKey])

  if (items.length === 0) return null

  return (
    <div ref={ref} className={styles.summary} role="alert" tabIndex={-1} aria-labelledby="error-summary-title">
      <p id="error-summary-title" className={styles.title}>
        {title}
      </p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={`${item.fieldId ?? ''}${item.message}`}>
            {item.fieldId ? (
              <a
                href={`#${item.fieldId}`}
                onClick={(event) => {
                  event.preventDefault()
                  document.getElementById(item.fieldId!)?.focus()
                }}
              >
                {item.message}
              </a>
            ) : (
              item.message
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
