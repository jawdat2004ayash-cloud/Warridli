import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, TextArea } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { ApiError } from '../../lib/api'
import styles from '../../pages/admin/Admin.module.css'

type ConfirmActionProps = {
  /** Text of the button that opens the confirmation. */
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  /** What will happen, in one or two plain sentences. */
  question: string
  confirmLabel: string
  /** `required`: reject / suspend — the affected party deserves an explanation (stored in the audit trail). */
  reason?: 'required' | 'optional' | 'none'
  reasonLabel?: string
  reasonHint?: string
  /** Resolve on success (the panel closes); throw an ApiError to keep it open with the message. */
  onConfirm: (reason: string | undefined) => Promise<unknown>
}

const MIN_REASON = 5

/**
 * Inline "are you sure?" step for every sensitive admin action — same pattern as the buyer's cancel/close
 * (no modal, works the same on phones). Focus moves into the panel; Escape or «تراجع» returns to the button.
 */
export function ConfirmAction({
  label,
  variant = 'secondary',
  question,
  confirmLabel,
  reason = 'none',
  reasonLabel = 'السبب',
  reasonHint,
  onConfirm,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLFieldSetElement>(null)
  const questionId = useId()

  useEffect(() => {
    if (!open) return
    const target = panelRef.current?.querySelector<HTMLElement>('textarea, [data-confirm]')
    target?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setText('')
    setFieldError(undefined)
    setError(undefined)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const submit = async () => {
    const trimmed = text.trim()
    if (reason === 'required' && trimmed.length < MIN_REASON) {
      setFieldError(`اكتب السبب بوضوح (${MIN_REASON} أحرف على الأقل). سيُحفظ في سجل العمليات.`)
      panelRef.current?.querySelector('textarea')?.focus()
      return
    }
    setPending(true)
    setError(undefined)
    try {
      await onConfirm(trimmed === '' ? undefined : trimmed)
      setOpen(false)
      setText('')
    } catch (e) {
      const apiError = e instanceof ApiError ? e : null
      const reasonError = apiError?.errors.reason?.[0]
      if (reasonError) setFieldError(reasonError)
      else setError(apiError?.message ?? 'حدث خطأ غير متوقع. أعد المحاولة.')
    } finally {
      setPending(false)
    }
  }

  // Escape inside the panel = «تراجع» (listener on the element: the fieldset itself is not interactive).
  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) close()
    }
    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  })

  if (!open) {
    return (
      <Button ref={triggerRef} variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  }

  return (
    <fieldset ref={panelRef} className={styles.confirm} aria-labelledby={questionId}>
      <p id={questionId} className={styles.confirmText}>
        {question}
      </p>
      {reason !== 'none' && (
        <Field label={reasonLabel} hint={reasonHint} error={fieldError} required={reason === 'required'} optional={reason === 'optional'}>
          {(control) => (
            <TextArea
              {...control}
              rows={2}
              maxLength={500}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setFieldError(undefined)
              }}
            />
          )}
        </Field>
      )}
      {error && <Notice tone="danger" title={error} focusOnMount />}
      <div className={styles.confirmActions}>
        <Button data-confirm variant={variant === 'danger' ? 'danger' : 'primary'} loading={pending} onClick={() => void submit()}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={close} disabled={pending}>
          تراجع
        </Button>
      </div>
    </fieldset>
  )
}
