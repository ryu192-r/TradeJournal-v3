import type { ApiTrade } from '@/types'
import { formatDateTime, formatPrice, formatQuantity } from '@/utils/format'
import { getTradeSessionDate } from '@/utils/tradeDates'

export function safeNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[₹,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function safeText(value: unknown, fallback = '—'): string {
  if (value == null) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback
  if (typeof value === 'string') return value.trim() || fallback
  return fallback
}

export function normalizeTradeSymbol(value: unknown): string {
  return safeText(value, '').trim().toUpperCase()
}

export function getTradeDirection(trade: ApiTrade): string {
  return safeText(trade.direction, 'LONG').toUpperCase()
}

export function getTradeSetup(trade: ApiTrade): string {
  return safeText(trade.setup, 'No setup')
}

export function getTradeNotes(trade: ApiTrade): string {
  return safeText(trade.review_notes ?? trade.notes, 'No notes')
}

export function getTradeSessionDateSafe(trade: ApiTrade): string {
  return getTradeSessionDate(trade) ?? '—'
}

export function formatTradeDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return formatDateTime(value)
}

export function formatTradePrice(value: string | number | null | undefined, fallback = '—'): string {
  const number = safeNumber(value)
  return number == null ? fallback : formatPrice(number)
}

export function formatTradeQuantity(value: string | number | null | undefined, fallback = '—'): string {
  const number = safeNumber(value)
  return number == null ? fallback : formatQuantity(number)
}

export function getOriginalStop(trade: ApiTrade): string | null {
  return trade.original_stop_price ?? trade.stop_price ?? null
}

export function getCurrentStop(trade: ApiTrade): string | null {
  return trade.current_stop_price ?? trade.stop_price ?? null
}

export function getProtectionStatusLabel(trade: ApiTrade): string {
  const status = trade.stop_loss_status ?? 'original'
  if (status === 'risk_free') return 'Risk-free'
  if (status === 'profit_locked') return 'Profit locked'
  if (status === 'breakeven') return 'Breakeven'
  if (status === 'trailing') return 'Trailing'
  if (status === 'manual') return 'Manual'
  return 'Planned risk'
}
