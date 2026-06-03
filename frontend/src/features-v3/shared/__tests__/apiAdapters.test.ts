import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import { normalizeTradeListResponse } from '../apiAdapters'

function trade(id: number): ApiTrade {
  return {
    id,
    symbol: 'RELIANCE',
    direction: 'LONG',
    entry_price: '2500',
    exit_price: null,
    quantity: '10',
    entry_time: '2026-06-03T09:20:00',
    exit_time: null,
    fees: '0',
    notes: null,
    tags: null,
    setup: null,
    tactic: null,
    stop_price: null,
    target_price: null,
    r_multiple: null,
    status: 'open',
  }
}

describe('V3 API adapters', () => {
  it('normalizes direct array trade response', () => {
    const result = normalizeTradeListResponse([trade(1), trade(2)])

    expect(result.items.map((item) => item.id)).toEqual([1, 2])
    expect(result.total).toBe(2)
  })

  it('normalizes current paginated trade response', () => {
    const result = normalizeTradeListResponse({ items: [trade(3)], total: 12 })

    expect(result.items.map((item) => item.id)).toEqual([3])
    expect(result.total).toBe(12)
  })

  it('normalizes nested trade response without inventing records', () => {
    const result = normalizeTradeListResponse({ data: { trades: [trade(4)] } })

    expect(result.items.map((item) => item.id)).toEqual([4])
    expect(result.total).toBe(1)
  })

  it('returns empty only for successful non-list shapes', () => {
    const result = normalizeTradeListResponse({ ok: true })

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })
})
