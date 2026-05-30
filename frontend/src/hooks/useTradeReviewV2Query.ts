import { useQuery } from '@tanstack/react-query'
import { getTradeReviewBatchV2, getTradeReviewV2 } from '@/lib/endpoints'
import type { TradeReviewBatchResponse, TradeReviewV2Response } from '@/types/tradeReviewV2'

export function useTradeReviewV2Query(tradeId: number | null | undefined) {
  return useQuery<TradeReviewV2Response>({
    queryKey: ['trade-review-v2', tradeId],
    queryFn: () => getTradeReviewV2(tradeId!),
    enabled: tradeId != null && tradeId > 0,
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  })
}

export function useTradeReviewBatchV2Query(limit = 20, onlyClosed = true) {
  return useQuery<TradeReviewBatchResponse>({
    queryKey: ['trade-review-v2', 'batch', limit, onlyClosed],
    queryFn: () => getTradeReviewBatchV2({ limit, only_closed: onlyClosed }),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })
}
