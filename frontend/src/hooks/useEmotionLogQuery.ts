import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEmotionLogs, createEmotionLog } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import type { EmotionLog, EmotionLogCreatePayload, EmotionLogListResponse } from '@/types'

export function useEmotionLogsQuery(tradeId: number | null) {
  return useQuery<EmotionLogListResponse>({
    queryKey: ['emotion-logs', tradeId],
    queryFn: () => listEmotionLogs(tradeId!),
    enabled: tradeId != null,
    staleTime: 5 * 1000,
  })
}

export function useCreateEmotionLogMutation() {
  const queryClient = useQueryClient()
  return useMutation<EmotionLog, Error, { tradeId: number; payload: EmotionLogCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createEmotionLog(tradeId, payload),
    onSuccess: async (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['emotion-logs', tradeId] })
      queryClient.invalidateQueries({ queryKey: ['timeline', tradeId] })
      await invalidateTradeDomain(queryClient)
    },
  })
}