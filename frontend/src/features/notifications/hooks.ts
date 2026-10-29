import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from '../../lib/notifications'
import { useMe } from '../auth/hooks'

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  page: (page: number) => ['notifications', 'page', page] as const,
}

/** A4: polling, no WebSockets. Only accounts that can receive notifications (members of a company) poll. */
export const POLL_MS = 60_000

export function useUnreadCount() {
  const me = useMe().data
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => getUnreadCount(signal),
    enabled: Boolean(me?.company),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}

export function useNotifications(page: number) {
  return useQuery({ queryKey: notificationKeys.page(page), queryFn: ({ signal }) => listNotifications(page, signal), placeholderData: keepPreviousData })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
}

export function useMarkRead() {
  const refresh = useRefresh()
  return useMutation({ mutationFn: markNotificationRead, onSettled: refresh })
}

export function useMarkAllRead() {
  const refresh = useRefresh()
  return useMutation({ mutationFn: markAllNotificationsRead, onSettled: refresh })
}
