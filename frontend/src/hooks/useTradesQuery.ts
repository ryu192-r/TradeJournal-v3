import { useQuery } from '@tanstack/react-query'
import { listTrades } from '@/lib/endpoints'
import type { ApiTradeListResponse, BackendTradeStatus } from '@/types'

interface UseTradesQueryOptions {
  status?: BackendTradeStatus
  symbol?: string
  from_date?: string
  to_date?: string
  skip?: number
  limit?: number
}

export function useTradesQuery(options?: UseTradesQueryOptions) {
  const { status, symbol, from_date, to_date, skip = 0, limit = 100 } = options ?? {}
  return useQuery<ApiTradeListResponse>({
    queryKey: ['trades', { status, symbol, from_date, to_date, skip, limit }],
    queryFn: () => listTrades({ status, symbol, from_date, to_date, skip, limit }),
    staleTime: 5 * 1000,
  })
}