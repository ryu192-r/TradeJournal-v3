import { describe, expect, it } from 'vitest'
import { deriveDhanEstimateInputsFromTrades } from '../utils/deriveDhanInputsFromTrades'
import type { ApiTrade } from '@/types'

function makeTrade(overrides: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1,
    symbol: 'RELIANCE',
    direction: 'LONG',
    entry_price: '2500',
    exit_price: '2600',
    quantity: '10',
    entry_time: '2025-06-03T10:00:00',
    exit_time: '2025-06-03T15:00:00',
    fees: '0',
    notes: null,
    tags: null,
    setup: null,
    tactic: null,
    stop_price: null,
    target_price: null,
    r_multiple: null,
    status: 'closed',
    remaining_qty: null,
    ...overrides,
  }
}

describe('deriveDhanEstimateInputsFromTrades', () => {
  it('returns unavailable when no trades', () => {
    const result = deriveDhanEstimateInputsFromTrades([])
    expect(result.confidence).toBe('unavailable')
    expect(result.inputs.buyTurnover).toBe(0)
    expect(result.inputs.sellTurnover).toBe(0)
    expect(result.inputs.executedOrderCount).toBe(0)
    expect(result.sourceStats.tradeCount).toBe(0)
  })

  it('derives buy/sell turnover from a single closed long trade', () => {
    const result = deriveDhanEstimateInputsFromTrades([makeTrade()])
    expect(result.inputs.buyTurnover).toBe(25000) // 2500 * 10
    expect(result.inputs.sellTurnover).toBe(26000) // 2600 * 10
    expect(result.inputs.executedOrderCount).toBe(2) // 1 entry + 1 exit
    expect(result.confidence).toBe('high')
    expect(result.sourceStats.closedTradeCount).toBe(1)
  })

  it('aggregates turnover from multiple trades', () => {
    const trades = [
      makeTrade({ id: 1, entry_price: '1000', exit_price: '1100', quantity: '5' }),
      makeTrade({ id: 2, entry_price: '2000', exit_price: '2200', quantity: '3' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.buyTurnover).toBe(5000 + 6000) // 11000
    expect(result.inputs.sellTurnover).toBe(5500 + 6600) // 12100
    expect(result.inputs.executedOrderCount).toBe(4) // 2 entries + 2 exits
  })

  it('skips trades with missing entry price and warns', () => {
    const trades = [
      makeTrade({ id: 1, entry_price: '' }),
      makeTrade({ id: 2, entry_price: '1000', exit_price: '1100', quantity: '5' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.buyTurnover).toBe(5000)
    expect(result.sourceStats.skippedTradeCount).toBe(1)
    expect(result.sourceStats.missingPriceCount).toBe(1)
    expect(result.warnings.some(w => /skipped/i.test(w))).toBe(true)
  })

  it('skips trades with missing quantity and warns', () => {
    const trades = [
      makeTrade({ id: 1, quantity: '0' }),
      makeTrade({ id: 2, entry_price: '1000', exit_price: '1100', quantity: '5' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.buyTurnover).toBe(5000)
    expect(result.sourceStats.skippedTradeCount).toBe(1)
    expect(result.sourceStats.missingQuantityCount).toBe(1)
  })

  it('respects remaining_qty for partial exits', () => {
    const trade = makeTrade({
      entry_price: '1000',
      exit_price: '1050',
      quantity: '10',
      remaining_qty: '4',
    })
    const result = deriveDhanEstimateInputsFromTrades([trade])
    expect(result.inputs.buyTurnover).toBe(10000) // 1000 * 10
    expect(result.inputs.sellTurnover).toBe(6300) // 1050 * 6 (closed qty)
    expect(result.sourceStats.partialTradeCount).toBe(1)
    expect(result.confidence).toBe('medium')
  })

  it('does not double-count fully closed trade with remaining_qty=0', () => {
    const trade = makeTrade({
      entry_price: '500',
      exit_price: '550',
      quantity: '20',
      remaining_qty: '0',
    })
    const result = deriveDhanEstimateInputsFromTrades([trade])
    expect(result.inputs.buyTurnover).toBe(10000) // 500 * 20
    expect(result.inputs.sellTurnover).toBe(11000) // 550 * 20
    expect(result.sourceStats.closedTradeCount).toBe(1)
    expect(result.sourceStats.partialTradeCount).toBe(0)
  })

  it('handles open trade (no exit) — only buy side', () => {
    const trade = makeTrade({ exit_price: null, exit_time: null, status: 'open' })
    const result = deriveDhanEstimateInputsFromTrades([trade])
    expect(result.inputs.buyTurnover).toBe(25000)
    expect(result.inputs.sellTurnover).toBe(0)
    expect(result.inputs.executedOrderCount).toBe(1) // only entry
    expect(result.assumptions.some(a => /open trades/i.test(a))).toBe(true)
  })

  it('excludes deleted trades', () => {
    const trades = [
      makeTrade({ id: 1, status: 'deleted' }),
      makeTrade({ id: 2, entry_price: '1000', exit_price: '1100', quantity: '5' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.buyTurnover).toBe(5000)
    expect(result.sourceStats.tradeCount).toBe(1) // only non-deleted counted
  })

  it('order count includes 1 entry + 1 exit per closed trade', () => {
    const trades = [
      makeTrade({ id: 1 }),
      makeTrade({ id: 2 }),
      makeTrade({ id: 3, exit_price: null, status: 'open' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.executedOrderCount).toBe(5) // 3 entries + 2 exits
  })

  it('confidence is low when majority of trades are skipped', () => {
    const trades = [
      makeTrade({ id: 1, entry_price: '' }),
      makeTrade({ id: 2, quantity: '0' }),
      makeTrade({ id: 3, entry_price: '1000', exit_price: '1100', quantity: '5' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.confidence).toBe('low') // 2 skipped out of 3
  })

  it('confidence is unavailable when all trades are skipped', () => {
    const trades = [
      makeTrade({ id: 1, entry_price: '' }),
      makeTrade({ id: 2, quantity: '0' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.confidence).toBe('unavailable')
  })

  it('warns about exchange/product type when not set on trades', () => {
    const result = deriveDhanEstimateInputsFromTrades([makeTrade()])
    expect(result.assumptions.some(a => /exchange/i.test(a))).toBe(true)
    expect(result.assumptions.some(a => /product type/i.test(a))).toBe(true)
  })

  it('always warns about order count approximation', () => {
    const result = deriveDhanEstimateInputsFromTrades([makeTrade()])
    expect(result.assumptions.some(a => /order count/i.test(a))).toBe(true)
  })

  it('derives exchange when all trades share same exchange', () => {
    const trades = [
      makeTrade({ id: 1, exchange: 'NSE' }),
      makeTrade({ id: 2, exchange: 'NSE' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.exchange).toBe('NSE')
  })

  it('warns on mixed exchange', () => {
    const trades = [
      makeTrade({ id: 1, exchange: 'NSE' }),
      makeTrade({ id: 2, exchange: 'BSE' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.exchange).toBeUndefined()
    expect(result.warnings.some(w => /mixed exchange/i.test(w))).toBe(true)
  })

  it('does not derive exchange when all UNKNOWN', () => {
    const result = deriveDhanEstimateInputsFromTrades([makeTrade({ exchange: 'UNKNOWN' })])
    expect(result.inputs.exchange).toBeUndefined()
  })

  it('maps product_type INTRADAY to equity_intraday', () => {
    const result = deriveDhanEstimateInputsFromTrades([makeTrade({ product_type: 'INTRADAY' })])
    expect(result.inputs.productType).toBe('equity_intraday')
  })

  it('maps product_type DELIVERY to equity_delivery', () => {
    const result = deriveDhanEstimateInputsFromTrades([makeTrade({ product_type: 'DELIVERY' })])
    expect(result.inputs.productType).toBe('equity_delivery')
  })

  it('warns on mixed product types', () => {
    const trades = [
      makeTrade({ id: 1, product_type: 'INTRADAY' }),
      makeTrade({ id: 2, product_type: 'DELIVERY' }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.productType).toBeUndefined()
    expect(result.warnings.some(w => /mixed product/i.test(w))).toBe(true)
  })

  it('uses executed_order_count from metadata when available', () => {
    const trades = [
      makeTrade({ id: 1, executed_order_count: 4 }),
      makeTrade({ id: 2, executed_order_count: 3 }),
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.executedOrderCount).toBe(7) // 4 + 3
  })

  it('mixes metadata and estimated order count with warning', () => {
    const trades = [
      makeTrade({ id: 1, executed_order_count: 4 }),
      makeTrade({ id: 2 }), // no metadata — estimated as 2 (entry+exit)
    ]
    const result = deriveDhanEstimateInputsFromTrades(trades)
    expect(result.inputs.executedOrderCount).toBe(6) // 4 + 2
    expect(result.assumptions.some(a => /mixes/i.test(a))).toBe(true)
  })

  it('handles partial trade with no exit_price but reduced remaining_qty', () => {
    const trade = makeTrade({
      exit_price: null,
      quantity: '10',
      remaining_qty: '6',
      status: 'open',
    })
    const result = deriveDhanEstimateInputsFromTrades([trade])
    // No exit_price so cannot derive sell turnover
    expect(result.inputs.buyTurnover).toBe(25000)
    expect(result.inputs.sellTurnover).toBe(0)
    expect(result.sourceStats.partialTradeCount).toBe(1)
  })

  it('rounds turnover to 2 decimal places', () => {
    const trade = makeTrade({ entry_price: '333.33', exit_price: '444.44', quantity: '3' })
    const result = deriveDhanEstimateInputsFromTrades([trade])
    expect(result.inputs.buyTurnover).toBe(999.99)
    expect(result.inputs.sellTurnover).toBe(1333.32)
  })
})
