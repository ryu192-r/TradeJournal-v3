import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import {
  buildTradeQualityBadges,
  getTradeGrossPnl,
  isOpenTradeV3Wrapper,
  summarizeTrades,
} from '../utils/tradesV3Metrics'
import { safeNumber } from '../utils/tradesV3Formatters'

function trade(overrides: Partial<ApiTrade>): ApiTrade {
  return {
    id: overrides.id ?? 1,
    symbol: overrides.symbol ?? 'TCS',
    direction: overrides.direction ?? 'LONG',
    entry_price: overrides.entry_price ?? '100',
    exit_price: overrides.exit_price ?? '110',
    quantity: overrides.quantity ?? '10',
    entry_time: overrides.entry_time ?? '2026-06-03T09:20:00',
    exit_time: overrides.exit_time ?? '2026-06-03T15:10:00',
    fees: overrides.fees ?? '10',
    notes: overrides.notes ?? 'Reviewed',
    tags: overrides.tags ?? ['orb'],
    setup: overrides.setup ?? 'ORB',
    tactic: overrides.tactic ?? null,
    stop_price: overrides.stop_price ?? '95',
    target_price: overrides.target_price ?? null,
    r_multiple: overrides.r_multiple ?? '1.2',
    status: overrides.status ?? 'closed',
    pnl: overrides.pnl ?? '90',
    ...overrides,
  } as ApiTrade
}

describe('Trades v3 metrics', () => {
  it('excludes deleted trades from default summary', () => {
    const summary = summarizeTrades([
      trade({ id: 1, pnl: '90', fees: '10' }),
      trade({ id: 2, status: 'deleted', pnl: '999', fees: '1' }),
    ])

    expect(summary.total).toBe(1)
    expect(summary.deleted).toBe(1)
    expect(summary.grossPnl).toBe(100)
  })

  it('includes deleted trades only when requested', () => {
    const summary = summarizeTrades([trade({ status: 'deleted', pnl: '20', fees: '5' })], true)

    expect(summary.total).toBe(1)
    expect(summary.deleted).toBe(1)
  })

  it('open trade wrapper does not rely on exit_price null checks', () => {
    expect(isOpenTradeV3Wrapper(trade({ status: 'open', exit_price: '120', remaining_qty: '4' }))).toBe(true)
    expect(isOpenTradeV3Wrapper(trade({ status: 'closed', exit_price: null, remaining_qty: '4' }))).toBe(true)
    expect(isOpenTradeV3Wrapper(trade({ status: 'open', exit_price: '120', remaining_qty: '0' }))).toBe(false)
  })

  it('gross P&L fallback handles invalid values safely', () => {
    expect(getTradeGrossPnl(trade({ pnl: undefined, fees: '10' }))).toBeNull()
    expect(getTradeGrossPnl(trade({ pnl: Number.NaN as unknown as string, fees: '10' }))).toBeNull()
    expect(safeNumber('not-a-number')).toBeNull()
  })

  it('produces missing setup, notes, and SL badges from data', () => {
    const badges = buildTradeQualityBadges(trade({
      status: 'open',
      setup: '',
      tags: [],
      notes: '',
      review_notes: '',
      stop_price: null,
      current_stop_price: null,
      exit_price: null,
    })).map((badge) => badge.id)

    expect(badges).toContain('missing-setup')
    expect(badges).toContain('missing-notes')
    expect(badges).toContain('missing-sl')
  })
})
