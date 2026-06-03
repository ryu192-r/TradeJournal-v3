import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getIntelligenceDashboard, getOperationalDashboard, listTrades } from '@/lib/endpoints'
import type { IntelligenceDashboardPayload, OperationalDashboardPayload } from '@/types'
import { normalizeTradeListResponse } from '../../shared/apiAdapters'
import type { CockpitV3Data } from '../types'

export function useCockpitV3Data(enabled = true): CockpitV3Data {
  const queryClient = useQueryClient()
  const operational = useQuery<OperationalDashboardPayload>({
    queryKey: ['dashboard', 'operational'],
    queryFn: getOperationalDashboard,
    staleTime: 30_000,
    placeholderData: (previousData: OperationalDashboardPayload | undefined) => previousData,
    enabled,
  })
  const intelligence = useQuery<IntelligenceDashboardPayload>({
    queryKey: ['dashboard', 'intelligence'],
    queryFn: getIntelligenceDashboard,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData: IntelligenceDashboardPayload | undefined) => previousData,
    enabled,
  })
  const trades = useQuery<unknown>({
    queryKey: ['trades', { status: undefined, symbol: undefined, from_date: undefined, to_date: undefined, skip: 0, limit: 200 }],
    queryFn: () => listTrades({ limit: 200 }),
    placeholderData: (previousData: unknown) => previousData,
    enabled,
  })

  const refresh = useCallback(async () => {
    if (!enabled) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operational'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'intelligence'] }),
      queryClient.invalidateQueries({ queryKey: ['trades'] }),
      queryClient.invalidateQueries({ queryKey: ['daily-charges'] }),
    ])
  }, [enabled, queryClient])

  const normalizedTrades = normalizeTradeListResponse(trades.data)
  const tradesError = enabled ? (trades.error as Error | null) : null
  const dashboardError = enabled
    ? ((operational.error as Error | null) ?? (intelligence.error as Error | null) ?? null)
    : null

  return {
    operational: operational.data,
    intelligence: intelligence.data,
    trades: normalizedTrades.items,
    isLoading: enabled && trades.isLoading && !trades.data,
    isFetching: enabled && (operational.isFetching || intelligence.isFetching || trades.isFetching),
    error: tradesError,
    tradesError,
    dashboardError,
    refresh,
  }
}
