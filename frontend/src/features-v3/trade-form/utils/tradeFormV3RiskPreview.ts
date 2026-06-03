import { calculateTradeMetrics } from '@/utils/calculations'

export interface RiskPreview {
  hasEntryQty: boolean
  riskAmount: number | null
  plannedRewardAmount: number | null
  riskRewardRatio: number | null
  grossPnl: number | null
  netPnl: number | null
  rMultiple: number | null
  hasExit: boolean
  hasStop: boolean
  hasTarget: boolean
  warnings: string[]
}

function num(v: string | undefined): number | undefined {
  if (v == null || v === '') return undefined
  const n = parseFloat(v)
  return Number.isNaN(n) ? undefined : n
}

/**
 * Compute a safe risk preview from form string values.
 * Uses existing calculateTradeMetrics. Never returns NaN.
 * plannedStop = original SL (planning truth) — does not use moved/current protection SL.
 */
export function computeRiskPreview(values: {
  entry_price?: string
  exit_price?: string
  quantity?: string
  fees?: string
  stop_price?: string
  target_price?: string
}): RiskPreview {
  const entry = num(values.entry_price)
  const qty = num(values.quantity)
  const exit = num(values.exit_price)
  const stop = num(values.stop_price)
  const target = num(values.target_price)

  const m = calculateTradeMetrics({
    entryPrice: entry,
    exitPrice: exit,
    quantity: qty,
    fees: num(values.fees),
    plannedStopPrice: stop,
    currentStopPrice: stop,
    targetPrice: target,
    direction: 'LONG',
  })

  return {
    hasEntryQty: entry != null && qty != null,
    riskAmount: m.riskAmount,
    plannedRewardAmount: m.plannedRewardAmount,
    riskRewardRatio: m.isValidForRiskReward ? m.riskRewardRatio : null,
    grossPnl: m.grossPnl,
    netPnl: m.netPnl,
    rMultiple: m.rMultiple,
    hasExit: exit != null,
    hasStop: stop != null,
    hasTarget: target != null,
    warnings: m.warnings,
  }
}
