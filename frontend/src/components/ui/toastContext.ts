import { createContext, useContext } from 'react'

export type ToastTone = 'ok' | 'danger' | 'info'
export type ToastInput = { title: string; description?: string; tone?: ToastTone }

export const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

export function useToast() {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast must be used inside <ToastProvider>')
  return notify
}
