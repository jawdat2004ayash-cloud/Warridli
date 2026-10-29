import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelRfq,
  closeRfq,
  createRfq,
  getCategories,
  getQuotes,
  getRfq,
  listRfqs,
  revealContact,
  selectQuote,
  type BuyerQuote,
  type NewRfqInput,
  type Rfq,
} from '../../lib/rfqs'

export const rfqKeys = {
  all: ['rfqs'] as const,
  list: (page: number) => ['rfqs', 'list', page] as const,
  detail: (id: string) => ['rfqs', 'detail', id] as const,
  quotes: (id: string) => ['rfqs', 'quotes', id] as const,
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => getCategories(signal), staleTime: 10 * 60_000 })
}

export function useRfqs(page: number) {
  return useQuery({
    queryKey: rfqKeys.list(page),
    queryFn: ({ signal }) => listRfqs(page, signal),
    placeholderData: keepPreviousData,
  })
}

export function useRfq(id: string) {
  return useQuery({ queryKey: rfqKeys.detail(id), queryFn: ({ signal }) => getRfq(id, signal) })
}

function useStoreRfq() {
  const queryClient = useQueryClient()
  return (rfq: Rfq) => {
    queryClient.setQueryData(rfqKeys.detail(rfq.id), rfq)
    void queryClient.invalidateQueries({ queryKey: [...rfqKeys.all, 'list'] })
  }
}

export function useCreateRfq() {
  const store = useStoreRfq()
  return useMutation({ mutationFn: (input: NewRfqInput) => createRfq(input), onSuccess: store })
}

export function useCancelRfq() {
  const store = useStoreRfq()
  return useMutation({ mutationFn: (id: string) => cancelRfq(id), onSuccess: store })
}

export function useRfqQuotes(id: string) {
  return useQuery({ queryKey: rfqKeys.quotes(id), queryFn: ({ signal }) => getQuotes(id, signal) })
}

/** After choosing / closing / a 409, both the RFQ and its quotes may have changed: refresh both. */
function useAfterDecision(id: string) {
  const queryClient = useQueryClient()
  const store = useStoreRfq()
  return {
    onSuccess: (rfq: Rfq) => {
      store(rfq)
      void queryClient.invalidateQueries({ queryKey: rfqKeys.quotes(id) })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: rfqKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: rfqKeys.quotes(id) })
    },
  }
}

export function useSelectQuote(id: string) {
  return useMutation({ mutationFn: (quote: BuyerQuote) => selectQuote(id, quote), ...useAfterDecision(id) })
}

export function useCloseRfq(id: string) {
  return useMutation({ mutationFn: () => closeRfq(id), ...useAfterDecision(id) })
}

export function useRevealContact(id: string) {
  return useMutation({ mutationFn: (quoteId: number) => revealContact(id, quoteId) })
}
