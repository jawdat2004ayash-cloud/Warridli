import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getAreas, getMe, login, logout, register, type Me, type RegisterInput } from '../../lib/auth'

export const meQueryKey = ['me'] as const

function replaceSession(queryClient: QueryClient, me: Me | null) {
  // Sessions can expire without logout. Drop the previous identity's data and cancel its requests
  // before publishing the new identity (company-scoped query keys are otherwise reused).
  queryClient.clear()
  queryClient.setQueryData(meQueryKey, me)
}

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: ({ signal }) => getMe(signal), staleTime: 60_000 })
}

export function useAreas() {
  return useQuery({ queryKey: ['areas'], queryFn: ({ signal }) => getAreas(signal), staleTime: 10 * 60_000 })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    onSuccess: (me: Me) => replaceSession(queryClient, me),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => register(input),
    onSuccess: (me: Me) => replaceSession(queryClient, me),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => replaceSession(queryClient, null),
  })
}
