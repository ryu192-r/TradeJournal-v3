import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPartialExits, createPartialExit, deletePartialExit } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import { span } from '@/utils/performance'
import { useRef } from 'react'
import type { PartialExit, PartialExitCreatePayload, PartialExitListResponse, ApiTrade } from '@/types'

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
  return useMutation<{ partial_exit: PartialExit; trade: ApiTrade }, Error, { tradeId: number; payload: PartialExitCreatePayload }>({
    mutationKey: ['partial-exit', 'create'],
    mutationFn: ({ tradeId, payload }) => createPartialExit(tradeId, payload),
    onMutate: () => {
      endSpanRef.current = span('mutation:partial-exit')
    },
    onSuccess: (_, { tradeId }) => {
      void invalidateTradeDomain(qc, tradeId)
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
  return useMutation<{ trade: ApiTrade }, Error, { tradeId: number; exitId: number }>({
    mutationKey: ['partial-exit', 'delete'],
    mutationFn: ({ tradeId, exitId }) => deletePartialExit(tradeId, exitId),
    onMutate: () => {
      endSpanRef.current = span('mutation:delete-partial-exit')
    },
    onSuccess: (_, { tradeId }) => {
      void invalidateTradeDomain(qc, tradeId)
      endSpanRef.current?.()
      endSpanRef.current = null
    },
    onError: () => {
      endSpanRef.current?.()
      endSpanRef.current = null
    },
  })
}
