import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPartialExits, createPartialExit, deletePartialExit } from '@/lib/endpoints'
import { invalidateTradeDetail, invalidateRisk, invalidateLifecycle, invalidateAnalytics, invalidateTradeList } from '@/lib/queryInvalidation'
import { span } from '@/utils/performance'
import { useRef } from 'react'
import type { PartialExit, PartialExitCreatePayload, PartialExitListResponse } from '@/types'

export function usePartialExitsQuery(tradeId: number | null) {
  return useQuery<PartialExitListResponse>({
    queryKey: ['partial-exits', tradeId],
    queryFn: () => listPartialExits(tradeId!),
    enabled: tradeId != null,
    placeholderData: (previousData) => previousData,
  })
}

export function useCreatePartialExitMutation() {
  const qc = useQueryClient()
  const endSpanRef = useRef<(() => void) | null>(null)
  return useMutation<PartialExit, Error, { tradeId: number; payload: PartialExitCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createPartialExit(tradeId, payload),
    onMutate: () => {
      endSpanRef.current = span('mutation:partial-exit')
    },
    onSuccess: (_, { tradeId }) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidateTradeList(qc)
      endSpanRef.current?.()
      endSpanRef.current = null
    },
    onError: () => {
      endSpanRef.current?.()
      endSpanRef.current = null
    },
  })
}

export function useDeletePartialExitMutation() {
  const qc = useQueryClient()
  const endSpanRef = useRef<(() => void) | null>(null)
  return useMutation<void, Error, { tradeId: number; exitId: number }>({
    mutationFn: ({ tradeId, exitId }) => deletePartialExit(tradeId, exitId),
    onMutate: () => {
      endSpanRef.current = span('mutation:delete-partial-exit')
    },
    onSuccess: (_, { tradeId }) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidateTradeList(qc)
      endSpanRef.current?.()
      endSpanRef.current = null
    },
    onError: () => {
      endSpanRef.current?.()
      endSpanRef.current = null
    },
  })
}
