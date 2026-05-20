import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEmotionLogs, createEmotionLog, deleteEmotionLog } from '@/lib/endpoints'
import { invalidateLifecycle, invalidateTradeDetail, invalidateBehavioral } from '@/lib/queryInvalidation'
import type { EmotionLog, EmotionLogCreatePayload, EmotionLogListResponse } from '@/types'

export function useEmotionLogsQuery(tradeId: number | null) {
  return useQuery<EmotionLogListResponse>({
    queryKey: ['emotion-logs', tradeId],
    queryFn: () => listEmotionLogs(tradeId!),
    enabled: tradeId != null,
    placeholderData: (previousData) => previousData,
  })
}

export function useCreateEmotionLogMutation() {
  const qc = useQueryClient()
  return useMutation<EmotionLog, Error, { tradeId: number; payload: EmotionLogCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createEmotionLog(tradeId, payload),
    onSuccess: (_, { tradeId }) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
      void invalidateBehavioral(qc)
    },
  })
}

export function useDeleteEmotionLogMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, { tradeId: number; logId: number }>({
    mutationFn: ({ tradeId, logId }) => deleteEmotionLog(tradeId, logId),
    onSuccess: (_, { tradeId }) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
      void invalidateBehavioral(qc)
    },
  })
}
