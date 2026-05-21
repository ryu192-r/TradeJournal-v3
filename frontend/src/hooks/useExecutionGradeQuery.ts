import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExecutionGrade, createExecutionGrade, updateExecutionGrade, deleteExecutionGrade } from '@/lib/endpoints'
import {
  invalidateLifecycle, invalidateTradeDetail, invalidateBehavioral,
  invalidateIntelligenceDashboard,
} from '@/lib/queryInvalidation'
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
  })
}

export function useCreateExecutionGradeMutation() {
  const qc = useQueryClient()
  return useMutation<ExecutionGrade, Error, { tradeId: number; payload: ExecutionGradeCreatePayload }>({
    mutationKey: ['execution-grade', 'create'],
    mutationFn: ({ tradeId, payload }) => createExecutionGrade(tradeId, payload),
    onSuccess: (_, { tradeId }) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
      void invalidateBehavioral(qc)
      void invalidateIntelligenceDashboard(qc)
    },
  })
}

export function useUpdateExecutionGradeMutation() {
  const qc = useQueryClient()
  return useMutation<ExecutionGrade, Error, { tradeId: number; payload: ExecutionGradeUpdatePayload }>({
    mutationKey: ['execution-grade', 'update'],
    mutationFn: ({ tradeId, payload }) => updateExecutionGrade(tradeId, payload),
    onSuccess: (_, { tradeId }) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
      void invalidateBehavioral(qc)
      void invalidateIntelligenceDashboard(qc)
    },
  })
}

export function useDeleteExecutionGradeMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationKey: ['execution-grade', 'delete'],
    mutationFn: (tradeId) => deleteExecutionGrade(tradeId),
    onSuccess: (_, tradeId) => {
      void invalidateLifecycle(qc, tradeId)
      void invalidateTradeDetail(qc, tradeId)
      void invalidateBehavioral(qc)
      void invalidateIntelligenceDashboard(qc)
    },
  })
}
