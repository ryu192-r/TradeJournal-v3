import { useQuery } from '@tanstack/react-query'
import { getOpenLiveTrades } from '@/lib/endpoints'
import type { OpenLiveTrade } from '@/types'

export function useOpenLiveTradesQuery() {
  return useQuery<OpenLiveTrade[]>({
    queryKey: ['trades', 'open-live'],
    queryFn: getOpenLiveTrades,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: (previousData) => previousData,
  })
}
