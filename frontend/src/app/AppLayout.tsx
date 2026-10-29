import { Suspense, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Wordmark } from '../components/brand/Wordmark'
import { Icon } from '../components/ui/Icon'
import { SkeletonCard } from '../components/ui/States'
import { useMe } from '../features/auth/hooks'
import { useUnreadCount } from '../features/notifications/hooks'
import { formatNumber } from '../lib/format'
import styles from './AppLayout.module.css'

/** Always visible (also on phones): the one place that says something happened. */
function NotificationsLink() {
  const unread = useUnreadCount().data ?? 0
  return (
    <NavLink to="/notifications" className={`${styles.navLink} ${styles.bell}`}>
      <Icon name="bell" size={20} />
      <span className="visually-hidden">الإشعارات{unread > 0 ? ` — ${unread} غير مقروءة` : ''}</span>
      {unread > 0 && (
        <span className={styles.bellCount} aria-hidden="true">
          {unread > 99 ? '99+' : formatNumber(unread)}
        </span>
      )}
    </NavLink>
  )
}

function AuthNav() {
  const me = useMe()

  // Nothing while unknown, so the header never flashes "login" for a logged-in user.
  if (me.isPending || me.isError) return null

  if (me.data) {
    return (
      <>
        {me.data.is_admin && (
          <NavLink to="/admin" className={`${styles.navLink} ${styles.navSecondary}`}>
            الإدارة
          </NavLink>
        )}
        {me.data.company?.type === 'buyer' && (
          <NavLink to="/rfqs" end={false} className={`${styles.navLink} ${styles.navSecondary}`}>
            طلباتي
          </NavLink>
        )}
        {me.data.company?.type === 'supplier' && (
          <NavLink
            to={me.data.company.status === 'approved' ? '/supplier/rfqs' : '/supplier/categories'}
            className={`${styles.navLink} ${styles.navSecondary}`}
          >
            {me.data.company.status === 'approved' ? 'الطلبات' : 'تخصصاتي'}
          </NavLink>
        )}
        {me.data.company && <NotificationsLink />}
        <NavLink to="/account" className={`${styles.navLink} ${styles.accountLink}`}>
        <Icon name="user" size={18} />
        <span className={styles.navName}>{me.data.name}</span>
          <span className="visually-hidden"> — حسابي</span>
        </NavLink>
      </>
    )
  }

  return (
    <>
      <NavLink to="/register" className={`${styles.navLink} ${styles.navSecondary}`}>
        حساب جديد
      </NavLink>
      <NavLink to="/login" className={styles.navLink}>
        تسجيل الدخول
      </NavLink>
    </>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)
  // Generic task titles deliberately exclude private descriptions, names, emails and reset tokens.
  const titles: Record<string, string> = {
    '/': 'طلبات أسعار قطع الغيار الصناعية', '/login': 'تسجيل الدخول', '/register': 'اختر نوع حسابك',
    '/register/buyer': 'إنشاء حساب مشترٍ', '/register/supplier': 'إنشاء حساب مورّد', '/account': 'حسابي',
    '/forgot-password': 'استعادة كلمة المرور', '/reset-password': 'تعيين كلمة مرور جديدة',
    '/rfqs': 'طلباتي', '/rfqs/new': 'طلب سعر جديد', '/notifications': 'الإشعارات',
    '/supplier/categories': 'تخصصاتي', '/supplier/rfqs': 'طلبات الأسعار للمورّد',
    '/admin': 'نظرة عامة للإدارة', '/admin/companies': 'المورّدون والشركات', '/admin/rfqs': 'طلبات بلا تصنيف',
    '/admin/categories': 'التصنيفات', '/admin/audit': 'سجل العمليات', '/design': 'دليل التصميم',
  }
  const title = titles[pathname] ?? (pathname.startsWith('/supplier/rfqs/') ? 'طلب سعر للمورّد'
    : pathname.startsWith('/admin/rfqs/') ? 'مراجعة طلب السعر'
      : pathname.startsWith('/rfqs/') ? 'طلب السعر وعروض المورّدين' : 'الصفحة غير موجودة')

  useEffect(() => {
    document.title = `${title} — ورّدلي`
    if (previousPath.current !== pathname) {
      previousPath.current = pathname
      mainRef.current?.focus()
      mainRef.current?.scrollIntoView?.({ block: 'start' })
    }
  }, [pathname, title])

  return (
    <>
      <a href="#main" className={styles.skip}>
        تخطَّ إلى المحتوى
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="ورّدلي — الصفحة الرئيسية">
            <Wordmark inverse />
          </Link>
          <p className={styles.tagline}>طلبات أسعار قطع الغيار الصناعية · دمشق وريفها</p>
          <nav className={styles.nav} aria-label="الحساب">
            <AuthNav />
          </nav>
        </div>
      </header>
      <main ref={mainRef} id="main" className={styles.main} tabIndex={-1} aria-label={title}>
        <Suspense fallback={<SkeletonCard />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  )
}
