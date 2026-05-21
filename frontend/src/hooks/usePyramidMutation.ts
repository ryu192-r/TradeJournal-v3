import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pyramidTrade as pyramidTradeEndpoint } from '@/lib/endpoints'
import {
  setTradeCache, patchTradeInLists, addTradeToLists,
  invalidateTradeList, invalidateRisk, invalidateAnalytics, invalidatePlaybook,
  invalidateIntelligenceDashboard, patchOperationalDashboardTrade,
} from '@/lib/queryInvalidation'
import { span } from '@/utils/performance'
import type { ApiTrade } from '@/types'

interface PyramidTradePayload {
  entry_price: number
  quantity: number
  entry_time?: string
  fees?: number
  stop_price?: number
}

export function usePyramidMutation() {
  const qc = useQueryClient()
  return useMutation<ApiTrade, Error, { id: number; payload: PyramidTradePayload }>({
    mutationKey: ['trade', 'pyramid'],
    mutationFn: ({ id, payload }) => pyramidTradeEndpoint(id, payload),
    onMutate: () => span('mutation:pyramid'),
    onSuccess: (trade, _vars, endSpan) => {
      setTradeCache(qc, trade)
      patchTradeInLists(qc, trade)
      addTradeToLists(qc, trade)
      patchOperationalDashboardTrade(qc, trade)
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidatePlaybook(qc)
      void invalidateIntelligenceDashboard(qc)
      void invalidateTradeList(qc)
      if (typeof endSpan === 'function') endSpan()
    },
    onError: (_err, _vars, endSpan) => {
      if (typeof endSpan === 'function') endSpan()
    },
  })
}
