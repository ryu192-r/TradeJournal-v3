import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generateTradeReview } from '@/lib/endpoints'
import type { TradeReviewResponse } from '@/types/coach'

export function useTradeReviewMutation() {
  const qc = useQueryClient()
  return useMutation<TradeReviewResponse, Error, number>({
    mutationFn: (tradeId: number) => generateTradeReview(tradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coach-reviews'] })
    },
  })
}