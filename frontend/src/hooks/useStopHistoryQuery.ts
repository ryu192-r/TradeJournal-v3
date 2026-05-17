import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listStopHistory, createStopHistory } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import type { StopHistoryListResponse, StopHistoryCreatePayload, StopHistoryEntry } from '@/types'

export function useStopHistoryQuery(tradeId: number | null) {
  return useQuery<StopHistoryListResponse>({
    queryKey: ['stop-history', tradeId],
    queryFn: () => listStopHistory(tradeId!),
    enabled: tradeId != null,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateStopHistoryMutation() {
  const queryClient = useQueryClient()
  return useMutation<StopHistoryEntry, Error, { tradeId: number; payload: StopHistoryCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createStopHistory(tradeId, payload),
    onSuccess: (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['stop-history', tradeId] })
      invalidateTradeDomain(queryClient)
    },
  })
}
