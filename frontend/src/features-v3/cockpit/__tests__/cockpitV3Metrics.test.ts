import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import { filterTradesByPeriod, isOpenTrade } from '../utils/cockpitFilters'
import {
  buildAttentionSignals,
  buildCockpitMetrics,
  calculateGrossPnl,
  safeNumber,
} from '../utils/cockpitMetrics'

function trade(overrides: Partial<ApiTrade>): ApiTrade {
  return {
    id: overrides.id ?? 1,
    symbol: overrides.symbol ?? 'TCS',
    entry_time: overrides.entry_time ?? '2026-06-03T09:20:00',
    entry_price: overrides.entry_price ?? '100',
    quantity: overrides.quantity ?? '10',
    direction: overrides.direction ?? 'LONG',
    status: overrides.status ?? 'closed',
    ...overrides,
  } as ApiTrade
}

describe('Cockpit v3 metrics', () => {
  it('excludes deleted trades from normal metrics', () => {
    const metrics = buildCockpitMetrics([
      trade({ id: 1, pnl: '100', fees: '10', status: 'closed' }),
      trade({ id: 2, pnl: '999', fees: '1', status: 'deleted' }),
    ], 'all')

    expect(metrics.deletedExcludedCount).toBe(1)
    expect(metrics.periodTrades).toHaveLength(1)
    expect(metrics.grossPnl).toBe(110)
  })

  it('uses status and remaining quantity wrapper for open trades, not exit price null checks', () => {
    expect(isOpenTrade(trade({ status: 'open', exit_price: '120', remaining_qty: '5' }))).toBe(true)
    expect(isOpenTrade(trade({ status: 'closed', exit_price: null, remaining_qty: '5' }))).toBe(true)
    expect(isOpenTrade(trade({ status: 'open', exit_price: '120', remaining_qty: '0' }))).toBe(false)
  })

  it('keeps missing charges pending and does not fake net P&L', () => {
    // No chargesContext passed → defaults to pending (ledger not loaded)
    const metrics = buildCockpitMetrics([trade({ pnl: '500', fees: undefined, status: 'closed' })], 'all')

    expect(metrics.chargesState).toBe('pending')
    expect(metrics.netPnlState).toBe('pending_charges')
    expect(metrics.netPnl).toBeNull()
  })

  it('renders charges as recorded when daily charges ledger reports no missing days', () => {
    const metrics = buildCockpitMetrics(
      [trade({ pnl: '450', fees: '50', status: 'closed' })],
      'all',
      undefined,
      undefined,
      { chargesRecordedDays: 1, tradingDays: 1, missingDays: 0, totalCharges: 100, grossRealizedPnl: 500, netRealizedPnl: 400 },
    )

    expect(metrics.chargesState).toBe('recorded')
    expect(metrics.recordedFees).toBe(100) // from daily charges ledger, not trade fees
    expect(metrics.netPnlState).toBe('available')
    expect(metrics.netPnl).toBe(400) // ledger net
    expect(calculateGrossPnl(metrics.closedTrades)).toBe(500)
  })

  it('charges remain pending when ledger has missing days', () => {
    const metrics = buildCockpitMetrics(
      [trade({ pnl: '450', fees: '50', status: 'closed' })],
      'all',
      undefined,
      undefined,
      { chargesRecordedDays: 1, tradingDays: 3, missingDays: 2, totalCharges: 100, grossRealizedPnl: 500, netRealizedPnl: null },
    )

    expect(metrics.chargesState).toBe('pending')
    expect(metrics.netPnlState).toBe('pending_charges')
    expect(metrics.netPnl).toBeNull()
  })

  it('gross P&L is realized pnl + fees, never inflated by adding abs losses', () => {
    // Two trades: +1000 win, -400 loss. Gross = 600 (NOT 1400).
    const metrics = buildCockpitMetrics([
      trade({ id: 1, pnl: '1000', fees: '0', status: 'closed' }),
      trade({ id: 2, pnl: '-400', fees: '0', status: 'closed' }),
    ], 'all')

    expect(metrics.grossPnl).toBe(600)
  })

  it('keeps invalid numeric values safe', () => {
    expect(safeNumber(null)).toBeNull()
    expect(safeNumber(undefined)).toBeNull()
    expect(safeNumber(Number.NaN)).toBeNull()
    expect(safeNumber('not-a-number')).toBeNull()
    expect(safeNumber('₹1,250')).toBe(1250)
  })

  it('returns setup empty state data when setup fields are missing', () => {
    const metrics = buildCockpitMetrics([trade({ setup: '', tags: [], pnl: '100', fees: '10' })], 'all')

    expect(metrics.setupSummaries).toHaveLength(0)
    expect(metrics.untaggedCount).toBe(1)
  })

  it('keeps review action center empty when notes/setup/stops are present', () => {
    const metrics = buildCockpitMetrics(
      [trade({ review_notes: 'Reviewed', notes: 'Plan followed', setup: 'ORB', tags: ['orb'], pnl: '100', fees: '10' })],
      'all',
      undefined,
      undefined,
      { chargesRecordedDays: 1, tradingDays: 1, missingDays: 0, totalCharges: 10, grossRealizedPnl: 110, netRealizedPnl: 100 },
    )

    expect(metrics.reviewItems).toHaveLength(0)
  })

  it('win rate uses GROSS P&L (pnl + fees) for win detection', () => {
    // Trade: pnl=-5 (net), fees=10. Gross = -5 + 10 = +5 → WIN
    const metrics = buildCockpitMetrics([
      trade({ pnl: '-5', fees: '10', status: 'closed' }),
    ], 'all')

    expect(metrics.winRate).toBe(100) // gross-profitable = win
  })

  it('builds data-backed attention signals only from supplied metrics', () => {
    const signals = buildAttentionSignals({
      periodTrades: [],
      activeTrades: [],
      reviewItems: [],
      chargesState: 'no_trades',
      grossPnl: null,
      untaggedCount: 0,
    })

    expect(signals).toEqual([
      { id: 'no-trades', tone: 'neutral', title: 'No trades in period', detail: 'Cockpit will populate once period trades exist.' },
    ])
  })

  it('filters period trades by session date', () => {
    const trades = [
      trade({ id: 1, entry_time: '2026-06-03T09:20:00' }),
      trade({ id: 2, entry_time: '2026-06-02T09:20:00' }),
    ]

    expect(filterTradesByPeriod(trades, 'today', '2026-06-03').map((item) => item.id)).toEqual([1])
  })
})
