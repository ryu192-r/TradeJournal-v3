import { describe, expect, it } from 'vitest'
import { reportPeriodToRange, getPeriodLabel } from '../utils/reportPeriods'
import { buildDailyRows, summarizeDaily } from '../utils/reportDaily'
import { filterBySessionRange } from '../../analytics/utils/analyticsMetrics'
import type { ApiTrade, DailyChargesDaySummary } from '@/types'

describe('reportPeriodToRange', () => {
  it('today period returns same date for start/end', () => {
    const [s, e] = reportPeriodToRange('today', '2025-06-15')
    expect(s).toBe('2025-06-15')
    expect(e).toBe('2025-06-15')
  })

  it('month period starts at month-01', () => {
    const [s, e] = reportPeriodToRange('month', '2025-06-15')
    expect(s).toBe('2025-06-01')
    expect(e).toBe('2025-06-15')
  })

  it('30d period 30 days back', () => {
    const [s, e] = reportPeriodToRange('30d', '2025-06-15')
    expect(s).toBe('2025-05-16')
    expect(e).toBe('2025-06-15')
  })

  it('90d period 90 days back', () => {
    const [s] = reportPeriodToRange('90d', '2025-06-15')
    expect(s).toBe('2025-03-17')
  })

  it('week period starts on Monday', () => {
    const [s] = reportPeriodToRange('week', '2025-06-15') // Sunday
    expect(s).toBe('2025-06-09') // Monday
  })

  it('getPeriodLabel returns label', () => {
    expect(getPeriodLabel('30d')).toBe('Last 30 days')
    expect(getPeriodLabel('today')).toBe('Today')
  })
})

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '100', exit_price: '110',
    quantity: '10', entry_time: '2025-06-01T09:30:00', exit_time: '2025-06-01T15:00:00',
    fees: '0', notes: null, tags: null, setup: null, tactic: null, stop_price: null,
    target_price: null, r_multiple: null, status: 'closed', pnl: '100', remaining_qty: '0',
    ...o,
  }
}

describe('report trade range alignment', () => {
  it('excludes closed trades outside the 30d charges range', () => {
    const [start, end] = reportPeriodToRange('30d', '2025-06-15')
    const filtered = filterBySessionRange([
      trade({ id: 1, exit_time: '2025-05-15T15:00:00' }),
      trade({ id: 2, exit_time: '2025-05-16T15:00:00' }),
    ], start, end)

    expect(filtered.map((t) => t.id)).toEqual([2])
  })

  it('excludes closed trades outside the 90d charges range', () => {
    const [start, end] = reportPeriodToRange('90d', '2025-06-15')
    const filtered = filterBySessionRange([
      trade({ id: 1, exit_time: '2025-03-16T15:00:00' }),
      trade({ id: 2, exit_time: '2025-03-17T15:00:00' }),
    ], start, end)

    expect(filtered.map((t) => t.id)).toEqual([2])
  })

  it('uses realized exit date so trade metrics align with charge summary range', () => {
    const [start, end] = reportPeriodToRange('today', '2025-06-15')
    const filtered = filterBySessionRange([
      trade({ id: 1, entry_time: '2025-06-14T09:30:00', exit_time: '2025-06-15T15:00:00' }),
      trade({ id: 2, entry_time: '2025-06-15T09:30:00', exit_time: '2025-06-16T15:00:00' }),
    ], start, end)

    expect(filtered.map((t) => t.id)).toEqual([1])
  })
})

function day(o: Partial<DailyChargesDaySummary> = {}): DailyChargesDaySummary {
  return {
    trade_date: '2025-06-01', gross_realized_pnl: '500', charges_recorded: false,
    total_charges: null, net_realized_pnl: null, trade_count: 2, entry_mode: null, broker: null, ...o,
  }
}

describe('buildDailyRows', () => {
  it('marks pending when charges not recorded and trades exist', () => {
    const rows = buildDailyRows([day({ trade_count: 2, charges_recorded: false })])
    expect(rows[0].status).toBe('pending')
    expect(rows[0].chargesRecorded).toBe(false)
    expect(rows[0].totalCharges).toBeNull()
    expect(rows[0].netPnl).toBeNull()
  })

  it('marks complete when charges recorded', () => {
    const rows = buildDailyRows([day({
      trade_count: 2, charges_recorded: true, total_charges: '20', net_realized_pnl: '480',
    })])
    expect(rows[0].status).toBe('complete')
    expect(rows[0].totalCharges).toBe(20)
    expect(rows[0].netPnl).toBe(480)
  })

  it('marks no_trades when trade_count is 0', () => {
    const rows = buildDailyRows([day({ trade_count: 0 })])
    expect(rows[0].status).toBe('no_trades')
  })

  it('does not show ₹0 for missing charges (null instead)', () => {
    const rows = buildDailyRows([day({ trade_count: 1, charges_recorded: false, total_charges: '0' })])
    expect(rows[0].totalCharges).toBeNull()
  })

  it('sorts rows by date desc', () => {
    const rows = buildDailyRows([day({ trade_date: '2025-06-01' }), day({ trade_date: '2025-06-03' }), day({ trade_date: '2025-06-02' })])
    expect(rows.map((r) => r.date)).toEqual(['2025-06-03', '2025-06-02', '2025-06-01'])
  })

  it('handles empty input', () => {
    expect(buildDailyRows([])).toEqual([])
  })
})

describe('summarizeDaily', () => {
  it('counts trading days, complete, pending', () => {
    const rows = buildDailyRows([
      day({ trade_date: '2025-06-01', trade_count: 2, charges_recorded: true }),
      day({ trade_date: '2025-06-02', trade_count: 1, charges_recorded: false }),
      day({ trade_date: '2025-06-03', trade_count: 0, charges_recorded: false }),
    ])
    const s = summarizeDaily(rows)
    expect(s.totalDays).toBe(3)
    expect(s.tradingDays).toBe(2)
    expect(s.completeDays).toBe(1)
    expect(s.pendingDays).toBe(1)
  })

  it('handles empty', () => {
    expect(summarizeDaily([])).toEqual({ totalDays: 0, tradingDays: 0, completeDays: 0, pendingDays: 0 })
  })
})
