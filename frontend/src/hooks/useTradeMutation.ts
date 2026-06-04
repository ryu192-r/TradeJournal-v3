import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTrade, updateTrade, getTrade, deleteTrade } from '@/lib/endpoints'
import {
  setTradeCache, patchTradeInLists, addTradeToLists, removeTradeFromLists,
  invalidateTradeList, invalidateRisk, invalidateAnalytics, invalidatePlaybook,
  invalidateTradeDetail, invalidateIntelligenceDashboard, patchOperationalDashboardTrade,
  removeTradeFromOperationalDashboard, invalidateChargesDependents,
} from '@/lib/queryInvalidation'
import { span } from '@/utils/performance'
import { useRef } from 'react'
import type { ApiTrade } from '@/types'

type UpdateTradeContext = { previousTrade?: ApiTrade }

export function useCreateTradeMutation() {
  const qc = useQueryClient()
  const endSpanRef = useRef<(() => void) | null>(null)
  return useMutation<ApiTrade, Error, Record<string, unknown>>({
    mutationKey: ['trade', 'create'],
    mutationFn: createTrade,
    onMutate: () => {
      endSpanRef.current = span('mutation:create-trade')
    },
    onSuccess: (trade) => {
      setTradeCache(qc, trade)
      addTradeToLists(qc, trade)
      patchOperationalDashboardTrade(qc, trade)
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidatePlaybook(qc)
      void invalidateIntelligenceDashboard(qc)
      void invalidateChargesDependents(qc)
      endSpanRef.current?.()
      endSpanRef.current = null
    },
    onError: () => {
      endSpanRef.current?.()
      endSpanRef.current = null
    },
  })
}

export function useUpdateTradeMutation() {
  const qc = useQueryClient()
  const endSpanRef = useRef<(() => void) | null>(null)
  return useMutation<ApiTrade, Error, { id: number; payload: Record<string, unknown> }, UpdateTradeContext>({
    mutationKey: ['trade', 'update'],
    mutationFn: ({ id, payload }) => updateTrade(id, payload),
    onMutate: ({ id, payload }) => {
      endSpanRef.current = span('mutation:update-trade')
      const previousTrade = qc.getQueryData<ApiTrade>(['trade', id])
      if (previousTrade) {
        const optimisticTrade = { ...previousTrade, ...payload, id } as ApiTrade
        setTradeCache(qc, optimisticTrade)
        patchTradeInLists(qc, optimisticTrade)
        addTradeToLists(qc, optimisticTrade)
        patchOperationalDashboardTrade(qc, optimisticTrade)
      }
      return { previousTrade }
    },
    onSuccess: (trade) => {
      setTradeCache(qc, trade)
      patchTradeInLists(qc, trade)
      addTradeToLists(qc, trade)
      patchOperationalDashboardTrade(qc, trade)
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidatePlaybook(qc)
      void invalidateIntelligenceDashboard(qc)
      void invalidateChargesDependents(qc)
      endSpanRef.current?.()
      endSpanRef.current = null
    },
    onError: (_error, variables, context) => {
      if (context?.previousTrade) {
        setTradeCache(qc, context.previousTrade)
        patchTradeInLists(qc, context.previousTrade)
        addTradeToLists(qc, context.previousTrade)
        patchOperationalDashboardTrade(qc, context.previousTrade)
      } else {
        void invalidateTradeDetail(qc, variables.id)
        void invalidateTradeList(qc)
      }
      endSpanRef.current?.()
      endSpanRef.current = null
    },
  })
}

export function useDeleteTradeMutation() {
  const qc = useQueryClient()
  const endSpanRef = useRef<(() => void) | null>(null)
  return useMutation({
    mutationKey: ['trade', 'delete'],
    mutationFn: (id: number) => deleteTrade(id),
    onMutate: () => {
      endSpanRef.current = span('mutation:delete-trade')
    },
    onSuccess: (_, id) => {
      removeTradeFromLists(qc, id)
      removeTradeFromOperationalDashboard(qc, id)
      qc.removeQueries({ queryKey: ['trade', id] })
      void invalidateRisk(qc)
      void invalidateAnalytics(qc)
      void invalidatePlaybook(qc)
      void invalidateIntelligenceDashboard(qc)
      void invalidateChargesDependents(qc)
      endSpanRef.current?.()
      endSpanRef.current = null
    },
    onError: () => {
      endSpanRef.current?.()
      endSpanRef.current = null
    },
  })
}

export function useTradeQuery(id: number) {
  return useQuery<ApiTrade>({
    queryKey: ['trade', id],
    queryFn: () => getTrade(id),
    enabled: id > 0,
    placeholderData: (previousData) => previousData,
  })
}
