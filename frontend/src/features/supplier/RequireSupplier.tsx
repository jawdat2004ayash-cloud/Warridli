import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Notice } from '../../components/ui/Notice'
import { EmptyState } from '../../components/ui/States'
import { useMe } from '../auth/hooks'

/**
 * UX only, inside <RequireAuth> — the `supplier` middleware and RfqPolicy on the server are the real checks.
 * `approved` = the inbox and quotes; otherwise any supplier company (e.g. the specialties page).
 */
export function RequireSupplier({ approved = false, children }: { approved?: boolean; children: ReactNode }) {
  const company = useMe().data?.company

  if (company?.type !== 'supplier') {
    return (
      <EmptyState
        icon="wrench"
        title="هذه الصفحة للمورّدين"
        description="حسابك الحالي حساب مشترٍ. يمكنك طلب أسعار القطع من صفحة طلباتك."
        action={<Link to="/rfqs">إلى طلباتي</Link>}
      />
    )
  }

  if (approved && company.status === 'pending') {
    return (
      <Notice tone="warn" title="حسابك قيد المراجعة">
        تراجع إدارة ورّدلي بيانات محلك. بعد الموافقة تظهر هنا طلبات الأسعار في تخصصاتك.{' '}
        <Link to="/supplier/categories">اختر تخصصاتك الآن</Link> لتُراجَع مع حسابك.
      </Notice>
    )
  }

  if (approved && company.status !== 'approved') {
    return <Notice tone="danger" title="لا يمكنك استقبال طلبات الأسعار حالياً">تواصل مع إدارة ورّدلي لمعرفة التفاصيل.</Notice>
  }

  return children
}
