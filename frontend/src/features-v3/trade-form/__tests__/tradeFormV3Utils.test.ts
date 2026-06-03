import { describe, expect, it } from 'vitest'
import { emptyTradeFormValues, apiTradeToFormValues } from '../utils/tradeFormV3Defaults'
import { computeRiskPreview } from '../utils/tradeFormV3RiskPreview'
import { formDataToApiPayload } from '@/schemas/tradeForm'
import type { ApiTrade } from '@/types'

function makeTrade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T10:00:00', exit_time: '2025-06-03T15:00:00',
    fees: '12', notes: 'n', tags: ['a', 'b'], setup: 'Breakout', tactic: null,
    stop_price: '2450', target_price: '2700', r_multiple: null, status: 'closed',
    remaining_qty: null, exchange: 'NSE', segment: 'EQUITY', product_type: 'INTRADAY',
    executed_order_count: 3, ...o,
  }
}

describe('tradeFormV3Defaults', () => {
  it('empty defaults include safe metadata', () => {
    const d = emptyTradeFormValues()
    expect(d.exchange).toBe('UNKNOWN')
    expect(d.segment).toBe('UNKNOWN')
    expect(d.product_type).toBe('UNKNOWN')
    expect(d.executed_order_count).toBeUndefined()
    expect(d.symbol).toBe('')
  })

  it('maps api trade metadata to form values', () => {
    const v = apiTradeToFormValues(makeTrade())
    expect(v.symbol).toBe('RELIANCE')
    expect(v.exchange).toBe('NSE')
    expect(v.segment).toBe('EQUITY')
    expect(v.product_type).toBe('INTRADAY')
    expect(v.executed_order_count).toBe('3')
    expect(v.tags).toBe('a, b')
  })

  it('maps unknown metadata when fields absent', () => {
    const v = apiTradeToFormValues(makeTrade({ exchange: undefined, executed_order_count: null }))
    expect(v.exchange).toBe('UNKNOWN')
    expect(v.executed_order_count).toBeUndefined()
  })

  it('uses current_stop_price as stop in form', () => {
    const v = apiTradeToFormValues(makeTrade({ current_stop_price: '2480', stop_price: '2450' }))
    expect(v.stop_price).toBe('2480')
  })
})

describe('formDataToApiPayload metadata', () => {
  it('blank executed_order_count maps to null', () => {
    const p = formDataToApiPayload({ ...emptyTradeFormValues(), symbol: 'X', entry_price: '1', quantity: '1', entry_time: '2025-06-03T10:00' })
    expect(p.executed_order_count).toBeNull()
    expect(p.exchange).toBe('UNKNOWN')
  })

  it('valid executed_order_count maps to number', () => {
    const p = formDataToApiPayload({ ...emptyTradeFormValues(), symbol: 'X', entry_price: '1', quantity: '1', entry_time: '2025-06-03T10:00', executed_order_count: '4', exchange: 'NSE' })
    expect(p.executed_order_count).toBe(4)
    expect(p.exchange).toBe('NSE')
  })
})

describe('computeRiskPreview', () => {
  it('computes risk and R:R for valid long trade', () => {
    const r = computeRiskPreview({ entry_price: '100', quantity: '10', stop_price: '90', target_price: '130' })
    expect(r.hasEntryQty).toBe(true)
    expect(r.riskAmount).toBe(100) // (100-90)*10
    expect(r.riskRewardRatio).toBeCloseTo(3, 1) // (130-100)/(100-90)
  })

  it('no NaN when stop missing', () => {
    const r = computeRiskPreview({ entry_price: '100', quantity: '10' })
    expect(r.riskAmount).toBeNull()
    expect(r.riskRewardRatio).toBeNull()
    expect(Number.isNaN(r.riskAmount as number)).toBe(false)
  })

  it('no NaN when all fields empty', () => {
    const r = computeRiskPreview({})
    expect(r.hasEntryQty).toBe(false)
    expect(r.riskAmount).toBeNull()
    expect(r.grossPnl).toBeNull()
  })
})
