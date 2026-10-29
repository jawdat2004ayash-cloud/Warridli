import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import styles from './ConfirmationPanel.module.css'

/** Inline (not modal): read the question first, Tab normally, Escape to cancel, restore the trigger on return. */
export function ConfirmationPanel({ children, labelledBy, className, pending, onCancel, returnFocus }: {
  children: ReactNode
  labelledBy: string
  className?: string
  pending: boolean
  onCancel: () => void
  returnFocus: RefObject<HTMLButtonElement | null>
}) {
  const panelRef = useRef<HTMLFieldSetElement>(null)
  const restoreFocus = useCallback(() => {
    // Read the current trigger after React has reinserted it, rather than retaining the removed node.
    if (document.activeElement === document.body) returnFocus.current?.focus()
  }, [returnFocus])
  useEffect(() => {
    panelRef.current?.focus()
    return () => {
      requestAnimationFrame(restoreFocus)
    }
  }, [restoreFocus])

  useEffect(() => {
    const panel = panelRef.current
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        event.stopPropagation()
        onCancel()
      }
    }
    panel?.addEventListener('keydown', onKeyDown)
    return () => panel?.removeEventListener('keydown', onKeyDown)
  }, [onCancel, pending])

  return <fieldset ref={panelRef} aria-labelledby={labelledBy} aria-busy={pending || undefined} tabIndex={-1} className={`${styles.panel} ${className ?? ''}`}>{children}</fieldset>
}
