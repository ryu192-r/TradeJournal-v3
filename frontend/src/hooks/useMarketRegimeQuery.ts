import { useQuery } from '@tanstack/react-query'
import {
  getMarketRegimeDashboard,
  getCurrentRegime,
  getRegimePerformance,
  getRegimeMatrix,
} from '@/lib/endpoints'

const STALE = 5 * 60 * 1000

export function useMarketRegimeDashboardQuery() {
  return useQuery({
    queryKey: ['market-regime', 'dashboard'],
    queryFn: () => getMarketRegimeDashboard(),
    staleTime: STALE,
    placeholderData: (previousData) => previousData,
  })
}

export function useCurrentRegimeQuery() {
  return useQuery({
    queryKey: ['market-regime', 'current'],
    queryFn: () => getCurrentRegime(),
    staleTime: STALE,
    retry: false,
    placeholderData: (previousData) => previousData,
  })
}

export function useRegimePerformanceQuery() {
  return useQuery({
    queryKey: ['market-regime', 'performance'],
    queryFn: () => getRegimePerformance(),
    staleTime: STALE,
    placeholderData: (previousData) => previousData,
  })
}

export function useRegimeMatrixQuery() {
  return useQuery({
    queryKey: ['market-regime', 'matrix'],
    queryFn: () => getRegimeMatrix(),
    staleTime: STALE,
    placeholderData: (previousData) => previousData,
  })
}
