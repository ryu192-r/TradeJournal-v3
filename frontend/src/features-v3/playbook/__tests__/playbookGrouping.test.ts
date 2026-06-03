import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import type { SetupPlaybookItem } from '@/types/setupPlaybook'
import { combineSetups, UNTAGGED_KEY, UNTAGGED_LABEL } from '../utils/playbookGrouping'

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: '2025-06-03T15:00:00', fees: '10',
    notes: null, tags: null, setup: 'Episodic Pivot', tactic: null, stop_price: '2450',
    target_price: null, r_multiple: '1.5', status: 'closed', pnl: '990', remaining_qty: '0',
    review_notes: null, review_tags: null, ...o,
  }
}

function playbook(o: Partial<SetupPlaybookItem> = {}): SetupPlaybookItem {
  return {
    id: 1, name: 'Episodic Pivot', description: null,
    tactics: [], ideal_conditions: [], risk_profile: {}, rules: [],
    win_rate: null, avg_r: null, trade_count: 0, is_active: 'active',
    created_at: '2025-01-01T00:00:00', updated_at: '2025-01-01T00:00:00', ...o,
  }
}

describe('combineSetups', () => {
  it('returns empty array when no playbooks and no trades', () => {
    expect(combineSetups([], [])).toEqual([])
  })

  it('keeps backend playbook with zero trades', () => {
    const r = combineSetups([playbook({ id: 1, name: 'Episodic Pivot' })], [])
    expect(r).toHaveLength(1)
    expect(r[0].origin).toBe('playbook')
    expect(r[0].name).toBe('Episodic Pivot')
    expect(r[0].trades).toEqual([])
    expect(r[0].id).toBe(1)
  })

  it('attaches trades to matching backend playbook by name', () => {
    const r = combineSetups(
      [playbook({ id: 1, name: 'Episodic Pivot' })],
      [trade({ id: 11, setup: 'Episodic Pivot' }), trade({ id: 12, setup: 'Episodic Pivot' })],
    )
    expect(r).toHaveLength(1)
    expect(r[0].trades).toHaveLength(2)
  })

  it('groups trade-derived setups when no backend record exists', () => {
    const r = combineSetups([], [trade({ id: 11, setup: 'Custom Setup' })])
    expect(r).toHaveLength(1)
    expect(r[0].origin).toBe('trade-derived')
    expect(r[0].id).toBeNull()
    expect(r[0].name).toBe('Custom Setup')
    expect(r[0].key).toBe('derived:Custom Setup')
  })

  it('creates Untagged bucket for trades with no setup', () => {
    const r = combineSetups([], [trade({ id: 11, setup: null }), trade({ id: 12, setup: '   ' })])
    const untagged = r.find((e) => e.origin === 'untagged')
    expect(untagged).toBeDefined()
    expect(untagged?.name).toBe(UNTAGGED_LABEL)
    expect(untagged?.key).toBe(UNTAGGED_KEY)
    expect(untagged?.trades).toHaveLength(2)
  })

  it('does not include Untagged bucket when no untagged trades exist', () => {
    const r = combineSetups([], [trade({ setup: 'Pullback' })])
    expect(r.find((e) => e.origin === 'untagged')).toBeUndefined()
  })

  it('excludes deleted trades from buckets', () => {
    const r = combineSetups(
      [playbook({ id: 1, name: 'Pullback' })],
      [
        trade({ id: 11, setup: 'Pullback', status: 'deleted' }),
        trade({ id: 12, setup: null, status: 'deleted' }),
        trade({ id: 13, setup: 'Pullback' }),
      ],
    )
    const pullback = r.find((e) => e.name === 'Pullback')
    expect(pullback?.trades).toHaveLength(1)
    expect(pullback?.trades[0].id).toBe(13)
    expect(r.find((e) => e.origin === 'untagged')).toBeUndefined()
  })

  it('preserves order: playbook records → trade-derived → untagged', () => {
    const r = combineSetups(
      [playbook({ id: 5, name: 'Pullback' })],
      [
        trade({ id: 1, setup: 'Pullback' }),
        trade({ id: 2, setup: 'Wedge' }),
        trade({ id: 3, setup: null }),
      ],
    )
    expect(r.map((e) => e.origin)).toEqual(['playbook', 'trade-derived', 'untagged'])
  })

  it('preserves multiple backend playbooks even when only one has trades', () => {
    const r = combineSetups(
      [playbook({ id: 1, name: 'A' }), playbook({ id: 2, name: 'B' })],
      [trade({ id: 1, setup: 'A' })],
    )
    expect(r.filter((e) => e.origin === 'playbook')).toHaveLength(2)
    expect(r.find((e) => e.name === 'A')?.trades).toHaveLength(1)
    expect(r.find((e) => e.name === 'B')?.trades).toHaveLength(0)
  })
})
