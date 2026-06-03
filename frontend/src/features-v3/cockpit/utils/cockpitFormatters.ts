import type { ApiTrade } from '@/types'
import { formatDateTime, formatQuantity } from '@/utils/format'
import { safeDisplay } from '@/new-ui'
import { safeNumber } from './cockpitMetrics'

export function tradeStatusLabel(trade: ApiTrade): string {
  if (trade.status === 'deleted') return 'Deleted'
  if (trade.status === 'closed') return 'Closed'
  return 'Open'
}

export function displayTradeDate(trade: ApiTrade): string {
  return trade.entry_time ? formatDateTime(trade.entry_time) : '—'
}

export function displayQuantity(value: string | number | null | undefined): string {
  const qty = safeNumber(value)
  return qty == null ? '—' : formatQuantity(qty)
}

export function displaySetup(trade: ApiTrade): string {
  return trade.setup?.trim() || trade.tags?.[0] || 'No setup'
}

export function displayStop(trade: ApiTrade): string {
  return safeDisplay(trade.current_stop_price ?? trade.stop_price, 'No SL')
}
