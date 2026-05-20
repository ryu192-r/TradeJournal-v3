import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listCapitalEvents, createCapitalEvent, updateCapitalEvent, deleteCapitalEvent } from '@/lib/endpoints'
import { invalidateCapital, invalidateRisk, invalidateAnalytics, invalidateTradeList } from '@/lib/queryInvalidation'
import type { CapitalEvent, CapitalEventType } from '@/types'

export function useCapitalEventsQuery(accountId: number | null, eventType?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['capital-events', accountId, eventType, startDate, endDate],
    queryFn: () => listCapitalEvents(accountId!, eventType, startDate, endDate),
    enabled: accountId != null,
    placeholderData: (previousData) => previousData,
  })
}

export function useCreateCapitalEventMutation() {
  const qc = useQueryClient()
  return useMutation<CapitalEvent, Error, {
    event_type: CapitalEventType
    amount: string
    timestamp: string
    description?: string
    account_id: number
  }>({
    mutationFn: (payload) => createCapitalEvent(payload),
    onSuccess: () => {
      void invalidateCapital(qc)
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidateTradeList(qc)
    },
  })
}

export function useUpdateCapitalEventMutation() {
  const qc = useQueryClient()
  return useMutation<CapitalEvent, Error, {
    eventId: number
    payload: { event_type?: CapitalEventType; amount?: string; timestamp?: string; description?: string }
  }>({
    mutationFn: ({ eventId, payload }) => updateCapitalEvent(eventId, payload),
    onSuccess: () => {
      void invalidateCapital(qc)
      void invalidateRisk(qc)
    },
  })
}

export function useDeleteCapitalEventMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: (eventId) => deleteCapitalEvent(eventId),
    onSuccess: () => {
      void invalidateCapital(qc)
      void invalidateRisk(qc)
    },
  })
}
