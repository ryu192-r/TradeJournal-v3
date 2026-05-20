import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listIdeas, getIdea, createIdea, updateIdea, deleteIdea, convertIdeaToTrade } from '@/lib/endpoints'
import { invalidateTradeList, invalidateRisk, invalidateAnalytics, invalidatePlaybook } from '@/lib/queryInvalidation'
import type {
  TradeIdeaItem, TradeIdeaListResponse, TradeIdeaCreatePayload,
  TradeIdeaUpdatePayload, ConvertToTradePayload, ConvertToTradeResponse, TradeIdeaStatus,
} from '@/types/tradeIdea'

export function useTradeIdeasQuery(status?: TradeIdeaStatus, symbol?: string, direction?: string, confidence?: string) {
  return useQuery<TradeIdeaListResponse>({
    queryKey: ['ideas', { status, symbol, direction, confidence }],
    queryFn: () => listIdeas(status, symbol, direction, confidence),
  })
}

export function useTradeIdeaQuery(id: number | null) {
  return useQuery<TradeIdeaItem>({
    queryKey: ['idea', id],
    queryFn: () => getIdea(id!),
    enabled: id != null && id > 0,
  })
}

export function useCreateIdeaMutation() {
  const qc = useQueryClient()
  return useMutation<TradeIdeaItem, Error, TradeIdeaCreatePayload>({
    mutationFn: createIdea,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useUpdateIdeaMutation() {
  const qc = useQueryClient()
  return useMutation<TradeIdeaItem, Error, { id: number; payload: TradeIdeaUpdatePayload }>({
    mutationFn: ({ id, payload }) => updateIdea(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ideas'] })
      qc.invalidateQueries({ queryKey: ['idea'] })
    },
  })
}

export function useDeleteIdeaMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: deleteIdea,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })
}

export function useConvertToTradeMutation() {
  const qc = useQueryClient()
  return useMutation<ConvertToTradeResponse, Error, { id: number; payload: ConvertToTradePayload }>({
    mutationFn: ({ id, payload }) => convertIdeaToTrade(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ideas'] })
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidatePlaybook(qc)
      void invalidateTradeList(qc)
    },
  })
}
