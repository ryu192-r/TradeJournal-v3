import type { ApiTrade } from '@/types'
import type { DhanProductType, DhanExchange } from '../templates/dhan/dhanChargesConfig'

// ────────────────────────── Types ──────────────────────────

export type DeriveConfidence = 'high' | 'medium' | 'low' | 'unavailable'

export interface DerivedDhanInputs {
  buyTurnover: number
  sellTurnover: number
  executedOrderCount: number
  exchange?: DhanExchange
  productType?: DhanProductType
}

export interface DeriveSourceStats {
  tradeCount: number
  closedTradeCount: number
  partialTradeCount: number
  skippedTradeCount: number
  missingPriceCount: number
  missingQuantityCount: number
}

export interface DeriveResult {
  inputs: DerivedDhanInputs
  confidence: DeriveConfidence
  warnings: string[]
  assumptions: string[]
  sourceStats: DeriveSourceStats
}

// ────────────────────────── Helpers ──────────────────────────

function safeNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function isEligible(t: ApiTrade): boolean {
  return t.status !== 'deleted'
}

const PRODUCT_MAP: Record<string, DhanProductType> = {
  DELIVERY: 'equity_delivery',
  INTRADAY: 'equity_intraday',
  MTF: 'equity_mtf',
  FNO: 'equity_fno',
}

// ────────────────────────── Main Function ──────────────────────────

/**
 * Derive Dhan estimator inputs from trade records for a given date.
 * Pure function — no side effects, no API calls, no auto-save.
 */
export function deriveDhanEstimateInputsFromTrades(trades: ApiTrade[]): DeriveResult {
  const eligible = trades.filter(isEligible)

  if (eligible.length === 0) {
    return {
      inputs: { buyTurnover: 0, sellTurnover: 0, executedOrderCount: 0 },
      confidence: 'unavailable',
      warnings: ['No eligible trades found for this date.'],
      assumptions: [],
      sourceStats: {
        tradeCount: 0,
        closedTradeCount: 0,
        partialTradeCount: 0,
        skippedTradeCount: 0,
        missingPriceCount: 0,
        missingQuantityCount: 0,
      },
    }
  }

  let buyTurnover = 0
  let sellTurnover = 0
  let orderCountFromMetadata = 0
  let orderCountEstimated = 0
  let closedCount = 0
  let partialCount = 0
  let skippedCount = 0
  let missingPriceCount = 0
  let missingQuantityCount = 0
  const warnings: string[] = []
  const assumptions: string[] = []

  // Track metadata for derivation
  const exchanges = new Set<string>()
  const productTypes = new Set<string>()

  for (const trade of eligible) {
    const entryPrice = safeNum(trade.entry_price)
    const qty = safeNum(trade.quantity)

    if (!qty) {
      skippedCount++
      missingQuantityCount++
      continue
    }
    if (!entryPrice) {
      skippedCount++
      missingPriceCount++
      continue
    }

    // Collect metadata
    if (trade.exchange && trade.exchange !== 'UNKNOWN') exchanges.add(trade.exchange)
    if (trade.product_type && trade.product_type !== 'UNKNOWN') productTypes.add(trade.product_type)

    // Buy side: entry_price * quantity (all trades are LONG)
    buyTurnover += entryPrice * qty

    // Order count: prefer executed_order_count metadata when available
    if (trade.executed_order_count != null && trade.executed_order_count > 0) {
      orderCountFromMetadata += trade.executed_order_count
    } else {
      orderCountEstimated++ // 1 for entry
    }

    // Sell side: depends on exit status
    const exitPrice = safeNum(trade.exit_price)
    const remainingQty = trade.remaining_qty !== null && trade.remaining_qty !== undefined
      ? Number(trade.remaining_qty)
      : null

    if (exitPrice) {
      if (remainingQty !== null && Number.isFinite(remainingQty) && remainingQty > 0) {
        // Partial trade — some qty still open
        const closedQty = qty - remainingQty
        if (closedQty > 0) {
          sellTurnover += exitPrice * closedQty
          partialCount++
          if (!trade.executed_order_count) orderCountEstimated++ // 1 exit order
        }
      } else {
        // Fully closed
        sellTurnover += exitPrice * qty
        closedCount++
        if (!trade.executed_order_count) orderCountEstimated++ // 1 exit order
      }
    } else if (remainingQty !== null && Number.isFinite(remainingQty) && remainingQty < qty) {
      partialCount++
    }
  }

  const orderCount = orderCountFromMetadata + orderCountEstimated

  // Derive exchange
  let derivedExchange: DhanExchange | undefined
  if (exchanges.size === 1) {
    const ex = [...exchanges][0]
    if (ex === 'NSE' || ex === 'BSE') derivedExchange = ex
  } else if (exchanges.size > 1) {
    warnings.push('Mixed exchanges detected — select exchange manually.')
  }

  // Derive product type
  let derivedProductType: DhanProductType | undefined
  if (productTypes.size === 1) {
    const pt = [...productTypes][0]
    if (pt in PRODUCT_MAP) derivedProductType = PRODUCT_MAP[pt]
  } else if (productTypes.size > 1) {
    warnings.push('Mixed product types detected — select product type manually.')
  }

  // Determine confidence
  const totalProcessed = eligible.length - skippedCount
  let confidence: DeriveConfidence = 'high'

  if (totalProcessed === 0) {
    confidence = 'unavailable'
    warnings.push('All trades were skipped due to missing data.')
  } else if (skippedCount > 0 || partialCount > 0) {
    confidence = skippedCount > totalProcessed / 2 ? 'low' : 'medium'
  }

  // Assumptions & warnings
  if (partialCount > 0) {
    warnings.push(
      'Partial exit turnover uses weighted average exit price from trade record. Actual per-exit prices may differ.'
    )
  }

  if (skippedCount > 0) {
    warnings.push(`${skippedCount} trade(s) skipped due to missing price or quantity.`)
  }

  if (!derivedExchange && exchanges.size === 0) {
    assumptions.push('Exchange not set on trades — select manually.')
  }
  if (!derivedProductType && productTypes.size === 0) {
    assumptions.push('Product type not set on trades — select manually.')
  }

  if (orderCountFromMetadata > 0 && orderCountEstimated > 0) {
    assumptions.push('Order count mixes broker metadata and estimates for trades without metadata.')
  } else if (orderCountFromMetadata === 0) {
    assumptions.push('Order count is estimated (1 entry + 1 exit per trade). Actual broker order count may differ.')
  }

  if (totalProcessed > 0 && closedCount + partialCount < totalProcessed) {
    assumptions.push('Open trades contribute buy turnover only (no sell side).')
  }

  return {
    inputs: {
      buyTurnover: Math.round(buyTurnover * 100) / 100,
      sellTurnover: Math.round(sellTurnover * 100) / 100,
      executedOrderCount: orderCount,
      exchange: derivedExchange,
      productType: derivedProductType,
    },
    confidence,
    warnings,
    assumptions,
    sourceStats: {
      tradeCount: eligible.length,
      closedTradeCount: closedCount,
      partialTradeCount: partialCount,
      skippedTradeCount: skippedCount,
      missingPriceCount,
      missingQuantityCount,
    },
  }
}
