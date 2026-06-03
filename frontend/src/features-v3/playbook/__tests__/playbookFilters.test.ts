import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import type { SetupPlaybookItem } from '@/types/setupPlaybook'
import { combineSetups } from '../utils/playbookGrouping'
import { applyPlaybookFilters } from '../utils/playbookFilters'

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: '2025-06-03T15:00:00', fees: '10',
    notes: null, tags: null, setup: 'Pullback', tactic: null, stop_price: '2450',
    target_price: null, r_multiple: '1.5', status: 'closed', pnl: '990', remaining_qty: '0',
    review_notes: null, review_tags: null, ...o,
  }
}

function pb(o: Partial<SetupPlaybookItem> = {}): SetupPlaybookItem {
  return {
    id: 1, name: 'Pullback', description: null,
    tactics: [], ideal_conditions: [], risk_profile: {}, rules: [],
    win_rate: null, avg_r: null, trade_count: 0, is_active: 'active',
    created_at: '2025-01-01T00:00:00', updated_at: '2025-01-01T00:00:00', ...o,
  }
}

describe('applyPlaybookFilters', () => {
  const entries = combineSetups(
    [
      pb({ id: 1, name: 'Pullback', description: 'pullback to support', is_active: 'active' }),
      pb({ id: 2, name: 'Reversal', description: null, is_active: 'archived' }),
      pb({ id: 3, name: 'Empty', is_active: 'active' }),
    ],
    [
      trade({ id: 1, setup: 'Pullback', pnl: '500', fees: '0' }),
      trade({ id: 2, setup: 'Reversal', pnl: '-200', fees: '0' }),
      trade({ id: 3, setup: 'Episodic', pnl: '300', fees: '0' }),
      trade({ id: 4, setup: null }),
    ],
  )

  it('search matches name', () => {
    const r = applyPlaybookFilters(entries, { search: 'pull', filter: 'all' })
    expect(r.map((e) => e.name)).toEqual(['Pullback'])
  })

  it('search matches description (case-insensitive)', () => {
    const r = applyPlaybookFilters(entries, { search: 'SUPPORT', filter: 'all' })
    expect(r.map((e) => e.name)).toEqual(['Pullback'])
  })

  it('all filter includes everything (including untagged)', () => {
    const r = applyPlaybookFilters(entries, { search: '', filter: 'all' })
    expect(r.length).toBe(entries.length)
  })

  it('untagged filter shows only the Untagged bucket', () => {
    const r = applyPlaybookFilters(entries, { search: '', filter: 'untagged' })
    expect(r.map((e) => e.origin)).toEqual(['untagged'])
  })

  it('archived filter only shows archived backend records', () => {
    const r = applyPlaybookFilters(entries, { search: '', filter: 'archived' })
    expect(r.map((e) => e.name)).toEqual(['Reversal'])
  })

  it('active filter shows active backend + trade-derived', () => {
    const r = applyPlaybookFilters(entries, { search: '', filter: 'active' })
    const names = r.map((e) => e.name).sort()
    expect(names).toEqual(['Empty', 'Episodic', 'Pullback'])
  })

  it('profitable filter shows only entries with positive gross P&L', () => {
    const r = applyPlaybookFilters(entries, { search: '', filter: 'profitable' })
    const names = r.map((e) => e.name).sort()
    expect(names).toEqual(['Episodic', 'Pullback'])
  })

  it('losing filter shows only entries with negative gross P&L', () => {
    const r = applyPlaybookFilters(entries, { search: '', filter: 'losing' })
    expect(r.map((e) => e.name)).toEqual(['Reversal'])
  })

  it('no-trades filter shows backend records with zero trades', () => {
    const r = applyPlaybookFilters(entries, { search: '', filter: 'no-trades' })
    expect(r.map((e) => e.name)).toEqual(['Empty'])
  })

  it('not-enough-data filter shows entries with < 3 closed trades', () => {
    const r = applyPlaybookFilters(entries, { search: '', filter: 'not-enough-data' })
    // Pullback (1), Reversal (1), Episodic (1) all qualify; Empty has 0; Untagged has 0.
    const names = r.map((e) => e.name).sort()
    expect(names).toEqual(['Episodic', 'Pullback', 'Reversal'])
  })

  it('needs-review filter shows entries with pending review > 0', () => {
    // All trades above have review_notes = null, so all closed-trade entries should qualify.
    const r = applyPlaybookFilters(entries, { search: '', filter: 'needs-review' })
    const names = r.map((e) => e.name).sort()
    expect(names).toEqual(['Episodic', 'Pullback', 'Reversal'])
  })

  it('search + filter combine correctly', () => {
    const r = applyPlaybookFilters(entries, { search: 'rev', filter: 'archived' })
    expect(r.map((e) => e.name)).toEqual(['Reversal'])
  })
})
