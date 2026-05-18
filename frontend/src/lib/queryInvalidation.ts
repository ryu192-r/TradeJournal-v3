import type { QueryClient } from '@tanstack/react-query'
import type { ApiTrade } from '@/types'

export function setTradeCache(queryClient: QueryClient, trade: ApiTrade) {
  queryClient.setQueryData(['trade', trade.id], trade)
}

export async function invalidateTradeDomain(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['trades'] }),
    queryClient.invalidateQueries({ queryKey: ['trade'] }),
    queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['capital-events'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['journal', 'weekly-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['setups'] }),
    queryClient.invalidateQueries({ queryKey: ['timeline'] }),
    queryClient.invalidateQueries({ queryKey: ['partial-exits'] }),
    queryClient.invalidateQueries({ queryKey: ['emotion-logs'] }),
    queryClient.invalidateQueries({ queryKey: ['execution-grade'] }),
    queryClient.invalidateQueries({ queryKey: ['lifecycle'] }),
    queryClient.invalidateQueries({ queryKey: ['coach-reviews'] }),
  ])
}

export async function invalidateCapitalDomain(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['capital-events'] }),
    queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['trades'] }),
  ])
}
