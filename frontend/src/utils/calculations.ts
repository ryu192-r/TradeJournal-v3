export interface TradeCalculationResult {
  riskPerUnit: number | null
  rewardPerUnit: number | null
  riskAmount: number | null
  plannedRewardAmount: number | null
  riskRewardRatio: number | null
  pnlPerUnit: number | null
  grossPnl: number | null
  netPnl: number | null
  rMultiple: number | null
  isValidForRiskReward: boolean
  isValidForPnl: boolean
  warnings: string[]
}

export interface TradeMetricInputs {
  entryPrice?: number | null | undefined
  exitPrice?: number | null | undefined
  quantity?: number | null | undefined
  fees?: number | null | undefined
  stopPrice?: number | null | undefined
  targetPrice?: number | null | undefined
  direction?: string
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isNaN(n) ? null : n
}

export function calculateTradeMetrics(inputs: TradeMetricInputs): TradeCalculationResult {
  const result: TradeCalculationResult = {
    riskPerUnit: null,
    rewardPerUnit: null,
    riskAmount: null,
    plannedRewardAmount: null,
    riskRewardRatio: null,
    pnlPerUnit: null,
    grossPnl: null,
    netPnl: null,
    rMultiple: null,
    isValidForRiskReward: false,
    isValidForPnl: false,
    warnings: [],
  }

  const entry = toNum(inputs.entryPrice)
  const exit = toNum(inputs.exitPrice)
  const qty = toNum(inputs.quantity)
  const fees = inputs.fees != null ? toNum(inputs.fees) ?? 0 : 0
  const stop = toNum(inputs.stopPrice)
  const target = toNum(inputs.targetPrice)
  const isLong = (inputs.direction ?? 'LONG').toUpperCase() === 'LONG'

  if (entry == null || entry <= 0) {
    result.warnings.push('Invalid or missing entry_price')
    return result
  }
  if (qty == null || qty <= 0) {
    result.warnings.push('Invalid or missing quantity')
    return result
  }

  if (exit != null) {
    result.pnlPerUnit = isLong ? exit - entry : entry - exit
    result.grossPnl = result.pnlPerUnit * qty
    result.netPnl = result.grossPnl - fees
    result.isValidForPnl = true
  }

  if (stop != null) {
    result.riskPerUnit = isLong ? entry - stop : stop - entry
    if (result.riskPerUnit != null && result.riskPerUnit <= 0) {
      result.warnings.push('Stop loss is at or above entry (invalid for risk calculation)')
      result.riskPerUnit = null
    } else {
      result.riskAmount = result.riskPerUnit * qty
    }
  }

  if (target != null) {
    result.rewardPerUnit = isLong ? target - entry : entry - target
    if (result.rewardPerUnit != null && result.rewardPerUnit <= 0) {
      result.warnings.push('Target price is at or below entry (invalid for reward calculation)')
      result.rewardPerUnit = null
    } else {
      result.plannedRewardAmount = result.rewardPerUnit * qty
    }
  }

  if (result.riskPerUnit != null && result.rewardPerUnit != null) {
    if (result.riskPerUnit !== 0) {
      result.riskRewardRatio = result.rewardPerUnit / result.riskPerUnit
      result.isValidForRiskReward = true
    } else {
      result.warnings.push('Risk per unit is zero — cannot compute risk:reward ratio')
    }
  }

  if (result.netPnl != null && result.riskPerUnit != null && result.riskPerUnit !== 0 && result.riskAmount != null && result.riskAmount !== 0) {
    result.rMultiple = result.netPnl / result.riskAmount
  }

  return result
}

export function computeLivePnl(
  entryPrice: number,
  ltp: number,
  quantity: number,
  remainingQty?: number | null,
  fees?: number | null,
  direction = 'LONG',
): number | null {
  const entry = toNum(entryPrice)
  const ltpVal = toNum(ltp)
  const qty = toNum(quantity)
  const rem = remainingQty != null ? toNum(remainingQty) : qty
  const fee = fees != null ? toNum(fees) ?? 0 : 0

  if (entry == null || ltpVal == null || qty == null || rem == null || qty <= 0) return null

  const isLong = direction.toUpperCase() === 'LONG'
  const pnlPerUnit = isLong ? ltpVal - entry : entry - ltpVal
  const feeRatio = rem / qty
  return (pnlPerUnit * rem) - (fee * feeRatio)
}

export function computeLivePnlPct(investedValue: number, livePnl: number): number | null {
  if (investedValue <= 0) return null
  return (livePnl / investedValue) * 100
}

export function computeMaxRisk(entryPrice: number, stopPrice: number, remainingQty: number): number | null {
  const entry = toNum(entryPrice)
  const stop = toNum(stopPrice)
  const qty = toNum(remainingQty)
  if (entry == null || stop == null || qty == null) return null
  const risk = (entry - stop) * qty
  return risk < 0 ? 0 : risk
}

export function computeCapPct(pnlValue: number, netEquity: number): number | null {
  if (netEquity == null || netEquity <= 0) return null
  return (pnlValue / netEquity) * 100
}
