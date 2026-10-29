import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { ToastContext, type ToastInput, type ToastTone } from './toastContext'
import styles from './Toast.module.css'

type ToastItem = ToastInput & { id: number; tone: ToastTone }

const DURATION_MS = 5000
const ICONS = { ok: 'check', danger: 'alert', info: 'clock' } as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { ...toast, id, tone: toast.tone ?? 'info' }])
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS))
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {/* Region stays mounted so screen readers pick up additions. */}
      <output className={styles.region} aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
            <Icon name={ICONS[toast.tone]} className={styles.icon} />
            <div className={styles.text}>
              <p className={styles.title}>{toast.title}</p>
              {toast.description && <p className={styles.description}>{toast.description}</p>}
            </div>
            <button type="button" className={styles.close} onClick={() => dismiss(toast.id)} aria-label="إغلاق التنبيه">
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </output>
    </ToastContext.Provider>
  )
}
