import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExecutionGrade, createExecutionGrade, updateExecutionGrade, deleteExecutionGrade } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import type { ExecutionGrade, ExecutionGradeCreatePayload, ExecutionGradeUpdatePayload } from '@/types'

export function useExecutionGradeQuery(tradeId: number | null) {
  return useQuery<ExecutionGrade | null>({
    queryKey: ['execution-grade', tradeId],
    queryFn: async () => {
      try {
        return await getExecutionGrade(tradeId!)
      } catch (e: any) {
        if (e?.response?.status === 404) return null
        throw e
      }
    },
    enabled: tradeId != null,
    staleTime: 5 * 1000,
  })
}

export function useCreateExecutionGradeMutation() {
  const queryClient = useQueryClient()
  return useMutation<ExecutionGrade, Error, { tradeId: number; payload: ExecutionGradeCreatePayload }>({
    mutationFn: ({ tradeId, payload }) => createExecutionGrade(tradeId, payload),
    onSuccess: async (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['execution-grade', tradeId] })
      queryClient.invalidateQueries({ queryKey: ['timeline', tradeId] })
      await invalidateTradeDomain(queryClient)
    },
  })
}

export function useUpdateExecutionGradeMutation() {
  const queryClient = useQueryClient()
  return useMutation<ExecutionGrade, Error, { tradeId: number; payload: ExecutionGradeUpdatePayload }>({
    mutationFn: ({ tradeId, payload }) => updateExecutionGrade(tradeId, payload),
    onSuccess: async (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['execution-grade', tradeId] })
      queryClient.invalidateQueries({ queryKey: ['timeline', tradeId] })
      await invalidateTradeDomain(queryClient)
    },
  })
}

export function useDeleteExecutionGradeMutation() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: (tradeId) => deleteExecutionGrade(tradeId),
    onSuccess: async (_, tradeId) => {
      queryClient.invalidateQueries({ queryKey: ['execution-grade', tradeId] })
      await invalidateTradeDomain(queryClient)
    },
  })
}