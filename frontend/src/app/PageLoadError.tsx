import { useEffect, useRef } from 'react'
import { Button } from '../components/ui/Button'
import styles from './AppLayout.module.css'

/** A failed route chunk needs a full retry; never show raw import errors or private record data. */
export function PageLoadError() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    document.title = 'تعذّر تحميل الصفحة — ورّدلي'
    ref.current?.focus()
  }, [])
  return (
    <main ref={ref} id="main" className={styles.main} tabIndex={-1} aria-labelledby="page-load-title">
      <h1 id="page-load-title">تعذّر تحميل الصفحة</h1>
      <p>تحقّق من الاتصال ثم أعد تحميل الصفحة للمحاولة من جديد.</p>
      <Button onClick={() => window.location.reload()}>أعد تحميل الصفحة</Button>
    </main>
  )
}
