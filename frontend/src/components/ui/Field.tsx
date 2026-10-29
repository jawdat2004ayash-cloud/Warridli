import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import styles from './Field.module.css'

export type ControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-required'?: true
}

type FieldProps = {
  /** Stable id for the control, e.g. so an error summary can link to it. Generated if omitted. */
  id?: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  optional?: boolean
  children: (control: ControlProps) => ReactNode
}

/**
 * Label + control + hint/error, with ids wired for screen readers.
 * The control is a render prop so any input type gets the same accessible wiring.
 */
export function Field({ id: fixedId, label, hint, error, required, optional, children }: FieldProps) {
  const generatedId = useId()
  const id = fixedId ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={styles.field} data-invalid={error ? '' : undefined}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
        {optional && <span className={styles.optional}> (اختياري)</span>}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[styles.control, props.className].filter(Boolean).join(' ')} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={[styles.control, styles.textarea, props.className].filter(Boolean).join(' ')} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={[styles.control, styles.select, props.className].filter(Boolean).join(' ')} />
}
