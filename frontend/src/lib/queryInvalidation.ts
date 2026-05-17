import type { QueryClient } from '@tanstack/react-query'
import type { ApiTrade } from '@/types'

export function setTradeCache(queryClient: QueryClient, trade: ApiTrade) {
  queryClient.setQueryData(['trade', trade.id], trade)
}

export function invalidateTradeDomain(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['trades'] }),
    queryClient.invalidateQueries({ queryKey: ['trade'] }),
    queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['capital-events'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['journal', 'weekly-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['setups'] }),
  ])
}

export function invalidateCapitalDomain(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['capital-events'] }),
    queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['trades'] }),
  ])
}
