import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getSpecialties,
  getSupplierRfq,
  listInbox,
  saveQuote,
  saveSpecialties,
  withdrawQuote,
  type InboxTab,
  type QuoteInput,
  type SupplierRfq,
} from '../../lib/supplier'

export const supplierKeys = {
  inbox: (tab: InboxTab, page: number) => ['supplier', 'inbox', tab, page] as const,
  rfq: (id: string) => ['supplier', 'rfq', id] as const,
  specialties: ['supplier', 'specialties'] as const,
}

export function useInbox(tab: InboxTab, page: number) {
  return useQuery({ queryKey: supplierKeys.inbox(tab, page), queryFn: ({ signal }) => listInbox(tab, page, signal), placeholderData: keepPreviousData })
}

export function useSupplierRfq(id: string) {
  return useQuery({ queryKey: supplierKeys.rfq(id), queryFn: ({ signal }) => getSupplierRfq(id, signal) })
}

function useStore() {
  const queryClient = useQueryClient()
  return (rfq: SupplierRfq) => {
    queryClient.setQueryData(supplierKeys.rfq(rfq.id), rfq)
    // A quote moves the RFQ from "new" to "my quotes".
    void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] })
  }
}

export function useSaveQuote(id: string) {
  const store = useStore()
  return useMutation({ mutationFn: (input: QuoteInput) => saveQuote(id, input), onSuccess: store })
}

export function useWithdrawQuote(id: string) {
  const store = useStore()
  return useMutation({ mutationFn: () => withdrawQuote(id), onSuccess: store })
}

export function useSpecialties() {
  return useQuery({ queryKey: supplierKeys.specialties, queryFn: ({ signal }) => getSpecialties(signal) })
}

export function useSaveSpecialties() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => saveSpecialties(ids),
    onSuccess: (data) => queryClient.setQueryData(supplierKeys.specialties, data),
  })
}
