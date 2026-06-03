import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { listTrades } from '@/lib/endpoints'
import type { ApiTradeListResponse } from '@/types'
import type { TradesV3Data } from '../types'

export function useTradesV3Data(enabled = true): TradesV3Data {
  const queryClient = useQueryClient()
  const trades = useQuery<ApiTradeListResponse>({
    queryKey: ['trades', { status: undefined, symbol: undefined, from_date: undefined, to_date: undefined, skip: 0, limit: 500 }],
    queryFn: () => listTrades({ limit: 500 }),
    placeholderData: (previousData) => previousData,
    enabled,
  })

  const refresh = useCallback(async () => {
    if (!enabled) return
    await queryClient.invalidateQueries({ queryKey: ['trades'] })
  }, [enabled, queryClient])

  return {
    trades: trades.data?.items ?? [],
    total: trades.data?.total ?? 0,
    isLoading: enabled && trades.isLoading && !trades.data,
    isFetching: enabled && trades.isFetching,
    error: enabled ? (trades.error as Error | null) : null,
    refresh,
  }
}
