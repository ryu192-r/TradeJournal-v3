import { describe, it, expect } from 'vitest'
import {
  calculateTradeMetrics,
  computeLivePnl,
  computeLivePnlPct,
  computeMaxRisk,
  computeCapPct,
} from '@/utils/calculations'
import type { TradeMetricInputs } from '@/utils/calculations'

function r(inputs: TradeMetricInputs) {
  return calculateTradeMetrics(inputs)
}

// ── Long winning trade ──

describe('calculateTradeMetrics — long winning', () => {
  const inputs: TradeMetricInputs = {
    entryPrice: 100,
    exitPrice: 110,
    quantity: 100,
    stopPrice: 95,
    targetPrice: 120,
  }

  it('computes net P&L correctly', () => {
    expect(r(inputs).netPnl).toBe(1000)
  })

  it('computes R-multiple correctly', () => {
    // riskAmount = (100-95)*100 = 500, netPnl=1000, r = 2.0
    expect(r(inputs).rMultiple).toBe(2)
  })

  it('computes risk:reward correctly', () => {
    // riskPerUnit=5, rewardPerUnit=20, ratio=4
    expect(r(inputs).riskRewardRatio).toBe(4)
  })

  it('flags as valid', () => {
    const result = r(inputs)
    expect(result.isValidForPnl).toBe(true)
    expect(result.isValidForRiskReward).toBe(true)
  })
})

// ── Long losing trade ──

describe('calculateTradeMetrics — long losing', () => {
  const inputs: TradeMetricInputs = {
    entryPrice: 100,
    exitPrice: 90,
    quantity: 50,
    stopPrice: 95,
    targetPrice: 120,
  }

  it('negative P&L', () => {
    expect(r(inputs).netPnl).toBe(-500)
  })

  it('negative R-multiple', () => {
    expect(r(inputs).rMultiple).toBe(-2)
  })

  it('risk:reward unchanged (planned)', () => {
    expect(r(inputs).riskRewardRatio).toBe(4)
  })
})

// ── Short winning trade ──

describe('calculateTradeMetrics — short winning', () => {
  const inputs: TradeMetricInputs = {
    entryPrice: 200,
    exitPrice: 190,
    quantity: 100,
    stopPrice: 210,
    targetPrice: 180,
    direction: 'SHORT',
  }

  it('positive P&L for short', () => {
    expect(r(inputs).netPnl).toBe(1000)
  })

  it('R-multiple for short', () => {
    expect(r(inputs).rMultiple).toBe(1)
  })
})

// ── Short losing trade ──

describe('calculateTradeMetrics — short losing', () => {
  const inputs: TradeMetricInputs = {
    entryPrice: 200,
    exitPrice: 215,
    quantity: 50,
    stopPrice: 210,
    targetPrice: 180,
    direction: 'SHORT',
  }

  it('negative P&L for short', () => {
    expect(r(inputs).netPnl).toBe(-750)
  })

  it('negative R for short', () => {
    expect(r(inputs).rMultiple).toBe(-1.5)
  })
})

// ── Edge cases ──

describe('calculateTradeMetrics — missing stop loss', () => {
  const inputs: TradeMetricInputs = { entryPrice: 100, exitPrice: 110, quantity: 100 }

  it('has P&L but no R', () => {
    const result = r(inputs)
    expect(result.netPnl).toBe(1000)
    expect(result.rMultiple).toBeNull()
    expect(result.isValidForPnl).toBe(true)
    expect(result.isValidForRiskReward).toBe(false)
  })
})

describe('calculateTradeMetrics — missing target', () => {
  const inputs: TradeMetricInputs = { entryPrice: 100, exitPrice: 110, quantity: 100, stopPrice: 95 }

  it('no risk:reward but R computed', () => {
    const result = r(inputs)
    expect(result.riskRewardRatio).toBeNull()
    expect(result.isValidForRiskReward).toBe(false)
    expect(result.rMultiple).not.toBeNull()
  })
})

describe('calculateTradeMetrics — missing exit', () => {
  const inputs: TradeMetricInputs = { entryPrice: 100, quantity: 100, stopPrice: 95, targetPrice: 120 }

  it('no P&L but risk:reward valid', () => {
    const result = r(inputs)
    expect(result.netPnl).toBeNull()
    expect(result.rMultiple).toBeNull()
    expect(result.isValidForPnl).toBe(false)
    expect(result.isValidForRiskReward).toBe(true)
  })
})

describe('calculateTradeMetrics — zero quantity', () => {
  it('returns nulls with warning', () => {
    const result = r({ entryPrice: 100, exitPrice: 110, quantity: 0 })
    expect(result.netPnl).toBeNull()
    expect(result.rMultiple).toBeNull()
    expect(result.warnings.some(w => w.toLowerCase().includes('quantity'))).toBe(true)
  })
})

describe('calculateTradeMetrics — zero risk (stop = entry)', () => {
  it('no R and no ratio', () => {
    const result = r({ entryPrice: 100, exitPrice: 110, quantity: 100, stopPrice: 100, targetPrice: 120 })
    expect(result.rMultiple).toBeNull()
    expect(result.riskRewardRatio).toBeNull()
  })
})

describe('calculateTradeMetrics — planned vs current stop split', () => {
  it('long breakeven current stop keeps planned risk and no invalid warning', () => {
    const result = r({
      entryPrice: 100,
      exitPrice: 110,
      quantity: 100,
      plannedStopPrice: 95,
      currentStopPrice: 100,
      targetPrice: 120,
      direction: 'LONG',
    })
    expect(result.riskPerUnit).toBe(5)
    expect(result.riskAmount).toBe(500)
    expect(result.currentRiskAmount).toBe(0)
    expect(result.currentProtectionStatus).toBe('breakeven')
    expect(result.currentIsRiskFree).toBe(true)
    expect(result.riskRewardRatio).toBe(4)
    expect(result.warnings).toEqual([])
  })

  it('long current stop above entry reports locked profit', () => {
    const result = r({
      entryPrice: 100,
      quantity: 100,
      plannedStopPrice: 95,
      currentStopPrice: 103,
      targetPrice: 120,
      direction: 'LONG',
    })
    expect(result.currentRiskAmount).toBe(0)
    expect(result.lockedProfitPerUnit).toBe(3)
    expect(result.lockedProfitAmount).toBe(300)
    expect(result.currentProtectionStatus).toBe('profit_locked')
  })

  it('short breakeven current stop keeps planned risk and no invalid warning', () => {
    const result = r({
      entryPrice: 100,
      quantity: 100,
      plannedStopPrice: 105,
      currentStopPrice: 100,
      targetPrice: 90,
      direction: 'SHORT',
    })
    expect(result.riskPerUnit).toBe(5)
    expect(result.riskAmount).toBe(500)
    expect(result.currentRiskAmount).toBe(0)
    expect(result.currentProtectionStatus).toBe('breakeven')
    expect(result.currentIsRiskFree).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('short current stop below entry reports locked profit', () => {
    const result = r({
      entryPrice: 100,
      quantity: 100,
      plannedStopPrice: 105,
      currentStopPrice: 97,
      targetPrice: 90,
      direction: 'SHORT',
    })
    expect(result.currentRiskAmount).toBe(0)
    expect(result.lockedProfitPerUnit).toBe(3)
    expect(result.lockedProfitAmount).toBe(300)
    expect(result.currentProtectionStatus).toBe('profit_locked')
  })

  it('R-multiple and planned R:R stay tied to original planned stop', () => {
    const result = r({
      entryPrice: 100,
      exitPrice: 110,
      quantity: 100,
      plannedStopPrice: 95,
      currentStopPrice: 103,
      targetPrice: 120,
      direction: 'LONG',
    })
    expect(result.rMultiple).toBe(2)
    expect(result.riskRewardRatio).toBe(4)
  })
})

describe('calculateTradeMetrics — missing entry', () => {
  it('returns early with warning', () => {
    const result = r({ entryPrice: null, exitPrice: 110, quantity: 100 })
    expect(result.netPnl).toBeNull()
    expect(result.warnings.some(w => w.toLowerCase().includes('entry_price'))).toBe(true)
  })
})

describe('calculateTradeMetrics — with fees', () => {
  it('deducts fees from net P&L', () => {
    const result = r({ entryPrice: 100, exitPrice: 110, quantity: 100, fees: 50, stopPrice: 95 })
    expect(result.netPnl).toBe(950)
    expect(result.rMultiple).toBe(1.9)
  })
})

describe('calculateTradeMetrics — graceful degradation', () => {
  it('all undefined', () => {
    const result = r({})
    expect(result.netPnl).toBeNull()
    expect(result.rMultiple).toBeNull()
  })

  it('bad strings do not throw', () => {
    const result = r({ entryPrice: 'abc' as unknown as number, exitPrice: 'def' as unknown as number, quantity: 'ghi' as unknown as number })
    expect(result.netPnl).toBeNull()
  })
})

// ── computeLivePnl ──

describe('computeLivePnl', () => {
  it('long profit with LTP', () => {
    expect(computeLivePnl(100, 110, 100)).toBe(1000)
  })

  it('with partial remaining and fees', () => {
    const pnl = computeLivePnl(100, 110, 100, 50, 20)
    expect(pnl).toBe(490)
  })

  it('null when no LTP', () => {
    expect(computeLivePnl(100, null as unknown as number, 100)).toBeNull()
  })
})

// ── computeLivePnlPct ──

describe('computeLivePnlPct', () => {
  it('returns percentage', () => {
    expect(computeLivePnlPct(10000, 1000)).toBe(10)
  })

  it('null for zero invested', () => {
    expect(computeLivePnlPct(0, 1000)).toBeNull()
  })
})

// ── computeMaxRisk ──

describe('computeMaxRisk', () => {
  it('(entry - stop) * remaining', () => {
    expect(computeMaxRisk(100, 95, 50)).toBe(250)
  })

  it('null if missing stop', () => {
    expect(computeMaxRisk(100, null as unknown as number, 50)).toBeNull()
  })
})

// ── computeCapPct ──

describe('computeCapPct', () => {
  it('pnl / equity * 100', () => {
    expect(computeCapPct(500, 10000)).toBe(5)
  })

  it('null if equity <= 0', () => {
    expect(computeCapPct(500, 0)).toBeNull()
  })
})

// ── Cross-runtime fixture validation (#38) ──

import cases from '../test/fixtures/calculation_test_cases.json'

const ROUND = (v: number | null) => v == null ? null : Math.round(v * 100) / 100

describe('cross-runtime fixture tests', () => {
  it.each(cases)('$name', (payload: any) => {
    const exp = payload.expected
    const result = calculateTradeMetrics({
      entryPrice: payload.entry_price,
      exitPrice: payload.exit_price,
      quantity: payload.quantity,
      fees: payload.fees,
      stopPrice: payload.stop_price,
      targetPrice: payload.target_price,
      direction: payload.direction,
    })

    expect(ROUND(result.pnlPerUnit)).toBe(ROUND(exp.pnl_per_unit))
    expect(ROUND(result.grossPnl)).toBe(ROUND(exp.gross_pnl))
    expect(ROUND(result.netPnl)).toBe(ROUND(exp.net_pnl))
    expect(ROUND(result.riskPerUnit)).toBe(ROUND(exp.risk_per_unit))
    expect(ROUND(result.rewardPerUnit)).toBe(ROUND(exp.reward_per_unit))
    expect(ROUND(result.riskAmount)).toBe(ROUND(exp.risk_amount))
    expect(ROUND(result.plannedRewardAmount)).toBe(ROUND(exp.planned_reward_amount))
    expect(ROUND(result.riskRewardRatio)).toBe(ROUND(exp.risk_reward_ratio))
    expect(ROUND(result.rMultiple)).toBe(ROUND(exp.r_multiple))
    expect(result.isValidForPnl).toBe(exp.is_valid_for_pnl)
    expect(result.isValidForRiskReward).toBe(exp.is_valid_for_risk_reward)
    expect(result.warnings).toEqual(exp.warnings)
  })
})
