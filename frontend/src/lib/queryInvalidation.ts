import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type {
  ApiTrade,
  BackendTradeStatus,
  OpenLiveTrade,
  OperationalDashboardPayload,
} from '@/types'

interface TradesListData {
  total: number
  items: ApiTrade[]
}

interface TradeListFilters {
  status?: BackendTradeStatus
  symbol?: string
  from_date?: string
  to_date?: string
  skip?: number
  limit?: number
}

function readTradeFilters(queryKey: QueryKey): TradeListFilters {
  const filters = Array.isArray(queryKey) ? queryKey[1] : undefined
  return filters && typeof filters === 'object' ? filters as TradeListFilters : {}
}

function effectiveTradeStatus(trade: ApiTrade): BackendTradeStatus {
  if (trade.status === 'deleted') return 'deleted'
  return trade.exit_price == null ? 'open' : 'closed'
}

function matchesTradeFilters(trade: ApiTrade, filters: TradeListFilters): boolean {
  if (filters.status && effectiveTradeStatus(trade) !== filters.status) return false

  const symbol = filters.symbol?.trim().toLowerCase()
  if (symbol && !trade.symbol.toLowerCase().includes(symbol)) return false

  const entryDate = trade.entry_time?.slice(0, 10)
  if (filters.from_date || filters.to_date) {
    if (!entryDate) return false
    if (filters.from_date && entryDate < filters.from_date) return false
    if (filters.to_date && entryDate > filters.to_date) return false
  }

  return true
}

function isOpenTrade(trade: ApiTrade): boolean {
  return effectiveTradeStatus(trade) === 'open'
}

function toOpenLiveTrade(trade: ApiTrade): OpenLiveTrade {
  return {
    id: trade.id,
    symbol: trade.symbol,
    entry_price: trade.entry_price,
    quantity: trade.quantity,
    remaining_qty: trade.remaining_qty ?? trade.quantity,
    stop_price: trade.stop_price,
    fees: trade.fees,
  }
}

export function setTradeCache(qc: QueryClient, trade: ApiTrade) {
  qc.setQueryData(['trade', trade.id], trade)
}

export function patchTradeInLists(qc: QueryClient, trade: ApiTrade) {
  qc.getQueriesData<TradesListData>({ queryKey: ['trades'] }).forEach(([queryKey]) => {
    const filters = readTradeFilters(queryKey)

    qc.setQueryData<TradesListData>(queryKey, (old) => {
      if (!old?.items) return old

      const matches = matchesTradeFilters(trade, filters)
      const idx = old.items.findIndex((t) => t.id === trade.id)

      // Case 1: trade should NOT be in this list
      if (!matches) {
        if (idx === -1) return old  // not present – nothing to do
        return {
          ...old,
          total: Math.max(0, old.total - 1),
          items: old.items.filter((t) => t.id !== trade.id),
        }
      }

      // Case 2: trade should be in list and already is – patch in place
      if (idx >= 0) {
        const items = [...old.items]
        items[idx] = trade
        return { ...old, items }
      }

      // Case 3: trade matches filters but is missing from this list variant
      //          (e.g. symbol search or status filter changed). Only add on
      //          page 1; later pages will be corrected by background refetch.
      if ((filters.skip ?? 0) > 0) return old

      const limit = filters.limit ?? old.items.length
      return {
        ...old,
        total: old.total + 1,
        items: [trade, ...old.items].slice(0, limit),
      }
    })
  })
}

export function addTradeToLists(qc: QueryClient, trade: ApiTrade) {
  qc.getQueriesData<TradesListData>({ queryKey: ['trades'] }).forEach(([queryKey]) => {
    const filters = readTradeFilters(queryKey)

    qc.setQueryData<TradesListData>(queryKey, (old) => {
      if (!old?.items) return old
      if (!matchesTradeFilters(trade, filters)) return old
      if ((filters.skip ?? 0) > 0) return old
      if (old.items.some((t) => t.id === trade.id)) return old

      const limit = filters.limit ?? old.items.length
      return {
        ...old,
        total: old.total + 1,
        items: [trade, ...old.items].slice(0, limit),
      }
    })
  })
}

export function removeTradeFromLists(qc: QueryClient, tradeId: number) {
  qc.setQueriesData<TradesListData>(
    { queryKey: ['trades'] },
    (old) => {
      if (!old?.items) return old
      const exists = old.items.some((t) => t.id === tradeId)
      if (!exists) return old
      return {
        ...old,
        total: Math.max(0, old.total - 1),
        items: old.items.filter((t) => t.id !== tradeId),
      }
    },
  )
}

export function patchOperationalDashboardTrade(qc: QueryClient, trade: ApiTrade) {
  qc.setQueryData<OperationalDashboardPayload>(
    ['dashboard', 'operational'],
    (old) => {
      if (!old) return old
      const openTrade = toOpenLiveTrade(trade)
      const existingIndex = old.open_trades.findIndex((t) => t.id === trade.id)

      if (!isOpenTrade(trade)) {
        if (existingIndex === -1) return old
        return {
          ...old,
          open_trades: old.open_trades.filter((t) => t.id !== trade.id),
        }
      }

      if (existingIndex === -1) {
        return {
          ...old,
          open_trades: [openTrade, ...old.open_trades],
        }
      }

      const openTrades = [...old.open_trades]
      openTrades[existingIndex] = openTrade
      return { ...old, open_trades: openTrades }
    },
  )
}

export function removeTradeFromOperationalDashboard(qc: QueryClient, tradeId: number) {
  qc.setQueryData<OperationalDashboardPayload>(
    ['dashboard', 'operational'],
    (old) => old
      ? { ...old, open_trades: old.open_trades.filter((t) => t.id !== tradeId) }
      : old,
  )
}

export function patchOperationalDashboardStop(qc: QueryClient, tradeId: number, stopPrice: string) {
  qc.setQueryData<OperationalDashboardPayload>(
    ['dashboard', 'operational'],
    (old) => {
      if (!old) return old
      const idx = old.open_trades.findIndex((t) => t.id === tradeId)
      if (idx === -1) return old
      const openTrades = [...old.open_trades]
      openTrades[idx] = { ...openTrades[idx], stop_price: stopPrice }
      return { ...old, open_trades: openTrades }
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
    invalidateOperationalDashboard(qc),
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
    invalidateOperationalDashboard(qc),
  ])
}

export function invalidateBehavioral(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['behavioral-intelligence'] }),
    qc.invalidateQueries({ queryKey: ['lifecycle'] }),
    qc.invalidateQueries({ queryKey: ['coach-reviews'] }),
    invalidateIntelligenceDashboard(qc),
  ])
}

export function invalidateOperationalDashboard(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ['dashboard', 'operational'] })
}

export function invalidateIntelligenceDashboard(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ['dashboard', 'intelligence'] })
}
