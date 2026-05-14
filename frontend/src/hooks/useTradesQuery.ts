import { useQuery } from '@tanstack/react-query'
import { listTrades } from '@/lib/endpoints'
import type { ApiTradeListResponse, BackendTradeStatus } from '@/types'

interface UseTradesQueryOptions {
  status?: BackendTradeStatus
  symbol?: string
  skip?: number
  limit?: number
}

export function useTradesQuery(options?: UseTradesQueryOptions) {
  const { status, symbol, skip = 0, limit = 100 } = options ?? {}
  return useQuery<ApiTradeListResponse>({
    queryKey: ['trades', { status, symbol, skip, limit }],
    queryFn: () => listTrades({ status, symbol, skip, limit }),
    staleTime: 2 * 60 * 1000,
  })
}
