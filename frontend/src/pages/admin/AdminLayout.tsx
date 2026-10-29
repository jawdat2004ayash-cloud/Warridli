import { NavLink, Outlet } from 'react-router'
import { useMetrics } from '../../features/admin/hooks'
import { formatNumber } from '../../lib/format'
import styles from './Admin.module.css'

/** Waiting-work counter next to a section name; nothing when zero or unknown. */
function Count({ n, label }: { n: number | undefined; label: string }) {
  if (!n) return null
  return (
    <span className={styles.navCount}>
      <span className="num">{formatNumber(n)}</span>
      <span className="visually-hidden"> {label}</span>
    </span>
  )
}

/**
 * The operator's workspace: one bar of sections, each named after the job to do, with the number of items waiting.
 * The bar scrolls sideways on phones instead of wrapping into several rows.
 */
export function AdminLayout() {
  const queue = useMetrics('30').data?.queue

  return (
    <div className={styles.shell}>
      <nav className={styles.sections} aria-label="أقسام الإدارة">
        <NavLink to="/admin" end className={styles.section}>
          نظرة عامة
        </NavLink>
        <NavLink to="/admin/companies" className={styles.section}>
          المورّدون والشركات
          <Count n={queue === undefined ? undefined : queue.suppliers_pending + queue.specialties_pending} label="بانتظار المراجعة" />
        </NavLink>
        <NavLink to="/admin/rfqs" className={styles.section}>
          طلبات بلا تصنيف
          <Count n={queue?.rfqs_pending_review} label="بانتظار التصنيف" />
        </NavLink>
        <NavLink to="/admin/categories" className={styles.section}>
          التصنيفات
        </NavLink>
        <NavLink to="/admin/audit" className={styles.section}>
          سجل العمليات
        </NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
