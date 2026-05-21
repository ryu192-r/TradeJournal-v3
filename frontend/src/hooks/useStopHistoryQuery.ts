import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listStopHistory, createStopHistory } from '@/lib/endpoints'
import {
  invalidateTradeDetail, invalidateRisk, invalidateLifecycle,
  invalidateOperationalDashboard, patchOperationalDashboardStop,
} from '@/lib/queryInvalidation'
import type { StopHistoryListResponse, StopHistoryCreatePayload, StopHistoryEntry } from '@/types'

export function useStopHistoryQuery(tradeId: number | null) {
  return useQuery<StopHistoryListResponse>({
    queryKey: ['stop-history', tradeId],
    queryFn: () => listStopHistory(tradeId!),
    enabled: tradeId != null,
    placeholderData: (previousData) => previousData,
  })
}

export function useCreateStopHistoryMutation() {
  const qc = useQueryClient()
  return useMutation<StopHistoryEntry, Error, { tradeId: number; payload: StopHistoryCreatePayload }>({
    mutationKey: ['stop-history', 'create'],
    mutationFn: ({ tradeId, payload }) => createStopHistory(tradeId, payload),
    onSuccess: (_, { tradeId, payload }) => {
      patchOperationalDashboardStop(qc, tradeId, payload.price)
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
      void invalidateRisk(qc)
      void invalidateOperationalDashboard(qc)
    },
  })
}
