import { describe, expect, it } from 'vitest'
import type { ApiTrade } from '@/types'
import {
  getCurrentStopModeLabel,
  getOriginalStopModeLabel,
  getRiskProtectionState,
} from '../utils/tradeDetailV3Risk'

function trade(overrides: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1,
    symbol: 'RELIANCE',
    direction: 'LONG',
    entry_price: '2500',
    exit_price: null,
    quantity: '10',
    entry_time: '2026-06-03T09:25:00',
    exit_time: null,
    fees: '10',
    notes: null,
    tags: [],
    setup: 'ORB',
    tactic: null,
    original_stop_price: '2450',
    current_stop_price: '2520',
    stop_loss_status: 'trailing',
    stop_price: '2520',
    target_price: '2700',
    r_multiple: '1.2',
    status: 'open',
    pnl: null,
    remaining_qty: '10',
    partial_realized_pnl: null,
    ...overrides,
  }
}

describe('tradeDetailV3Risk', () => {
  it('keeps original and current stop labels separate', () => {
    expect(getOriginalStopModeLabel(trade())).toBe('Original planned')
    expect(getCurrentStopModeLabel(trade())).toBe('Trailing')
  })

  it('shows fallback when original SL missing', () => {
    expect(getOriginalStopModeLabel(trade({ original_stop_price: null }))).toBe('Not set')
    expect(getRiskProtectionState(trade({
      original_stop_price: null,
      current_stop_price: null,
      stop_price: null,
      stop_loss_status: 'original',
    }))).toBe('no_sl')
  })

  it('shows fallback when current SL missing', () => {
    expect(getCurrentStopModeLabel(trade({ current_stop_price: null, stop_price: null }))).toBe('Not set')
  })

  it('maps risk-free protection state', () => {
    expect(getRiskProtectionState(trade({ stop_loss_status: 'risk_free' }))).toBe('risk_free')
  })
})
