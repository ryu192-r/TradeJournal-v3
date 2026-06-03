import { describe, expect, it } from 'vitest'
import {
  computeDhanEstimate,
  validateDhanEstimateInput,
  compareEstimateToActual,
} from '../dhanChargesCalculator'
import type { DhanEstimateInput } from '../dhanChargesTypes'

const BASE: DhanEstimateInput = {
  product_type: 'equity_intraday',
  exchange: 'NSE',
  buy_turnover: 100_000,
  sell_turnover: 100_000,
  executed_order_count: 4,
  include_ipft: true,
}

describe('validateDhanEstimateInput', () => {
  it('passes for valid input', () => {
    const v = validateDhanEstimateInput(BASE)
    expect(v.valid).toBe(true)
    expect(v.errors).toEqual({})
  })

  it('fails for negative buy turnover', () => {
    const v = validateDhanEstimateInput({ ...BASE, buy_turnover: -100 })
    expect(v.valid).toBe(false)
    expect(v.errors.buy_turnover).toBeDefined()
  })

  it('fails for negative sell turnover', () => {
    const v = validateDhanEstimateInput({ ...BASE, sell_turnover: -100 })
    expect(v.valid).toBe(false)
    expect(v.errors.sell_turnover).toBeDefined()
  })

  it('fails for negative order count', () => {
    const v = validateDhanEstimateInput({ ...BASE, executed_order_count: -1 })
    expect(v.valid).toBe(false)
    expect(v.errors.executed_order_count).toBeDefined()
  })

  it('fails for NaN turnover', () => {
    const v = validateDhanEstimateInput({ ...BASE, buy_turnover: NaN })
    expect(v.valid).toBe(false)
    expect(v.errors.buy_turnover).toBeDefined()
  })
})

describe('computeDhanEstimate — Equity Delivery', () => {
  it('brokerage is zero', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_delivery',
      exchange: 'NSE',
      buy_turnover: 200_000,
      sell_turnover: 200_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    expect(r.brokerage).toBe(0)
  })

  it('STT uses buy + sell turnover for delivery', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_delivery',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 100_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const turnover = 200_000
    const expectedStt = Math.round(turnover * 0.001) // 0.1% rounded to rupee
    expect(r.stt).toBe(expectedStt)
  })

  it('stamp duty uses buy only for delivery', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_delivery',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 50_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const expectedStamp = Math.round(100_000 * 0.00015) // 0.015% of buy
    expect(r.stamp_duty).toBe(expectedStamp)
  })

  it('GST base is correct', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_delivery',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 100_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const gstBase = r.brokerage + r.exchange_txn_charges + r.sebi_charges + r.ipft
    const expectedGst = Math.round(gstBase * 18) / 100
    expect(r.gst).toBeCloseTo(expectedGst, 2)
  })

  it('total equals sum of rounded components', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_delivery',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 100_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const computedTotal =
      r.brokerage +
      r.stt +
      r.exchange_txn_charges +
      r.sebi_charges +
      r.stamp_duty +
      r.gst +
      r.other_charges
    expect(r.total_charges).toBeCloseTo(computedTotal, 2)
  })
})

describe('computeDhanEstimate — Equity Intraday', () => {
  it('brokerage cap works (aggregate approximation)', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_intraday',
      exchange: 'NSE',
      buy_turnover: 50_000,
      sell_turnover: 50_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const turnover = 100_000
    const pctValue = turnover * 0.0003 // 0.03%
    const flatValue = 20 * 2 // ₹20 × 2
    const expected = Math.min(pctValue, flatValue)
    expect(r.brokerage).toBeCloseTo(Math.round(expected * 100) / 100, 2)
  })

  it('STT uses sell only for intraday', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_intraday',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 80_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const expectedStt = Math.round(80_000 * 0.00025) // 0.025% of sell
    expect(r.stt).toBe(expectedStt)
  })

  it('stamp duty uses buy only for intraday', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_intraday',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 80_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const expectedStamp = Math.round(100_000 * 0.00003) // 0.003% of buy
    expect(r.stamp_duty).toBe(expectedStamp)
  })
})

describe('computeDhanEstimate — Equity MTF', () => {
  it('brokerage uses same cap as intraday', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_mtf',
      exchange: 'NSE',
      buy_turnover: 50_000,
      sell_turnover: 50_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const turnover = 100_000
    const pctValue = turnover * 0.0003
    const flatValue = 20 * 2
    const expected = Math.min(pctValue, flatValue)
    expect(r.brokerage).toBeCloseTo(Math.round(expected * 100) / 100, 2)
  })

  it('STT uses buy + sell for MTF', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_mtf',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 100_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const turnover = 200_000
    const expectedStt = Math.round(turnover * 0.001)
    expect(r.stt).toBe(expectedStt)
  })
})

describe('computeDhanEstimate — unsupported product', () => {
  it('returns safe unsupported state for commodity_fno', () => {
    const r = computeDhanEstimate({
      product_type: 'commodity_fno',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 100_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    expect(r.confidence).toBe('low')
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.total_charges).toBe(0)
    expect(r.brokerage).toBe(0)
  })
})

describe('computeDhanEstimate — zero turnover', () => {
  it('returns zero charges with safe result', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_intraday',
      exchange: 'NSE',
      buy_turnover: 0,
      sell_turnover: 0,
      executed_order_count: 0,
      include_ipft: true,
    })
    expect(r.brokerage).toBe(0)
    expect(r.stt).toBe(0)
    expect(r.exchange_txn_charges).toBe(0)
    expect(r.sebi_charges).toBe(0)
    expect(r.stamp_duty).toBe(0)
    expect(r.gst).toBe(0)
    expect(r.ipft).toBe(0)
    expect(r.total_charges).toBe(0)
  })
})

describe('Rounding rules', () => {
  it('STT is rounded to nearest rupee', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_delivery',
      exchange: 'NSE',
      buy_turnover: 123_456,
      sell_turnover: 123_456,
      executed_order_count: 2,
      include_ipft: true,
    })
    expect(r.stt).toBe(Math.round(r.stt)) // integer
  })

  it('stamp duty is rounded to nearest rupee', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_delivery',
      exchange: 'NSE',
      buy_turnover: 123_456,
      sell_turnover: 123_456,
      executed_order_count: 2,
      include_ipft: true,
    })
    expect(r.stamp_duty).toBe(Math.round(r.stamp_duty)) // integer
  })

  it('other charges are rounded to nearest 2 decimals', () => {
    const r = computeDhanEstimate({
      product_type: 'equity_delivery',
      exchange: 'NSE',
      buy_turnover: 100_000,
      sell_turnover: 100_000,
      executed_order_count: 2,
      include_ipft: true,
    })
    const sebiDecimals = String(r.sebi_charges).split('.')[1]
    if (sebiDecimals) {
      expect(sebiDecimals.length).toBeLessThanOrEqual(2)
    }
    const gstDecimals = String(r.gst).split('.')[1]
    if (gstDecimals) {
      expect(gstDecimals.length).toBeLessThanOrEqual(2)
    }
  })
})

describe('compareEstimateToActual', () => {
  it('returns no_actual when actual is null', () => {
    const c = compareEstimateToActual(250, null)
    expect(c.status).toBe('no_actual')
    expect(c.differencePct).toBeNull()
  })

  it('returns close when difference ≤ 2%', () => {
    const c = compareEstimateToActual(255, 250)
    expect(c.status).toBe('close')
    expect(c.differencePct).toBeLessThanOrEqual(2)
  })

  it('returns review when difference > 2% and ≤ 10%', () => {
    const c = compareEstimateToActual(270, 250)
    expect(c.status).toBe('review')
    expect(c.differencePct).toBeGreaterThan(2)
    expect(c.differencePct).toBeLessThanOrEqual(10)
  })

  it('returns large when difference > 10%', () => {
    const c = compareEstimateToActual(300, 250)
    expect(c.status).toBe('large')
    expect(c.differencePct).toBeGreaterThan(10)
  })

  it('difference is computed as estimated - actual', () => {
    const c = compareEstimateToActual(260, 250)
    expect(c.difference).toBe(10)
  })
})
