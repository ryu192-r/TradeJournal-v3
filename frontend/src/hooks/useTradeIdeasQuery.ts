import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listIdeas, getIdea, createIdea, updateIdea, deleteIdea, convertIdeaToTrade } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import type {
  TradeIdeaItem, TradeIdeaListResponse, TradeIdeaCreatePayload,
  TradeIdeaUpdatePayload, ConvertToTradePayload, ConvertToTradeResponse, TradeIdeaStatus,
} from '@/types/tradeIdea'

export function useTradeIdeasQuery(status?: TradeIdeaStatus, symbol?: string, direction?: string, confidence?: string) {
  return useQuery<TradeIdeaListResponse>({
    queryKey: ['ideas', { status, symbol, direction, confidence }],
    queryFn: () => listIdeas(status, symbol, direction, confidence),
    staleTime: 5 * 1000,
  })
}

export function useTradeIdeaQuery(id: number | null) {
  return useQuery<TradeIdeaItem>({
    queryKey: ['idea', id],
    queryFn: () => getIdea(id!),
    enabled: id != null && id > 0,
    staleTime: 5 * 1000,
  })
}

export function useCreateIdeaMutation() {
  const queryClient = useQueryClient()
  return useMutation<TradeIdeaItem, Error, TradeIdeaCreatePayload>({
    mutationFn: createIdea,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useUpdateIdeaMutation() {
  const queryClient = useQueryClient()
  return useMutation<TradeIdeaItem, Error, { id: number; payload: TradeIdeaUpdatePayload }>({
    mutationFn: ({ id, payload }) => updateIdea(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] })
      queryClient.invalidateQueries({ queryKey: ['idea'] })
    },
  })
}

export function useDeleteIdeaMutation() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: deleteIdea,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useConvertToTradeMutation() {
  const queryClient = useQueryClient()
  return useMutation<ConvertToTradeResponse, Error, { id: number; payload: ConvertToTradePayload }>({
    mutationFn: ({ id, payload }) => convertIdeaToTrade(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] })
      invalidateTradeDomain(queryClient)
    },
  })
}
