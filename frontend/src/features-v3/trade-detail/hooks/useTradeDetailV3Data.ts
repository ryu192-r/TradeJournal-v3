import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTradeQuery } from '@/hooks/useTradeMutation'
import { usePartialExitsQuery } from '@/hooks/usePartialExitQuery'
import { useStopHistoryQuery } from '@/hooks/useStopHistoryQuery'
import { useTimelineQuery } from '@/hooks/useTimelineQuery'
import { listPyramidEntries } from '@/lib/endpoints'
import type { PyramidEntryListResponse } from '@/types'
import type { TradeDetailV3Data } from '../types'

export function useTradeDetailV3Data(tradeId: number): TradeDetailV3Data {
  const qc = useQueryClient()
  const tradeQuery = useTradeQuery(tradeId)
  const partialExitsQuery = usePartialExitsQuery(tradeId)
  const stopHistoryQuery = useStopHistoryQuery(tradeId)
  const timelineQuery = useTimelineQuery(tradeId)
  const pyramidQuery = useQuery<PyramidEntryListResponse>({
    queryKey: ['pyramid-entries', tradeId],
    queryFn: () => listPyramidEntries(tradeId),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const refresh = useCallback(async () => {
    await Promise.all([
      tradeQuery.refetch(),
      partialExitsQuery.refetch(),
      stopHistoryQuery.refetch(),
      timelineQuery.refetch(),
      pyramidQuery.refetch(),
      qc.invalidateQueries({ queryKey: ['chart-data', tradeId] }),
    ])
  }, [qc, tradeId, tradeQuery, partialExitsQuery, stopHistoryQuery, timelineQuery, pyramidQuery])

  return {
    trade: tradeQuery.data,
    partialExits: partialExitsQuery.data?.items ?? [],
    stopHistory: stopHistoryQuery.data?.items ?? [],
    timelineEvents: timelineQuery.data?.items ?? [],
    pyramidEntries: pyramidQuery.data?.items ?? [],
    isLoading: tradeQuery.isLoading,
    error: (tradeQuery.error as Error | null) ?? null,
    refresh,
  }
}
