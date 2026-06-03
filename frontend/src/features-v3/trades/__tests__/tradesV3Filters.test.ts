import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import { DEFAULT_TRADES_V3_FILTERS } from '../hooks/useTradesV3Filters'
import { applyTradesV3Filters, filterTrades, sortTrades } from '../utils/tradesV3Filters'

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
    r_multiple: overrides.r_multiple ?? '1',
    status: overrides.status ?? 'closed',
    pnl: overrides.pnl ?? '90',
    ...overrides,
  } as ApiTrade
}

describe('Trades v3 filters', () => {
  it('filters search by symbol', () => {
    const result = filterTrades([
      trade({ id: 1, symbol: 'RELIANCE' }),
      trade({ id: 2, symbol: 'TCS' }),
    ], { ...DEFAULT_TRADES_V3_FILTERS, search: 'rel' })

    expect(result.map((item) => item.symbol)).toEqual(['RELIANCE'])
  })

  it('filters by status', () => {
    const result = filterTrades([
      trade({ id: 1, status: 'open', exit_price: null }),
      trade({ id: 2, status: 'closed' }),
    ], { ...DEFAULT_TRADES_V3_FILTERS, status: 'open' })

    expect(result.map((item) => item.id)).toEqual([1])
  })

  it('includes deleted only when deleted status is selected', () => {
    const trades = [trade({ id: 1 }), trade({ id: 2, status: 'deleted' })]

    expect(filterTrades(trades, DEFAULT_TRADES_V3_FILTERS).map((item) => item.id)).toEqual([1])
    expect(filterTrades(trades, { ...DEFAULT_TRADES_V3_FILTERS, status: 'deleted' }).map((item) => item.id)).toEqual([2])
  })

  it('sorts newest and oldest', () => {
    const trades = [
      trade({ id: 1, entry_time: '2026-06-01T09:20:00' }),
      trade({ id: 2, entry_time: '2026-06-03T09:20:00' }),
    ]

    expect(sortTrades(trades, 'newest').map((item) => item.id)).toEqual([2, 1])
    expect(sortTrades(trades, 'oldest').map((item) => item.id)).toEqual([1, 2])
  })

  it('sorts P&L high and low', () => {
    const trades = [
      trade({ id: 1, pnl: '50', fees: '0' }),
      trade({ id: 2, pnl: '150', fees: '0' }),
    ]

    expect(sortTrades(trades, 'pnl_high').map((item) => item.id)).toEqual([2, 1])
    expect(sortTrades(trades, 'pnl_low').map((item) => item.id)).toEqual([1, 2])
  })

  it('applies period filtering', () => {
    const result = applyTradesV3Filters([
      trade({ id: 1, entry_time: '2026-06-03T09:20:00' }),
      trade({ id: 2, entry_time: '2026-06-02T09:20:00' }),
    ], { ...DEFAULT_TRADES_V3_FILTERS, period: 'today' }, '2026-06-03')

    expect(result.map((item) => item.id)).toEqual([1])
  })
})
