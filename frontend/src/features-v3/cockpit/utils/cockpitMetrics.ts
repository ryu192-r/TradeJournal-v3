import type { ApiTrade, OperationalDashboardPayload } from '@/types'
import { computeMaxRisk } from '@/utils/calculations'
import type { CockpitActionItem, CockpitMetrics, CockpitSetupSummary, CockpitSignal } from '../types'
import { excludeDeletedTrades, filterTradesByPeriod, isClosedTrade, isOpenTrade } from './cockpitFilters'
import type { CockpitPeriod } from '../types'

export function safeNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[₹,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function tradeGrossPnl(trade: ApiTrade): number | null {
  const pnl = safeNumber(trade.pnl)
  if (pnl == null) return null
  const fees = safeNumber(trade.fees) ?? 0
  return pnl + fees
}

export function calculateGrossPnl(trades: ApiTrade[]): number | null {
  const values = trades.map(tradeGrossPnl).filter((value): value is number => value != null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0)
}

export function calculateRecordedFees(trades: ApiTrade[]): number | null {
  const fees = trades.map((trade) => safeNumber(trade.fees)).filter((value): value is number => value != null)
  if (fees.length === 0) return null
  return fees.reduce((sum, value) => sum + value, 0)
}

/**
 * Win rate using GROSS P&L (pnl + fees > 0) for consistency with the
 * Cockpit's gross-first philosophy. A trade profitable before fees is a win.
 */
export function calculateWinRate(trades: ApiTrade[]): number | null {
  const closed = trades.filter(isClosedTrade)
  if (closed.length === 0) return null
  const wins = closed.filter((trade) => (tradeGrossPnl(trade) ?? 0) > 0).length
  return (wins / closed.length) * 100
}

export function calculateAvgR(trades: ApiTrade[]): number | null {
  const values = trades
    .filter(isClosedTrade)
    .map((trade) => safeNumber(trade.r_multiple))
    .filter((value): value is number => value != null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function calculateOpenRisk(trades: ApiTrade[], operational?: OperationalDashboardPayload): number | null {
  const dashboardRisk = safeNumber(operational?.risk?.open_risk)
  if (dashboardRisk != null) return dashboardRisk

  const openTrades = trades.filter(isOpenTrade)
  if (openTrades.length === 0) return null

  const riskValues = openTrades.map((trade) => {
    const entry = safeNumber(trade.entry_price)
    const stop = safeNumber(trade.current_stop_price ?? trade.stop_price)
    const remaining = safeNumber(trade.remaining_qty ?? trade.quantity)
    if (entry == null || stop == null || remaining == null) return null
    return computeMaxRisk(entry, stop, remaining, trade.direction)
  })

  if (riskValues.some((value) => value == null)) return null
  return riskValues
    .filter((value): value is number => value != null)
    .reduce((sum, value) => sum + value, 0)
}

export function getUntaggedCount(trades: ApiTrade[]): number {
  return excludeDeletedTrades(trades).filter((trade) => !(trade.setup?.trim()) && (trade.tags?.length ?? 0) === 0).length
}

export function buildReviewItems(trades: ApiTrade[], activeTrades: ApiTrade[], chargesPending: boolean): CockpitActionItem[] {
  const items: CockpitActionItem[] = []
  const active = excludeDeletedTrades(trades)

  for (const trade of active) {
    if (isClosedTrade(trade) && !trade.review_notes?.trim() && !trade.notes?.trim()) {
      items.push({
        id: `review-${trade.id}`,
        type: 'review',
        tone: 'warning',
        title: `${trade.symbol} needs review notes`,
        reason: 'Closed trade has no notes or review notes.',
        trade,
      })
    }

    if (!trade.setup?.trim() && (trade.tags?.length ?? 0) === 0) {
      items.push({
        id: `setup-${trade.id}`,
        type: 'setup',
        tone: 'info',
        title: `${trade.symbol} missing setup context`,
        reason: 'No setup or tags are attached.',
        trade,
      })
    }
  }

  // Check ALL open trades for missing SL (not just period-filtered ones)
  for (const trade of activeTrades) {
    if (!trade.current_stop_price && !trade.stop_price) {
      items.push({
        id: `risk-${trade.id}`,
        type: 'risk',
        tone: 'loss',
        title: `${trade.symbol} missing protection SL`,
        reason: 'Open trade has no current stop price recorded.',
        trade,
      })
    }

    if (safeNumber(trade.partial_realized_pnl) != null) {
      items.push({
        id: `partial-${trade.id}`,
        type: 'position',
        tone: 'accent',
        title: `${trade.symbol} partial position remains open`,
        reason: 'Partial realized P&L exists and remaining quantity is still live.',
        trade,
      })
    }
  }

  if (chargesPending && active.length > 0) {
    items.unshift({
      id: 'charges-pending',
      type: 'charges',
      tone: 'warning',
      title: 'Daily charges pending',
      reason: 'Net P&L remains pending until charges are recorded.',
    })
  }

  return items.slice(0, 8)
}

export function groupSetups(trades: ApiTrade[]): CockpitSetupSummary[] {
  const grouped = new Map<string, CockpitSetupSummary>()

  for (const trade of excludeDeletedTrades(trades)) {
    const name = trade.setup?.trim()
    if (!name) continue
    const current = grouped.get(name) ?? {
      name,
      tradeCount: 0,
      closedCount: 0,
      grossPnl: 0,
      wins: 0,
      winRate: null,
    }
    current.tradeCount += 1

    if (isClosedTrade(trade)) {
      current.closedCount += 1
      const gross = tradeGrossPnl(trade)
      current.grossPnl += gross ?? 0
      // Use GROSS P&L for win detection (consistent with headline metrics)
      if ((gross ?? 0) > 0) current.wins += 1
    }

    grouped.set(name, current)
  }

  return [...grouped.values()]
    .map((setup) => ({
      ...setup,
      winRate: setup.closedCount > 0 ? (setup.wins / setup.closedCount) * 100 : null,
    }))
    .sort((a, b) => b.grossPnl - a.grossPnl)
}

export function buildAttentionSignals(metrics: Pick<CockpitMetrics, 'periodTrades' | 'activeTrades' | 'reviewItems' | 'chargesState' | 'grossPnl' | 'untaggedCount'>): CockpitSignal[] {
  const signals: CockpitSignal[] = []

  if (metrics.periodTrades.length === 0) {
    signals.push({ id: 'no-trades', tone: 'neutral', title: 'No trades in period', detail: 'Cockpit will populate once period trades exist.' })
  }

  if (metrics.chargesState === 'pending') {
    signals.push({ id: 'charges', tone: 'warning', title: 'Charges pending', detail: 'Net P&L withheld until daily charges are recorded.' })
  }

  if (metrics.activeTrades.length > 0) {
    signals.push({ id: 'open-risk', tone: 'info', title: 'Open exposure live', detail: `${metrics.activeTrades.length} open position${metrics.activeTrades.length === 1 ? '' : 's'} need monitoring.` })
  }

  const missingStopCount = metrics.activeTrades.filter((trade) => !trade.current_stop_price && !trade.stop_price).length
  if (missingStopCount > 0) {
    signals.push({ id: 'missing-stop', tone: 'loss', title: 'Protection SL missing', detail: `${missingStopCount} open trade${missingStopCount === 1 ? '' : 's'} without recorded SL.` })
  }

  if (metrics.untaggedCount > 0) {
    signals.push({ id: 'untagged', tone: 'warning', title: 'Setup context missing', detail: `${metrics.untaggedCount} trade${metrics.untaggedCount === 1 ? '' : 's'} need setup or tag context.` })
  }

  if ((metrics.grossPnl ?? 0) < 0) {
    signals.push({ id: 'period-loss', tone: 'loss', title: 'Period gross P&L negative', detail: 'Review losing trades before adding risk.' })
  }

  if (metrics.reviewItems.length > 0) {
    signals.push({ id: 'reviews', tone: 'accent', title: 'Action queue active', detail: `${metrics.reviewItems.length} review/action item${metrics.reviewItems.length === 1 ? '' : 's'} pending.` })
  }

  return signals.slice(0, 6)
}

/**
 * Charges state is determined by the DailyChargesSummary query, NOT by
 * per-trade fees. The daily charges ledger is the source of truth.
 */
export interface ChargesContext {
  /** From useDailyChargesSummary — null if query hasn't loaded yet. */
  chargesRecordedDays: number | null
  tradingDays: number | null
  missingDays: number | null
  /** Total recorded daily charges for the period (₹). null if none recorded. */
  totalCharges: number | null
  /** Gross realized P&L for the period from the charges ledger (recorded days). */
  grossRealizedPnl: number | null
  /** Net realized P&L from the ledger (gross − charges), only when complete. */
  netRealizedPnl: number | null
}

function resolveChargesState(
  periodTrades: ApiTrade[],
  charges: ChargesContext | null,
): 'recorded' | 'pending' | 'no_trades' {
  if (periodTrades.length === 0) return 'no_trades'
  if (!charges || charges.tradingDays == null) return 'pending'
  if (charges.tradingDays === 0) return 'no_trades'
  if (charges.missingDays != null && charges.missingDays === 0) return 'recorded'
  return 'pending'
}

export function buildCockpitMetrics(
  trades: ApiTrade[],
  period: CockpitPeriod,
  operational?: OperationalDashboardPayload,
  todayKey?: string,
  chargesContext?: ChargesContext | null,
): CockpitMetrics {
  const normalTrades = excludeDeletedTrades(trades)
  const periodTrades = filterTradesByPeriod(normalTrades, period, todayKey)
  const closedTrades = periodTrades.filter(isClosedTrade)
  const activeTrades = normalTrades.filter(isOpenTrade)

  // Gross P&L = realized P&L before daily charges = sum(pnl + fees).
  // Computed locally from fetched closed trades (period-filtered).
  const grossPnl = calculateGrossPnl(closedTrades)

  // Charges come from the daily charges LEDGER (source of truth), NOT per-trade fees.
  const chargesState = resolveChargesState(periodTrades, chargesContext ?? null)
  const recordedFees = chargesContext?.totalCharges ?? null

  // Net P&L = Gross − recorded daily charges, only when all trading days have charges.
  const netPnlState = periodTrades.length === 0 ? 'no_trades' : chargesState === 'recorded' ? 'available' : 'pending_charges'
  const netPnl = netPnlState === 'available'
    ? (chargesContext?.netRealizedPnl != null
        ? chargesContext.netRealizedPnl
        : grossPnl != null && recordedFees != null
          ? grossPnl - recordedFees
          : null)
    : null

  const openRisk = calculateOpenRisk(activeTrades, operational)

  // For 'all' period prefer backend KPI (covers ALL trades, not the 200-row fetch cap).
  const useBackendKpi = period === 'all' && operational?.kpi != null
  const kpi = operational?.kpi

  const winRate = useBackendKpi && kpi!.win_rate != null
    ? kpi!.win_rate
    : calculateWinRate(periodTrades)

  const avgR = useBackendKpi && kpi!.avg_r_multiple != null
    ? kpi!.avg_r_multiple
    : calculateAvgR(periodTrades)

  const untaggedCount = getUntaggedCount(periodTrades)
  const reviewItems = buildReviewItems(periodTrades, activeTrades, chargesState === 'pending')
  const setupSummaries = groupSetups(periodTrades)
  const attentionSignals = buildAttentionSignals({
    periodTrades,
    activeTrades,
    reviewItems,
    chargesState,
    grossPnl,
    untaggedCount,
  })

  return {
    periodTrades,
    activeTrades,
    closedTrades,
    deletedExcludedCount: trades.length - normalTrades.length,
    grossPnl,
    recordedFees,
    hasRecordedFees: (recordedFees ?? 0) > 0,
    chargesState,
    netPnlState,
    netPnl,
    openRisk,
    winRate,
    avgR,
    reviewItems,
    attentionSignals,
    setupSummaries,
    untaggedCount,
  }
}
