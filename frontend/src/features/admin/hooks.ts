import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RfqStatus } from '../../components/ui/Badge'
import {
  createCategory,
  getAdminRfq,
  getMetrics,
  listAdminCategories,
  listAdminRfqs,
  listAuditLogs,
  listCompanies,
  rejectRfq,
  reviewSpecialty,
  setUserSuspension,
  transitionCompany,
  triageRfq,
  updateCategory,
  type AdminRfq,
  type AuditFilter,
  type CompanyFilter,
  type CompanyTransition,
  type MetricsPeriod,
} from '../../lib/admin'

export const adminKeys = {
  all: ['admin'] as const,
  companies: (filter: CompanyFilter) => ['admin', 'companies', filter] as const,
  rfqs: (status: RfqStatus, page: number) => ['admin', 'rfqs', status, page] as const,
  rfq: (id: string) => ['admin', 'rfq', id] as const,
  categories: ['admin', 'categories'] as const,
  metrics: (period: MetricsPeriod) => ['admin', 'metrics', period] as const,
  audit: (filter: AuditFilter) => ['admin', 'audit', filter] as const,
}

/**
 * Any admin decision can change several screens (queues, counters, audit trail): refetch the admin data.
 * Public categories are refreshed too, so a renamed/deactivated category shows up in forms at once.
 */
function useRefreshAdmin() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['categories'] })
  }
}

export function useCompanies(filter: CompanyFilter) {
  return useQuery({ queryKey: adminKeys.companies(filter), queryFn: ({ signal }) => listCompanies(filter, signal), placeholderData: keepPreviousData })
}

export function useCompanyTransition() {
  const refresh = useRefreshAdmin()
  return useMutation({
    mutationFn: ({ id, transition, reason }: { id: number; transition: CompanyTransition; reason?: string }) => transitionCompany(id, transition, reason),
    onSettled: refresh,
  })
}

export function useUserSuspension() {
  const refresh = useRefreshAdmin()
  return useMutation({
    mutationFn: ({ userId, suspend, reason }: { userId: number; suspend: boolean; reason?: string }) => setUserSuspension(userId, suspend, reason),
    onSettled: refresh,
  })
}

export function useSpecialtyReview() {
  const refresh = useRefreshAdmin()
  return useMutation({
    mutationFn: ({ companyId, categoryId, decision, reason }: { companyId: number; categoryId: number; decision: 'approve' | 'reject'; reason?: string }) =>
      reviewSpecialty(companyId, categoryId, decision, reason),
    onSettled: refresh,
  })
}

export function useAdminRfqs(status: RfqStatus, page: number) {
  return useQuery({ queryKey: adminKeys.rfqs(status, page), queryFn: ({ signal }) => listAdminRfqs(status, page, signal), placeholderData: keepPreviousData })
}

export function useAdminRfq(id: string) {
  return useQuery({ queryKey: adminKeys.rfq(id), queryFn: ({ signal }) => getAdminRfq(id, signal) })
}

function useStoreRfq() {
  const queryClient = useQueryClient()
  const refresh = useRefreshAdmin()
  return {
    onSuccess: (rfq: AdminRfq) => queryClient.setQueryData(adminKeys.rfq(rfq.id), rfq),
    onSettled: refresh,
  }
}

export function useTriageRfq(id: string) {
  return useMutation({ mutationFn: (categoryId: number) => triageRfq(id, categoryId), ...useStoreRfq() })
}

export function useRejectRfq(id: string) {
  return useMutation({ mutationFn: (reason: string) => rejectRfq(id, reason), ...useStoreRfq() })
}

export function useAdminCategories() {
  return useQuery({ queryKey: adminKeys.categories, queryFn: ({ signal }) => listAdminCategories(signal) })
}

export function useCreateCategory() {
  const refresh = useRefreshAdmin()
  return useMutation({ mutationFn: createCategory, onSuccess: refresh })
}

export function useUpdateCategory() {
  const refresh = useRefreshAdmin()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name_ar?: string; sort?: number; is_active?: boolean }) => updateCategory(id, input),
    onSettled: refresh,
  })
}

export function useMetrics(period: MetricsPeriod) {
  return useQuery({ queryKey: adminKeys.metrics(period), queryFn: ({ signal }) => getMetrics(period, signal), placeholderData: keepPreviousData })
}

export function useAuditLogs(filter: AuditFilter) {
  return useQuery({ queryKey: adminKeys.audit(filter), queryFn: ({ signal }) => listAuditLogs(filter, signal), placeholderData: keepPreviousData })
}
