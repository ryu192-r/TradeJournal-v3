import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPartialExits, createPartialExit, deletePartialExit } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import type { PartialExit, PartialExitCreatePayload, PartialExitListResponse } from '@/types'

export function usePartialExitsQuery(tradeId: number | null) {
  return useQuery<PartialExitListResponse>({
    queryKey: ['partial-exits', tradeId],
    queryFn: () => listPartialExits(tradeId!),
    enabled: tradeId != null,
    staleTime: 5 * 1000,
  })
}

export function useCreatePartialExitMutation() {
  const queryClient = useQueryClient()
  return useMutation<PartialExit, Error, { tradeId: number; payload: PartialExitCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createPartialExit(tradeId, payload),
    onSuccess: async (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['partial-exits', tradeId] })
      await invalidateTradeDomain(queryClient)
    },
  })
}

export function useDeletePartialExitMutation() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { tradeId: number; exitId: number }>({
    mutationFn: ({ tradeId, exitId }) => deletePartialExit(tradeId, exitId),
    onSuccess: async (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['partial-exits', tradeId] })
      await invalidateTradeDomain(queryClient)
    },
  })
}