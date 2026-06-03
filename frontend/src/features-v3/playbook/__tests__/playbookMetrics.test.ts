import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import type { SetupPlaybookItem } from '@/types/setupPlaybook'
import {
  computeReviewInsights,
  computeSetupPerformance,
  summarizeLibrary,
} from '../utils/playbookMetrics'
import { combineSetups } from '../utils/playbookGrouping'

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: '2025-06-03T15:00:00', fees: '10',
    notes: null, tags: null, setup: 'Episodic Pivot', tactic: null, stop_price: '2450',
    target_price: null, r_multiple: '1.5', status: 'closed', pnl: '990', remaining_qty: '0',
    review_notes: null, review_tags: null, ...o,
  }
}

function pb(o: Partial<SetupPlaybookItem> = {}): SetupPlaybookItem {
  return {
    id: 1, name: 'Episodic Pivot', description: null,
    tactics: [], ideal_conditions: [], risk_profile: {}, rules: [],
    win_rate: null, avg_r: null, trade_count: 0, is_active: 'active',
    created_at: '2025-01-01T00:00:00', updated_at: '2025-01-01T00:00:00', ...o,
  }
}

describe('computeSetupPerformance', () => {
  it('returns empty performance for empty array', () => {
    const r = computeSetupPerformance([])
    expect(r).toEqual({
      totalTrades: 0, closedTrades: 0, openTrades: 0, grossPnl: 0,
      winRate: null, avgR: null, bestTrade: null, worstTrade: null,
      reviewedCount: 0, pendingReview: 0, lastTradedDate: null,
    })
  })

  it('excludes deleted trades from all counts', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, status: 'deleted' }),
      trade({ id: 2 }),
    ])
    expect(r.totalTrades).toBe(1)
    expect(r.closedTrades).toBe(1)
  })

  it('does not count open trades as realized wins/losses', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, status: 'open', exit_price: null, pnl: null, r_multiple: null }),
    ])
    expect(r.closedTrades).toBe(0)
    expect(r.openTrades).toBe(1)
    expect(r.grossPnl).toBe(0)
    expect(r.winRate).toBeNull()
    expect(r.avgR).toBeNull()
  })

  it('computes gross P&L from pnl + fees', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, pnl: '100', fees: '10' }),
      trade({ id: 2, pnl: '-50', fees: '5' }),
    ])
    expect(r.grossPnl).toBe(65)
  })

  it('computes win rate from closed trades only', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, pnl: '100', fees: '0' }),
      trade({ id: 2, pnl: '-50', fees: '0' }),
      trade({ id: 3, pnl: '200', fees: '0' }),
    ])
    expect(r.winRate).toBeCloseTo(66.6667, 3)
  })

  it('excludes missing R from avg R', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, r_multiple: '2' }),
      trade({ id: 2, r_multiple: null }),
      trade({ id: 3, r_multiple: '1' }),
    ])
    expect(r.avgR).toBe(1.5)
  })

  it('computes best/worst gross P&L', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, pnl: '500', fees: '0' }),
      trade({ id: 2, pnl: '-200', fees: '0' }),
      trade({ id: 3, pnl: '100', fees: '0' }),
    ])
    expect(r.bestTrade).toBe(500)
    expect(r.worstTrade).toBe(-200)
  })

  it('counts reviewed vs pending review', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, review_notes: 'done' }),
      trade({ id: 2, review_notes: null }),
      trade({ id: 3, review_notes: '   ' }),
    ])
    expect(r.reviewedCount).toBe(1)
    expect(r.pendingReview).toBe(2)
  })

  it('computes last traded date from most recent trade', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, entry_time: '2025-05-01T09:30:00', exit_time: '2025-05-01T15:00:00' }),
      trade({ id: 2, entry_time: '2025-06-15T09:30:00', exit_time: '2025-06-15T15:00:00' }),
    ])
    expect(r.lastTradedDate).toBe('2025-06-15')
  })

  it('produces no NaN with all null fields', () => {
    const r = computeSetupPerformance([
      trade({ id: 1, pnl: null, r_multiple: null, status: 'open', exit_price: null }),
    ])
    expect(Number.isNaN(r.grossPnl)).toBe(false)
    expect(r.winRate).toBeNull()
    expect(r.avgR).toBeNull()
  })
})

describe('summarizeLibrary', () => {
  it('handles empty entries', () => {
    const r = summarizeLibrary([])
    expect(r.totalSetups).toBe(0)
    expect(r.activeSetups).toBe(0)
    expect(r.untaggedTrades).toBe(0)
    expect(r.bestSetupName).toBeNull()
    expect(r.worstSetupName).toBeNull()
  })

  it('counts untagged separately and ranks by gross P&L', () => {
    const entries = combineSetups(
      [pb({ id: 1, name: 'A', is_active: 'active' }), pb({ id: 2, name: 'B', is_active: 'archived' })],
      [
        trade({ id: 1, setup: 'A', pnl: '500', fees: '0' }),
        trade({ id: 2, setup: 'B', pnl: '-200', fees: '0' }),
        trade({ id: 3, setup: null, pnl: '0', fees: '0' }),
      ],
    )
    const r = summarizeLibrary(entries)
    expect(r.totalSetups).toBe(2)
    expect(r.activeSetups).toBe(1)
    expect(r.archivedSetups).toBe(1)
    expect(r.untaggedTrades).toBe(1)
    expect(r.bestSetupName).toBe('A')
    expect(r.worstSetupName).toBe('B')
  })

  it('does not show worst when only one setup has data', () => {
    const entries = combineSetups(
      [pb({ id: 1, name: 'A' })],
      [trade({ id: 1, setup: 'A', pnl: '500', fees: '0' })],
    )
    const r = summarizeLibrary(entries)
    expect(r.bestSetupName).toBe('A')
    expect(r.worstSetupName).toBeNull()
  })
})

describe('computeReviewInsights', () => {
  it('returns empty insights with no trades', () => {
    const r = computeReviewInsights([])
    expect(r.reviewedCount).toBe(0)
    expect(r.pendingCount).toBe(0)
    expect(r.topTags).toEqual([])
    expect(r.recentNotes).toEqual([])
  })

  it('counts reviewed across reviewable trades only', () => {
    const r = computeReviewInsights([
      trade({ id: 1, review_notes: 'a' }),
      trade({ id: 2, review_notes: null }),
      trade({ id: 3, status: 'open', exit_price: null, pnl: null, review_notes: 'b' }),
    ])
    expect(r.reviewedCount).toBe(1)
    expect(r.pendingCount).toBe(1)
  })

  it('aggregates review tags by frequency', () => {
    const r = computeReviewInsights([
      trade({ id: 1, review_notes: 'x', review_tags: ['chased', 'good exit'] }),
      trade({ id: 2, review_notes: 'y', review_tags: ['chased'] }),
    ])
    expect(r.topTags[0]).toEqual({ tag: 'chased', count: 2 })
    expect(r.topTags.find((t) => t.tag === 'good exit')?.count).toBe(1)
  })

  it('returns recent excerpts sorted by session date desc', () => {
    const r = computeReviewInsights([
      trade({
        id: 1, symbol: 'A', review_notes: 'note A',
        entry_time: '2025-05-01T09:30:00', exit_time: '2025-05-01T15:00:00',
      }),
      trade({
        id: 2, symbol: 'B', review_notes: 'note B',
        entry_time: '2025-06-01T09:30:00', exit_time: '2025-06-01T15:00:00',
      }),
    ])
    expect(r.recentNotes[0].symbol).toBe('B')
    expect(r.recentNotes[1].symbol).toBe('A')
  })

  it('truncates long excerpts', () => {
    const long = 'x'.repeat(500)
    const r = computeReviewInsights([trade({ id: 1, review_notes: long })])
    expect(r.recentNotes[0].excerpt.endsWith('…')).toBe(true)
    expect(r.recentNotes[0].excerpt.length).toBeLessThanOrEqual(200)
  })

  it('skips empty review tags', () => {
    const r = computeReviewInsights([
      trade({ id: 1, review_notes: 'x', review_tags: ['', '  ', 'good'] }),
    ])
    expect(r.topTags).toEqual([{ tag: 'good', count: 1 }])
  })
})
