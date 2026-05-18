import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listTimeline, createTimelineEvent } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import type { TimelineEvent, TimelineEventCreatePayload, TimelineListResponse } from '@/types'

export function useTimelineQuery(tradeId: number | null) {
  return useQuery<TimelineListResponse>({
    queryKey: ['timeline', tradeId],
    queryFn: () => listTimeline(tradeId!),
    enabled: tradeId != null,
    staleTime: 5 * 1000,
  })
}

export function useCreateTimelineEventMutation() {
  const queryClient = useQueryClient()
  return useMutation<TimelineEvent, Error, { tradeId: number; payload: TimelineEventCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createTimelineEvent(tradeId, payload),
    onSuccess: async (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['timeline', tradeId] })
      await invalidateTradeDomain(queryClient)
    },
  })
}