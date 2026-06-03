import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { listTrades } from '@/lib/endpoints'
import { normalizeTradeListResponse } from '../../shared/apiAdapters'
import type { TradesV3Data } from '../types'

export function useTradesV3Data(enabled = true): TradesV3Data {
  const queryClient = useQueryClient()
  const trades = useQuery<unknown>({
    queryKey: ['trades', { status: undefined, symbol: undefined, from_date: undefined, to_date: undefined, skip: 0, limit: 200 }],
    queryFn: () => listTrades({ limit: 200 }),
    placeholderData: (previousData: unknown) => previousData,
    enabled,
  })

  const refresh = useCallback(async () => {
    if (!enabled) return
    await queryClient.invalidateQueries({ queryKey: ['trades'] })
  }, [enabled, queryClient])

  const normalized = normalizeTradeListResponse(trades.data)

  return {
    trades: normalized.items,
    total: normalized.total,
    isLoading: enabled && trades.isLoading && !trades.data,
    isFetching: enabled && trades.isFetching,
    error: enabled ? (trades.error as Error | null) : null,
    refresh,
  }
}
