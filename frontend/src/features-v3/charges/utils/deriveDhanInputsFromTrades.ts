import type { ApiTrade } from '@/types'

// ────────────────────────── Types ──────────────────────────

export type DeriveConfidence = 'high' | 'medium' | 'low' | 'unavailable'

export interface DerivedDhanInputs {
  buyTurnover: number
  sellTurnover: number
  executedOrderCount: number
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
  let orderCount = 0
  let closedCount = 0
  let partialCount = 0
  let skippedCount = 0
  let missingPriceCount = 0
  let missingQuantityCount = 0
  const warnings: string[] = []
  const assumptions: string[] = []

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

    // Buy side: entry_price * quantity (all trades are LONG)
    buyTurnover += entryPrice * qty
    orderCount++ // 1 order for entry

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
          orderCount++ // at least 1 exit order
        }
      } else {
        // Fully closed
        sellTurnover += exitPrice * qty
        closedCount++
        orderCount++ // 1 exit order
      }
    } else if (remainingQty !== null && Number.isFinite(remainingQty) && remainingQty < qty) {
      // Has partial exits but no final exit_price — partial exit turnover cannot be fully derived
      partialCount++
    }
    // Open trade with no exit: only buy side counted, no sell order
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

  assumptions.push('Exchange and product type cannot be derived from trade records — select manually.')
  assumptions.push('Order count is estimated (1 entry + 1 exit per trade). Actual broker order count may differ.')

  if (totalProcessed > 0 && closedCount + partialCount < totalProcessed) {
    assumptions.push('Open trades contribute buy turnover only (no sell side).')
  }

  return {
    inputs: {
      buyTurnover: Math.round(buyTurnover * 100) / 100,
      sellTurnover: Math.round(sellTurnover * 100) / 100,
      executedOrderCount: orderCount,
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
