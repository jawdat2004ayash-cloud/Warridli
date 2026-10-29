import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** One-time success messages passed between pages through router state. */
export type Flash = 'registered' | 'loggedIn' | 'loggedOut' | 'passwordReset' | 'rfqCreated'

export const flashState = (flash: Flash) => ({ flash })

/**
 * Keeps the latest flash (also one that arrives while the page is already mounted, e.g. a guard
 * redirect landed first), then removes it from history so a reload doesn't repeat it.
 */
export function useFlash(): Flash | null {
  const location = useLocation()
  const navigate = useNavigate()
  const incoming = (location.state as { flash?: Flash } | null)?.flash ?? null
  const [flash, setFlash] = useState(incoming)

  if (incoming && incoming !== flash) setFlash(incoming)

  useEffect(() => {
    if (incoming) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [incoming, navigate, location.pathname, location.search])

  return flash
}
