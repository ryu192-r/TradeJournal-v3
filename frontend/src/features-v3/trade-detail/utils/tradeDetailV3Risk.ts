import type { ApiTrade } from '@/types'
import { computeMaxRisk } from '@/utils/calculations'
import { safeNumber } from '../../trades/utils/tradesV3Formatters'
import type { RiskProtectionState } from '../types'

function readOriginalStop(trade: ApiTrade): string | null {
  return trade.original_stop_price ?? null
}

function readCurrentStop(trade: ApiTrade): string | null {
  return trade.current_stop_price ?? trade.stop_price ?? null
}

export function getDisplayOriginalStop(trade: ApiTrade): string | null {
  return readOriginalStop(trade)
}

export function getDisplayCurrentStop(trade: ApiTrade): string | null {
  return readCurrentStop(trade)
}

export function getOriginalPlannedRisk(trade: ApiTrade): number | null {
  const entry = safeNumber(trade.entry_price)
  const stop = safeNumber(readOriginalStop(trade) ?? trade.stop_price)
  const qty = safeNumber(trade.remaining_qty ?? trade.quantity)
  if (entry == null || stop == null || qty == null) return null
  return computeMaxRisk(entry, stop, qty, trade.direction)
}

export function getCurrentProtectionRisk(trade: ApiTrade): number | null {
  const entry = safeNumber(trade.entry_price)
  const stop = safeNumber(readCurrentStop(trade))
  const qty = safeNumber(trade.remaining_qty ?? trade.quantity)
  if (entry == null || stop == null || qty == null) return null
  return computeMaxRisk(entry, stop, qty, trade.direction)
}

export function getRiskPerShare(trade: ApiTrade, useOriginal = true): number | null {
  const entry = safeNumber(trade.entry_price)
  const stop = safeNumber(useOriginal ? readOriginalStop(trade) ?? trade.stop_price : readCurrentStop(trade))
  if (entry == null || stop == null) return null
  const risk = trade.direction === 'SHORT' ? stop - entry : entry - stop
  return Number.isFinite(risk) ? risk : null
}

export function getRiskProtectionState(trade: ApiTrade): RiskProtectionState {
  const originalStop = readOriginalStop(trade)
  const currentStop = readCurrentStop(trade)

  if (!originalStop && !currentStop) return 'no_sl'

  const status = trade.stop_loss_status ?? 'original'
  if (status === 'risk_free') return 'risk_free'
  if (status === 'profit_locked') return 'profit_locked'
  if (status === 'breakeven' || status === 'trailing' || status === 'manual') return 'risk_reduced'
  if (originalStop || currentStop) return 'planned_risk'
  return 'unavailable'
}

export function getOriginalStopModeLabel(trade: ApiTrade): string {
  if (!readOriginalStop(trade)) return 'Not set'
  return 'Original planned'
}

export function getCurrentStopModeLabel(trade: ApiTrade): string {
  const status = trade.stop_loss_status ?? 'original'
  if (!readCurrentStop(trade)) return 'Not set'
  if (status === 'risk_free') return 'Risk-free'
  if (status === 'profit_locked') return 'Profit locked'
  if (status === 'breakeven') return 'Breakeven'
  if (status === 'trailing') return 'Trailing'
  if (status === 'manual') return 'Manual'
  return 'Current protection'
}
