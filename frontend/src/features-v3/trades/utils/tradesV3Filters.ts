import type { ApiTrade } from '@/types'
import { getTradeSessionDate, todaySessionDate } from '@/utils/tradeDates'
import type { TradesV3Filters } from '../types'
import { getTradeDirection, getTradeSetup, normalizeTradeSymbol, safeNumber } from './tradesV3Formatters'
import {
  getTradeDisplayStatus,
  getTradeGrossPnl,
  getTradeRMultiple,
  hasMissingNotes,
  hasMissingSetup,
  hasMissingStop,
  isDeletedTrade,
  isPartialTradeV3,
  isReviewPending,
} from './tradesV3Metrics'

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfWeekKey(todayKey: string): string {
  const [year, month, day] = todayKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayIndex = date.getUTCDay()
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex
  date.setUTCDate(date.getUTCDate() + mondayOffset)
  return toDateKey(date)
}

export function getSetupOptions(trades: ApiTrade[]): string[] {
  return [...new Set(trades.map((trade) => trade.setup?.trim()).filter((setup): setup is string => Boolean(setup)))]
    .sort((a, b) => a.localeCompare(b))
}

export function tradeMatchesPeriod(trade: ApiTrade, period: TradesV3Filters['period'], todayKey = todaySessionDate()): boolean {
  if (period === 'all') return true
  const sessionDate = getTradeSessionDate(trade)
  if (!sessionDate) return false
  if (period === 'today') return sessionDate === todayKey
  if (period === 'week') return sessionDate >= startOfWeekKey(todayKey) && sessionDate <= todayKey
  return sessionDate >= `${todayKey.slice(0, 7)}-01` && sessionDate <= todayKey
}

export function filterTrades(trades: ApiTrade[], filters: TradesV3Filters, todayKey?: string): ApiTrade[] {
  return trades.filter((trade) => {
    const status = getTradeDisplayStatus(trade)
    if (filters.status === 'active' && isDeletedTrade(trade)) return false
    if (filters.status !== 'active' && status !== filters.status) return false

    const query = normalizeTradeSymbol(filters.search)
    if (query && !normalizeTradeSymbol(trade.symbol).includes(query)) return false

    if (filters.direction !== 'all' && getTradeDirection(trade).toLowerCase() !== filters.direction) return false
    if (!tradeMatchesPeriod(trade, filters.period, todayKey)) return false

    if (filters.setup === 'untagged' && !hasMissingSetup(trade)) return false
    if (filters.setup !== 'all' && filters.setup !== 'untagged' && getTradeSetup(trade) !== filters.setup) return false

    if (filters.attention === 'missing_setup' && !hasMissingSetup(trade)) return false
    if (filters.attention === 'missing_notes' && !hasMissingNotes(trade)) return false
    if (filters.attention === 'missing_sl' && !hasMissingStop(trade)) return false
    if (filters.attention === 'review_pending' && !isReviewPending(trade)) return false
    if (filters.attention === 'partial_open' && !isPartialTradeV3(trade)) return false

    return true
  })
}

export function sortTrades(trades: ApiTrade[], sort: TradesV3Filters['sort']): ApiTrade[] {
  const sorted = [...trades]

  sorted.sort((a, b) => {
    if (sort === 'symbol') return normalizeTradeSymbol(a.symbol).localeCompare(normalizeTradeSymbol(b.symbol))
    if (sort === 'pnl_high') return (getTradeGrossPnl(b) ?? Number.NEGATIVE_INFINITY) - (getTradeGrossPnl(a) ?? Number.NEGATIVE_INFINITY)
    if (sort === 'pnl_low') return (getTradeGrossPnl(a) ?? Number.POSITIVE_INFINITY) - (getTradeGrossPnl(b) ?? Number.POSITIVE_INFINITY)
    if (sort === 'r_high') return (getTradeRMultiple(b) ?? Number.NEGATIVE_INFINITY) - (getTradeRMultiple(a) ?? Number.NEGATIVE_INFINITY)

    const aTime = safeNumber(Date.parse(a.entry_time)) ?? 0
    const bTime = safeNumber(Date.parse(b.entry_time)) ?? 0
    return sort === 'oldest' ? aTime - bTime : bTime - aTime
  })

  return sorted
}

export function applyTradesV3Filters(trades: ApiTrade[], filters: TradesV3Filters, todayKey?: string): ApiTrade[] {
  return sortTrades(filterTrades(trades, filters, todayKey), filters.sort)
}
