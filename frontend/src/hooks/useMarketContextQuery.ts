import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMarketSnapshots, getMarketPerformanceCorrelation, getMarketRegimeSummary, fetchMarketData, seedMarketSnapshots, getMySymbols, upsertLiveQuotes, getLiveQuotes } from '@/lib/endpoints'

export function useMarketSnapshotsQuery(days?: number) {
  return useQuery({
    queryKey: ['market', 'snapshots', days],
    queryFn: () => getMarketSnapshots(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useMarketCorrelationQuery(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ['market', 'correlation', fromDate, toDate],
    queryFn: () => getMarketPerformanceCorrelation(fromDate, toDate),
    staleTime: 60 * 1000,
  })
}

export function useMarketRegimeQuery(days?: number) {
  return useQuery({
    queryKey: ['market', 'regime', days],
    queryFn: () => getMarketRegimeSummary(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useFetchMarketDataMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => fetchMarketData(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['market'] })
    },
  })
}

export function useSeedMarketSnapshotsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (snapshots: Record<string, unknown>[]) => seedMarketSnapshots(snapshots),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['market'] })
    },
  })
}

export function useMySymbolsQuery() {
  return useQuery({
    queryKey: ['market', 'my-symbols'],
    queryFn: () => getMySymbols(),
    staleTime: 60 * 1000,
  })
}

export function useLiveQuotesQuery(refreshInterval?: number) {
  return useQuery({
    queryKey: ['market', 'live-quotes'],
    queryFn: () => getLiveQuotes(),
    staleTime: 30 * 1000,
    refetchInterval: refreshInterval ?? false,
  })
}

export function useUpsertLiveQuotesMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (quotes: Record<string, unknown>[]) => upsertLiveQuotes(quotes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['market', 'live-quotes'] })
    },
  })
}