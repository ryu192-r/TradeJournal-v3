import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listCapitalEvents, createCapitalEvent, updateCapitalEvent, deleteCapitalEvent } from '@/lib/endpoints'
import { invalidateCapitalDomain } from '@/lib/queryInvalidation'
import type { CapitalEvent, CapitalEventType } from '@/types'

export function useCapitalEventsQuery(accountId: number | null, eventType?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['capital-events', accountId, eventType, startDate, endDate],
    queryFn: () => listCapitalEvents(accountId!, eventType, startDate, endDate),
    enabled: accountId != null,
    staleTime: 5 * 1000,
  })
}

export function useCreateCapitalEventMutation() {
  const queryClient = useQueryClient()
  return useMutation<CapitalEvent, Error, {
    event_type: CapitalEventType
    amount: string
    timestamp: string
    description?: string
    account_id: number
  }>({
    mutationFn: (payload) => createCapitalEvent(payload),
    onSuccess: async () => { await invalidateCapitalDomain(queryClient) },
  })
}

export function useUpdateCapitalEventMutation() {
  const queryClient = useQueryClient()
  return useMutation<CapitalEvent, Error, {
    eventId: number
    payload: { event_type?: CapitalEventType; amount?: string; timestamp?: string; description?: string }
  }>({
    mutationFn: ({ eventId, payload }) => updateCapitalEvent(eventId, payload),
    onSuccess: async () => { await invalidateCapitalDomain(queryClient) },
  })
}

export function useDeleteCapitalEventMutation() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: (eventId) => deleteCapitalEvent(eventId),
    onSuccess: async () => { await invalidateCapitalDomain(queryClient) },
  })
}
