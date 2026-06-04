import type { ApiTrade } from '@/types'
import { getRealizedSessionDate, getTradeSessionDate, todaySessionDate } from '@/utils/tradeDates'
import { isClosedTradeV3, isDeletedTrade, getTradeGrossPnl, getTradeRMultiple } from '../../trades/utils/tradesV3Metrics'
import { isReviewed } from '../../review/utils/reviewStatus'
import { safeNumber } from '../../trades/utils/tradesV3Formatters'
import type { TradesV3Period } from '../../trades/types'

// ────────────────────────── Types ──────────────────────────

export interface PerformanceMetrics {
  totalTrades: number
  closedTrades: number
  openTrades: number
  grossPnl: number
  winRate: number | null
  avgR: number | null
  bestTrade: number | null
  worstTrade: number | null
  reviewedCount: number
  pendingReview: number
}

export interface GroupMetrics {
  label: string
  count: number
  grossPnl: number
  winRate: number | null
  avgR: number | null
}

export interface ChargesStatus {
  grossPnl: number | null
  totalCharges: number | null
  netPnl: number | null
  chargesRecordedDays: number
  tradingDays: number
  missingDays: number
  isComplete: boolean
}

// ────────────────────────── Core ──────────────────────────

function closedNonDeleted(trades: ApiTrade[]): ApiTrade[] {
  return trades.filter((t) => !isDeletedTrade(t) && isClosedTradeV3(t))
}

export function filterByPeriod(trades: ApiTrade[], period: TradesV3Period): ApiTrade[] {
  if (period === 'all') return trades.filter((t) => !isDeletedTrade(t))
  const today = todaySessionDate()
  const [start, end] = analyticsPeriodToRange(period, today)
  return filterBySessionRange(trades, start, end)
}

export function analyticsPeriodToRange(period: Exclude<TradesV3Period, 'all'>, today = todaySessionDate()): [string, string] {
  if (period === 'today') return [today, today]
  if (period === 'week') {
    const [year, month, day] = today.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    const dayIndex = date.getUTCDay()
    date.setUTCDate(date.getUTCDate() - (dayIndex === 0 ? 6 : dayIndex - 1))
    return [date.toISOString().slice(0, 10), today]
  }
  return [`${today.slice(0, 7)}-01`, today]
}

export function tradeMatchesSessionRange(trade: ApiTrade, start: string, end: string): boolean {
  if (isDeletedTrade(trade)) return false
  const session = isClosedTradeV3(trade)
    ? getRealizedSessionDate(trade.exit_time, trade.entry_time, trade.created_at)
    : getTradeSessionDate(trade)
  return session != null && session >= start && session <= end
}

export function filterBySessionRange(trades: ApiTrade[], start: string, end: string): ApiTrade[] {
  return trades.filter((t) => tradeMatchesSessionRange(t, start, end))
}

export function computePerformance(trades: ApiTrade[]): PerformanceMetrics {
  const nonDeleted = trades.filter((t) => !isDeletedTrade(t))
  const closed = closedNonDeleted(trades)
  const open = nonDeleted.filter((t) => !isClosedTradeV3(t))

  const pnls = closed.map(getTradeGrossPnl).filter((v): v is number => v != null)
  const wins = pnls.filter((p) => p > 0).length
  const rs = closed.map(getTradeRMultiple).filter((v): v is number => v != null)

  return {
    totalTrades: nonDeleted.length,
    closedTrades: closed.length,
    openTrades: open.length,
    grossPnl: pnls.reduce((a, b) => a + b, 0),
    winRate: pnls.length > 0 ? (wins / pnls.length) * 100 : null,
    avgR: rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    bestTrade: pnls.length > 0 ? Math.max(...pnls) : null,
    worstTrade: pnls.length > 0 ? Math.min(...pnls) : null,
    reviewedCount: closed.filter(isReviewed).length,
    pendingReview: closed.filter((t) => !isReviewed(t)).length,
  }
}

// ────────────────────────── Grouping ──────────────────────────

function groupBy(trades: ApiTrade[], key: (t: ApiTrade) => string): GroupMetrics[] {
  const closed = closedNonDeleted(trades)
  const groups = new Map<string, ApiTrade[]>()
  for (const t of closed) {
    const k = key(t) || 'Not set'
    const arr = groups.get(k) ?? []
    arr.push(t)
    groups.set(k, arr)
  }
  return [...groups.entries()].map(([label, items]) => {
    const pnls = items.map(getTradeGrossPnl).filter((v): v is number => v != null)
    const wins = pnls.filter((p) => p > 0).length
    const rs = items.map(getTradeRMultiple).filter((v): v is number => v != null)
    return {
      label,
      count: items.length,
      grossPnl: pnls.reduce((a, b) => a + b, 0),
      winRate: pnls.length > 0 ? (wins / pnls.length) * 100 : null,
      avgR: rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    }
  }).sort((a, b) => b.grossPnl - a.grossPnl)
}

export function groupBySetup(trades: ApiTrade[]): GroupMetrics[] {
  return groupBy(trades, (t) => t.setup ?? 'Untagged')
}

export function groupByExchange(trades: ApiTrade[]): GroupMetrics[] {
  return groupBy(trades, (t) => t.exchange ?? 'Not set')
}

export function groupByProductType(trades: ApiTrade[]): GroupMetrics[] {
  return groupBy(trades, (t) => t.product_type ?? 'Not set')
}

// ────────────────────────── Charges ──────────────────────────

export function buildChargesStatus(summary: {
  gross_realized_pnl: string | null
  total_charges: string | null
  net_realized_pnl: string | null
  charges_recorded_days: number
  trading_days: number
  missing_charge_days: number
} | null): ChargesStatus {
  if (!summary) return { grossPnl: null, totalCharges: null, netPnl: null, chargesRecordedDays: 0, tradingDays: 0, missingDays: 0, isComplete: false }
  const gross = safeNumber(summary.gross_realized_pnl)
  const charges = safeNumber(summary.total_charges)
  const net = safeNumber(summary.net_realized_pnl)
  return {
    grossPnl: gross,
    totalCharges: charges,
    netPnl: summary.missing_charge_days === 0 ? net : null,
    chargesRecordedDays: summary.charges_recorded_days,
    tradingDays: summary.trading_days,
    missingDays: summary.missing_charge_days,
    isComplete: summary.missing_charge_days === 0,
  }
}
