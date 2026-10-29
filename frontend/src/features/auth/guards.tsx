import { useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { EmptyState, SkeletonCard } from '../../components/ui/States'
import { Button } from '../../components/ui/Button'
import { useMe } from './hooks'

function SessionError({ retry }: { retry: () => void }) {
  return (
    <EmptyState
      tone="danger"
      icon="alert"
      title="تعذّر التحقق من تسجيل دخولك"
      description="تحقّق من اتصال الإنترنت ثم أعد المحاولة."
      action={<Button variant="secondary" onClick={retry}>أعد المحاولة</Button>}
    />
  )
}

/** UX only — the server enforces authentication on every protected endpoint. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) return <SkeletonCard />
  if (me.isError) return <SessionError retry={() => void me.refetch()} />
  if (me.data === null) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return children
}

/**
 * Login/register pages send users who ARRIVE logged in to their account. Someone who logs in or
 * registers on the page is navigated by the page itself (with its success message); redirecting
 * here too would race that navigation in the browser and drop the message (found in M2b e2e).
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe()
  const [arrivedAsGuest, setArrivedAsGuest] = useState(false)

  if (!arrivedAsGuest && me.data === null) setArrivedAsGuest(true)

  if (me.isPending) return <SkeletonCard />
  if (me.data && !arrivedAsGuest) return <Navigate to="/account" replace />
  return children
}
