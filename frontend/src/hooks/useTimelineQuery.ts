import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listTimeline, createTimelineEvent, deleteTimelineEvent } from '@/lib/endpoints'
import { invalidateLifecycle, invalidateTradeDetail } from '@/lib/queryInvalidation'
import type { TimelineEvent, TimelineEventCreatePayload, TimelineListResponse } from '@/types'

export function useTimelineQuery(tradeId: number | null) {
  return useQuery<TimelineListResponse>({
    queryKey: ['timeline', tradeId],
    queryFn: () => listTimeline(tradeId!),
    enabled: tradeId != null,
  })
}

export function useCreateTimelineEventMutation() {
  const qc = useQueryClient()
  return useMutation<TimelineEvent, Error, { tradeId: number; payload: TimelineEventCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createTimelineEvent(tradeId, payload),
    onSuccess: (_, { tradeId }) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
    },
  })
}

export function useDeleteTimelineEventMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, { tradeId: number; eventId: number }>({
    mutationFn: ({ tradeId, eventId }) => deleteTimelineEvent(tradeId, eventId),
    onSuccess: (_, { tradeId }) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
    },
  })
}
