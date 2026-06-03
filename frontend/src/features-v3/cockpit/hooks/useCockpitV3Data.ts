import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getIntelligenceDashboard, getOperationalDashboard, listTrades } from '@/lib/endpoints'
import type { ApiTradeListResponse, IntelligenceDashboardPayload, OperationalDashboardPayload } from '@/types'
import type { CockpitV3Data } from '../types'

export function useCockpitV3Data(enabled = true): CockpitV3Data {
  const queryClient = useQueryClient()
  const operational = useQuery<OperationalDashboardPayload>({
    queryKey: ['dashboard', 'operational'],
    queryFn: getOperationalDashboard,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
    enabled,
  })
  const intelligence = useQuery<IntelligenceDashboardPayload>({
    queryKey: ['dashboard', 'intelligence'],
    queryFn: getIntelligenceDashboard,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    enabled,
  })
  const trades = useQuery<ApiTradeListResponse>({
    queryKey: ['trades', { status: undefined, symbol: undefined, from_date: undefined, to_date: undefined, skip: 0, limit: 250 }],
    queryFn: () => listTrades({ limit: 250 }),
    placeholderData: (previousData) => previousData,
    enabled,
  })

  const refresh = useCallback(async () => {
    if (!enabled) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operational'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'intelligence'] }),
      queryClient.invalidateQueries({ queryKey: ['trades'] }),
    ])
  }, [enabled, queryClient])

  return {
    operational: operational.data,
    intelligence: intelligence.data,
    trades: trades.data?.items ?? [],
    isLoading: enabled && ((operational.isLoading && !operational.data) || (trades.isLoading && !trades.data)),
    isFetching: enabled && (operational.isFetching || intelligence.isFetching || trades.isFetching),
    error: enabled ? (operational.error as Error | null) ?? (trades.error as Error | null) ?? (intelligence.error as Error | null) ?? null : null,
    refresh,
  }
}
