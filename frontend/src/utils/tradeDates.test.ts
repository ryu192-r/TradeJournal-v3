import { describe, it, expect } from 'vitest'
import {
  getTradeSessionDate,
  getRealizedSessionDate,
  todaySessionDate,
  weekdayFromSessionDate,
  tradeMatchesSessionDate,
} from './tradeDates'

describe('getTradeSessionDate', () => {
  it('maps Monday naive IST entry to Monday', () => {
    expect(getTradeSessionDate('2025-11-24T09:30:00')).toBe('2025-11-24')
    expect(weekdayFromSessionDate('2025-11-24')).toBe(1)
  })

  it('maps UTC near-midnight to correct IST session day', () => {
    // 2025-11-23T20:30:00Z -> 2025-11-24 02:00 IST (Monday)
    expect(getTradeSessionDate('2025-11-23T20:30:00Z')).toBe('2025-11-24')
  })

  it('imported Sunday created_at does not affect session date', () => {
    expect(
      getTradeSessionDate({ entry_time: '2025-11-24T10:00:00' }),
    ).toBe('2025-11-24')
  })

  it('Sunday stays empty when no trades match', () => {
    const sunday = '2025-11-23'
    expect(tradeMatchesSessionDate({ entry_time: '2025-11-24T09:30:00' }, sunday)).toBe(false)
  })
})

describe('getRealizedSessionDate', () => {
  it('uses exit_time for realized PnL bucket', () => {
    expect(
      getRealizedSessionDate('2025-11-25T15:15:00', '2025-11-24T09:30:00'),
    ).toBe('2025-11-25')
  })
})

describe('todaySessionDate', () => {
  it('returns YYYY-MM-DD', () => {
    expect(todaySessionDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
