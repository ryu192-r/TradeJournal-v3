import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import { buildTradeDetailTimeline } from '../utils/tradeDetailV3Timeline'

function trade(overrides: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1,
    symbol: 'RELIANCE',
    direction: 'LONG',
    entry_price: '2500',
    exit_price: '2600',
    quantity: '10',
    entry_time: '2026-06-03T09:25:00',
    exit_time: '2026-06-03T15:10:00',
    fees: '10',
    notes: null,
    tags: [],
    setup: 'ORB',
    tactic: null,
    original_stop_price: '2450',
    current_stop_price: '2520',
    stop_loss_status: 'trailing',
    stop_price: '2520',
    target_price: null,
    r_multiple: '1.2',
    status: 'closed',
    pnl: '990',
    remaining_qty: '0',
    partial_realized_pnl: null,
    ...overrides,
  }
}

describe('tradeDetailV3Timeline', () => {
  it('orders available events chronologically', () => {
    const events = buildTradeDetailTimeline(
      trade(),
      [{ id: 1, trade_id: 1, stop_type: 'manual', price: '2510', timestamp: '2026-06-03T11:00:00' }],
      [{ id: 2, trade_id: 1, qty: '5', exit_price: '2580', exit_time: '2026-06-03T12:00:00', realized_pnl: '400', r_captured: null, exit_reason: null, note: null }],
      [],
    )

    expect(events.map((event) => event.kind)).toEqual(['entry', 'stop', 'partial', 'exit', 'review'])
    expect(events[0]?.timestamp).toBe('2026-06-03T09:25:00')
    expect(events[events.length - 1]?.timestamp).toBe('2026-06-03T15:10:00')
  })

  it('does not invent timeline API events', () => {
    const events = buildTradeDetailTimeline(trade({ review_notes: 'Done' }), [], [], [])
    expect(events.some((event) => event.kind === 'timeline')).toBe(false)
  })

  it('marks deleted trades', () => {
    const events = buildTradeDetailTimeline(trade({ status: 'deleted' }), [], [], [])
    expect(events.some((event) => event.label === 'Deleted')).toBe(true)
  })
})
