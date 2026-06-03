import type { ApiTrade } from '@/types'
import { isClosedTradeV3, isDeletedTrade, getTradeGrossPnl, getTradeRMultiple } from '../../trades/utils/tradesV3Metrics'
import { isReviewed } from '../../review/utils/reviewStatus'
import { safeNumber } from '../../trades/utils/tradesV3Formatters'
import { tradeMatchesPeriod } from '../../trades/utils/tradesV3Filters'
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
  return trades.filter((t) => !isDeletedTrade(t) && tradeMatchesPeriod(t, period))
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
