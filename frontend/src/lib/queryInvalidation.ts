import type { QueryClient } from '@tanstack/react-query'
import type { ApiTrade } from '@/types'

interface TradesListData {
  total: number
  items: ApiTrade[]
}

export function setTradeCache(qc: QueryClient, trade: ApiTrade) {
  qc.setQueryData(['trade', trade.id], trade)
}

export function patchTradeInLists(qc: QueryClient, trade: ApiTrade) {
  qc.setQueriesData<TradesListData>(
    { queryKey: ['trades'] },
    (old) => {
      if (!old?.items) return old
      const idx = old.items.findIndex((t) => t.id === trade.id)
      if (idx === -1) return old
      const items = [...old.items]
      items[idx] = trade
      return { ...old, items }
    },
  )
}

export function addTradeToLists(qc: QueryClient, trade: ApiTrade) {
  qc.setQueriesData<TradesListData>(
    { queryKey: ['trades'] },
    (old) => {
      if (!old) return { total: 1, items: [trade] }
      return { total: old.total + 1, items: [trade, ...old.items] }
    },
  )
}

export function removeTradeFromLists(qc: QueryClient, tradeId: number) {
  qc.setQueriesData<TradesListData>(
    { queryKey: ['trades'] },
    (old) => {
      if (!old?.items) return old
      return { total: Math.max(0, old.total - 1), items: old.items.filter((t) => t.id !== tradeId) }
    },
  )
}

export function invalidateTradeList(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ['trades'] })
}

export function invalidateTradeDetail(qc: QueryClient, tradeId: number) {
  return qc.invalidateQueries({ queryKey: ['trade', tradeId] })
}

export function invalidateRisk(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['risk-dashboard'] }),
    qc.invalidateQueries({ queryKey: ['capital-dashboard'] }),
  ])
}

export function invalidateLifecycle(qc: QueryClient, tradeId: number) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['timeline', tradeId] }),
    qc.invalidateQueries({ queryKey: ['stop-history', tradeId] }),
    qc.invalidateQueries({ queryKey: ['partial-exits', tradeId] }),
    qc.invalidateQueries({ queryKey: ['emotion-logs', tradeId] }),
    qc.invalidateQueries({ queryKey: ['execution-grade', tradeId] }),
  ])
}

export function invalidateAnalytics(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['analytics'] }),
    qc.invalidateQueries({ queryKey: ['journal', 'weekly-stats'] }),
  ])
}

export function invalidatePlaybook(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ['setups'] })
}

export function invalidateCapital(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['capital-dashboard'] }),
    qc.invalidateQueries({ queryKey: ['capital-events'] }),
  ])
}

export function invalidateBehavioral(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['behavioral-intelligence'] }),
    qc.invalidateQueries({ queryKey: ['lifecycle'] }),
    qc.invalidateQueries({ queryKey: ['coach-reviews'] }),
  ])
}
