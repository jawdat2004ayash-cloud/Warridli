import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/States'
import { useMe } from '../auth/hooks'

/**
 * UX only, inside <RequireAuth> — every /api/admin endpoint is protected by the `admin` middleware on the server
 * (403 before model binding, D24), so hiding the pages is a convenience, not the security boundary.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useMe().data

  if (!me?.is_admin) {
    return (
      <EmptyState
        icon="alert"
        title="هذه الصفحات لإدارة ورّدلي فقط"
        description="حسابك لا يملك صلاحية الإدارة."
        action={<Link to="/account">إلى حسابي</Link>}
      />
    )
  }

  return children
}
