import { useCallback } from 'react'
import { useTradeQuery } from '@/hooks/useTradeMutation'
import { usePartialExitsQuery } from '@/hooks/usePartialExitQuery'
import { useStopHistoryQuery } from '@/hooks/useStopHistoryQuery'
import { useTimelineQuery } from '@/hooks/useTimelineQuery'
import { useQueryClient } from '@tanstack/react-query'
import type { TradeDetailV3Data } from '../types'

export function useTradeDetailV3Data(tradeId: number): TradeDetailV3Data {
  const qc = useQueryClient()
  const tradeQuery = useTradeQuery(tradeId)
  const partialExitsQuery = usePartialExitsQuery(tradeId)
  const stopHistoryQuery = useStopHistoryQuery(tradeId)
  const timelineQuery = useTimelineQuery(tradeId)

  const refresh = useCallback(async () => {
    await Promise.all([
      tradeQuery.refetch(),
      partialExitsQuery.refetch(),
      stopHistoryQuery.refetch(),
      timelineQuery.refetch(),
      qc.invalidateQueries({ queryKey: ['chart-data', tradeId] }),
    ])
  }, [qc, tradeId, tradeQuery, partialExitsQuery, stopHistoryQuery, timelineQuery])

  return {
    trade: tradeQuery.data,
    partialExits: partialExitsQuery.data?.items ?? [],
    stopHistory: stopHistoryQuery.data?.items ?? [],
    timelineEvents: timelineQuery.data?.items ?? [],
    isLoading: tradeQuery.isLoading,
    error: (tradeQuery.error as Error | null) ?? null,
    refresh,
  }
}
