import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateTrade } from '@/lib/endpoints'
import {
  setTradeCache, patchTradeInLists, invalidateRisk, invalidateAnalytics, invalidatePlaybook,
  invalidateTradeList, invalidateIntelligenceDashboard, patchOperationalDashboardTrade, addTradeToLists,
} from '@/lib/queryInvalidation'
import type { ApiTrade, ApiTradeUpdatePayload } from '@/types'

export function useReviewTradeMutation() {
  const qc = useQueryClient()
  return useMutation<ApiTrade, Error, { id: number; payload: ApiTradeUpdatePayload }>({
    mutationKey: ['trade', 'review-update'],
    mutationFn: ({ id, payload }) => updateTrade(id, payload as Record<string, unknown>),
    onSuccess: (trade) => {
      setTradeCache(qc, trade)
      patchTradeInLists(qc, trade)
      addTradeToLists(qc, trade)
      patchOperationalDashboardTrade(qc, trade)
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidatePlaybook(qc)
      void invalidateIntelligenceDashboard(qc)
      void invalidateTradeList(qc)
    },
  })
}
