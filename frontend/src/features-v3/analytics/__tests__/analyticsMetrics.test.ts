import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import { computePerformance, groupBySetup, groupByExchange, groupByProductType, buildChargesStatus, filterByPeriod } from '../utils/analyticsMetrics'

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: '2025-06-03T15:00:00', fees: '10',
    notes: null, tags: null, setup: 'ORB', tactic: null, stop_price: '2450', target_price: null,
    r_multiple: '1.5', status: 'closed', pnl: '990', remaining_qty: '0',
    review_notes: null, review_tags: null, exchange: 'NSE', segment: 'EQUITY', product_type: 'INTRADAY', ...o,
  }
}

describe('computePerformance', () => {
  it('excludes deleted trades', () => {
    const r = computePerformance([trade({ status: 'deleted' }), trade({ id: 2 })])
    expect(r.totalTrades).toBe(1)
  })

  it('does not count open trades as realized', () => {
    const r = computePerformance([trade({ status: 'open', exit_price: null, pnl: null })])
    expect(r.closedTrades).toBe(0)
    expect(r.openTrades).toBe(1)
    expect(r.grossPnl).toBe(0)
    expect(r.winRate).toBeNull()
  })

  it('computes gross P&L from closed trades', () => {
    const r = computePerformance([trade({ pnl: '100', fees: '10' }), trade({ id: 2, pnl: '-50', fees: '5' })])
    // grossPnl = pnl + fees for each => (100+10) + (-50+5) = 110 + (-45) = 65
    expect(r.grossPnl).toBe(65)
  })

  it('computes win rate correctly', () => {
    const r = computePerformance([trade({ pnl: '100', fees: '0' }), trade({ id: 2, pnl: '-50', fees: '0' })])
    expect(r.winRate).toBe(50)
  })

  it('computes average R excluding missing', () => {
    const r = computePerformance([trade({ r_multiple: '2' }), trade({ id: 2, r_multiple: null })])
    expect(r.avgR).toBe(2)
  })

  it('counts reviewed vs pending', () => {
    const r = computePerformance([trade({ review_notes: 'done' }), trade({ id: 2, review_notes: null })])
    expect(r.reviewedCount).toBe(1)
    expect(r.pendingReview).toBe(1)
  })

  it('handles empty', () => {
    const r = computePerformance([])
    expect(r.totalTrades).toBe(0)
    expect(r.winRate).toBeNull()
    expect(r.avgR).toBeNull()
  })
})

describe('groupBySetup', () => {
  it('groups by setup with Untagged fallback', () => {
    const r = groupBySetup([trade({ setup: 'ORB' }), trade({ id: 2, setup: null })])
    expect(r.map((g) => g.label).sort()).toEqual(['ORB', 'Untagged'])
  })

  it('excludes deleted/open', () => {
    const r = groupBySetup([trade({ status: 'deleted' }), trade({ status: 'open', exit_price: null, pnl: null })])
    expect(r.length).toBe(0)
  })
})

describe('groupByExchange', () => {
  it('groups by exchange', () => {
    const r = groupByExchange([trade({ exchange: 'NSE' }), trade({ id: 2, exchange: 'BSE' })])
    expect(r.map((g) => g.label).sort()).toEqual(['BSE', 'NSE'])
  })
})

describe('groupByProductType', () => {
  it('groups by product', () => {
    const r = groupByProductType([trade({ product_type: 'INTRADAY' }), trade({ id: 2, product_type: 'DELIVERY' })])
    expect(r.length).toBe(2)
  })
})

describe('buildChargesStatus', () => {
  it('returns incomplete when missing days > 0', () => {
    const r = buildChargesStatus({ gross_realized_pnl: '1000', total_charges: '50', net_realized_pnl: '950', charges_recorded_days: 3, trading_days: 5, missing_charge_days: 2 })
    expect(r.isComplete).toBe(false)
    expect(r.netPnl).toBeNull() // not shown when incomplete
    expect(r.missingDays).toBe(2)
  })

  it('returns complete with net when no missing days', () => {
    const r = buildChargesStatus({ gross_realized_pnl: '1000', total_charges: '50', net_realized_pnl: '950', charges_recorded_days: 5, trading_days: 5, missing_charge_days: 0 })
    expect(r.isComplete).toBe(true)
    expect(r.netPnl).toBe(950)
  })

  it('handles null summary', () => {
    const r = buildChargesStatus(null)
    expect(r.isComplete).toBe(false)
    expect(r.grossPnl).toBeNull()
  })
})

describe('filterByPeriod', () => {
  it('excludes deleted', () => {
    expect(filterByPeriod([trade({ status: 'deleted' })], 'all').length).toBe(0)
  })

  it('all period includes everything non-deleted', () => {
    expect(filterByPeriod([trade(), trade({ id: 2, status: 'open', exit_price: null })], 'all').length).toBe(2)
  })
})
