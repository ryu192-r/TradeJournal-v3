import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import { isReviewed, isReviewable, getReviewStatus } from '../utils/reviewStatus'
import { filterReviewTrades, summarizeReview } from '../utils/reviewFilters'
import { todaySessionDate } from '@/utils/tradeDates'

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: '2025-06-03T15:00:00', fees: '10',
    notes: null, tags: null, setup: 'ORB', tactic: null, stop_price: '2450', target_price: null,
    r_multiple: '1.5', status: 'closed', pnl: '990', remaining_qty: '0',
    review_notes: null, review_tags: null, ...o,
  }
}

describe('reviewStatus', () => {
  it('isReviewed true when review_notes present', () => {
    expect(isReviewed(trade({ review_notes: 'Good trade' }))).toBe(true)
    expect(isReviewed(trade({ review_notes: '  ' }))).toBe(false)
    expect(isReviewed(trade({ review_notes: null }))).toBe(false)
  })

  it('isReviewable only for closed non-deleted', () => {
    expect(isReviewable(trade({ status: 'closed' }))).toBe(true)
    expect(isReviewable(trade({ status: 'open', exit_price: null }))).toBe(false)
    expect(isReviewable(trade({ status: 'deleted' }))).toBe(false)
  })

  it('getReviewStatus reflects state', () => {
    expect(getReviewStatus(trade({ review_notes: 'x' }))).toBe('reviewed')
    expect(getReviewStatus(trade({ review_notes: null }))).toBe('pending')
    expect(getReviewStatus(trade({ status: 'open', exit_price: null }))).toBe('not_applicable')
  })
})

describe('filterReviewTrades', () => {
  const trades = [
    trade({ id: 1, review_notes: null, pnl: '100' }),       // pending winner
    trade({ id: 2, review_notes: 'done', pnl: '-50' }),      // reviewed loser
    trade({ id: 3, status: 'open', exit_price: null }),      // not reviewable
    trade({ id: 4, status: 'deleted' }),                     // excluded
    trade({ id: 5, review_notes: null, setup: null, tags: null, pnl: '20' }), // untagged
  ]

  it('pending filter', () => {
    const r = filterReviewTrades(trades, 'pending').map((t) => t.id)
    expect(r).toContain(1)
    expect(r).toContain(5)
    expect(r).not.toContain(2)
    expect(r).not.toContain(3)
    expect(r).not.toContain(4)
  })

  it('reviewed filter', () => {
    expect(filterReviewTrades(trades, 'reviewed').map((t) => t.id)).toEqual([2])
  })

  it('winners filter', () => {
    const r = filterReviewTrades(trades, 'winners').map((t) => t.id)
    expect(r).toContain(1)
    expect(r).not.toContain(2)
  })

  it('losers filter', () => {
    expect(filterReviewTrades(trades, 'losers').map((t) => t.id)).toEqual([2])
  })

  it('untagged filter', () => {
    expect(filterReviewTrades(trades, 'untagged').map((t) => t.id)).toEqual([5])
  })

  it('unclassified filter returns trades with null entry_context', () => {
    const mixed = [
      trade({ id: 10, entry_context: null }),
      trade({ id: 11, entry_context: 'planned' }),
      trade({ id: 12, entry_context: 'impulse' }),
    ]
    expect(filterReviewTrades(mixed, 'unclassified').map((t) => t.id)).toEqual([10])
  })

  it('excludes deleted and open everywhere', () => {
    const ids = filterReviewTrades(trades, 'pending').map((t) => t.id)
    expect(ids).not.toContain(3)
    expect(ids).not.toContain(4)
  })

  it('today filter uses session date', () => {
    const today = todaySessionDate()
    const r = filterReviewTrades([trade({ id: 9, entry_time: `${today}T10:00:00`, review_notes: null })], 'today')
    expect(r.map((t) => t.id)).toEqual([9])
  })
})

describe('summarizeReview', () => {
  it('counts pending/reviewed/unclassified/total of reviewable trades', () => {
    const trades = [
      trade({ id: 1, review_notes: null }),
      trade({ id: 2, review_notes: 'x', entry_context: 'planned' }),
      trade({ id: 3, status: 'open', exit_price: null }),
      trade({ id: 4, status: 'deleted' }),
    ]
    expect(summarizeReview(trades)).toEqual({ pending: 1, reviewed: 1, unclassified: 1, total: 2 })
  })

  it('handles empty', () => {
    expect(summarizeReview([])).toEqual({ pending: 0, reviewed: 0, unclassified: 0, total: 0 })
  })
})
