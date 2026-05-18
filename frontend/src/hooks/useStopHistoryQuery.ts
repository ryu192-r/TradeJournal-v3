import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listStopHistory, createStopHistory } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import type { StopHistoryListResponse, StopHistoryCreatePayload, StopHistoryEntry } from '@/types'

export function useStopHistoryQuery(tradeId: number | null) {
  return useQuery<StopHistoryListResponse>({
    queryKey: ['stop-history', tradeId],
    queryFn: () => listStopHistory(tradeId!),
    enabled: tradeId != null,
    staleTime: 5 * 1000,
  })
}

export function useCreateStopHistoryMutation() {
  const queryClient = useQueryClient()
  return useMutation<StopHistoryEntry, Error, { tradeId: number; payload: StopHistoryCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createStopHistory(tradeId, payload),
    onSuccess: async (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['stop-history', tradeId] })
      await invalidateTradeDomain(queryClient)
    },
  })
}
