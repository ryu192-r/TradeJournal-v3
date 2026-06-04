import type { ApiTrade } from '@/types'
import type { TradeQualityBadge, TradesV3Summary } from '../types'
import { getCurrentStop, safeNumber } from './tradesV3Formatters'

export function isDeletedTrade(trade: ApiTrade): boolean {
  return trade.status === 'deleted'
}

export function isClosedTradeV3(trade: ApiTrade): boolean {
  return trade.status === 'closed'
}

export function isOpenTradeV3Wrapper(trade: ApiTrade): boolean {
  if (isDeletedTrade(trade)) return false
  const remaining = safeNumber(trade.remaining_qty ?? trade.quantity)
  return trade.status === 'open' || (trade.status !== 'closed' && remaining != null && remaining > 0)
}

export function isPartialTradeV3(trade: ApiTrade): boolean {
  if (!isOpenTradeV3Wrapper(trade)) return false
  const remaining = safeNumber(trade.remaining_qty)
  const quantity = safeNumber(trade.quantity)
  const hasPartialPnl = safeNumber(trade.partial_realized_pnl) != null
  return hasPartialPnl || (remaining != null && quantity != null && remaining > 0 && remaining < quantity)
}

export function getTradeDisplayStatus(trade: ApiTrade): 'open' | 'partial' | 'closed' | 'deleted' {
  if (isDeletedTrade(trade)) return 'deleted'
  if (isPartialTradeV3(trade)) return 'partial'
  if (isOpenTradeV3Wrapper(trade)) return 'open'
  if (isClosedTradeV3(trade)) return 'closed'
  return 'open'
}

export function getTradeGrossPnl(trade: ApiTrade): number | null {
  const pnl = safeNumber(trade.pnl)
  if (pnl == null) return null
  return pnl + (safeNumber(trade.fees) ?? 0)
}

export function getTradeRMultiple(trade: ApiTrade): number | null {
  return safeNumber(trade.r_multiple)
}

export function hasMissingSetup(trade: ApiTrade): boolean {
  return !trade.setup?.trim() && (trade.tags?.length ?? 0) === 0
}

export function hasMissingNotes(trade: ApiTrade): boolean {
  return !trade.notes?.trim() && !trade.review_notes?.trim()
}

export function hasMissingStop(trade: ApiTrade): boolean {
  return isOpenTradeV3Wrapper(trade) && !getCurrentStop(trade)
}

export function isReviewPending(trade: ApiTrade): boolean {
  return isClosedTradeV3(trade) && hasMissingNotes(trade)
}

export function buildTradeQualityBadges(trade: ApiTrade): TradeQualityBadge[] {
  const badges: TradeQualityBadge[] = []

  if (isDeletedTrade(trade)) badges.push({ id: 'deleted', label: 'Deleted', tone: 'neutral' })
  if (isPartialTradeV3(trade)) badges.push({ id: 'partial', label: 'Partial open', tone: 'accent' })
  if (hasMissingSetup(trade)) badges.push({ id: 'missing-setup', label: 'Missing setup', tone: 'warning' })
  if (hasMissingNotes(trade)) badges.push({ id: 'missing-notes', label: 'Missing notes', tone: 'warning' })
  if (hasMissingStop(trade)) badges.push({ id: 'missing-sl', label: 'Missing SL', tone: 'loss' })
  if (isReviewPending(trade)) badges.push({ id: 'review-pending', label: 'Review pending', tone: 'info' })

  return badges.slice(0, 4)
}

export function summarizeTrades(trades: ApiTrade[], includeDeleted = false): TradesV3Summary {
  const scoped = includeDeleted ? trades : trades.filter((trade) => !isDeletedTrade(trade))
  const closed = scoped.filter(isClosedTradeV3)
  const pnlValues = closed
    .map(getTradeGrossPnl)
    .filter((value): value is number => value != null)
  const rValues = closed
    .map(getTradeRMultiple)
    .filter((value): value is number => value != null)
  const wins = closed.filter((trade) => (getTradeGrossPnl(trade) ?? 0) > 0).length
  const missingSetup = scoped.filter(hasMissingSetup).length
  const missingNotes = scoped.filter(hasMissingNotes).length
  const missingStop = scoped.filter(hasMissingStop).length

  return {
    total: scoped.length,
    open: scoped.filter(isOpenTradeV3Wrapper).length,
    partial: scoped.filter(isPartialTradeV3).length,
    closed: closed.length,
    deleted: trades.filter(isDeletedTrade).length,
    grossPnl: pnlValues.length > 0 ? pnlValues.reduce((sum, value) => sum + value, 0) : null,
    avgR: rValues.length > 0 ? rValues.reduce((sum, value) => sum + value, 0) / rValues.length : null,
    winRate: closed.length > 0 ? (wins / closed.length) * 100 : null,
    missingSetup,
    missingNotes,
    missingStop,
    needsAttention: missingSetup + missingNotes + missingStop + scoped.filter(isPartialTradeV3).length,
  }
}
