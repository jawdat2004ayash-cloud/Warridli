import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/States'
import { useMe } from '../auth/hooks'

/** UX only, inside <RequireAuth> — RfqPolicy on the server is the real check. */
export function RequireBuyer({ children }: { children: ReactNode }) {
  const company = useMe().data?.company

  if (company?.type !== 'buyer') {
    return (
      <EmptyState
        icon="store"
        title="طلبات الأسعار للورش والمعامل"
        description="هذه الصفحة لحسابات المشترين. حسابك الحالي لا يستطيع إنشاء طلبات أسعار."
        action={<Link to="/account">إلى حسابي</Link>}
      />
    )
  }
  return children
}
