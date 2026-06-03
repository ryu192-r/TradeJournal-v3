import type { ApiTrade } from '@/types'
import { type TradeFormData, isoToDatetimeLocal, nowIST } from '@/schemas/tradeForm'

export const EXCHANGE_OPTIONS = [
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'NSE', label: 'NSE' },
  { value: 'BSE', label: 'BSE' },
]

export const SEGMENT_OPTIONS = [
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'EQUITY_FNO', label: 'Equity F&O' },
  { value: 'COMMODITY', label: 'Commodity' },
  { value: 'CURRENCY', label: 'Currency' },
]

export const PRODUCT_TYPE_OPTIONS = [
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'INTRADAY', label: 'Intraday' },
  { value: 'MTF', label: 'MTF' },
  { value: 'FNO', label: 'F&O' },
]

export function emptyTradeFormValues(): TradeFormData {
  return {
    symbol: '',
    entry_price: '',
    exit_price: undefined,
    quantity: '',
    entry_time: nowIST(),
    exit_time: undefined,
    fees: '0',
    setup: undefined,
    tactic: undefined,
    stop_price: undefined,
    target_price: undefined,
    tags: undefined,
    notes: undefined,
    exchange: 'UNKNOWN',
    segment: 'UNKNOWN',
    product_type: 'UNKNOWN',
    executed_order_count: undefined,
  }
}

export function apiTradeToFormValues(trade: ApiTrade): TradeFormData {
  const tagsStr = trade.tags ? trade.tags.join(', ') : undefined
  const currentStop = trade.current_stop_price ?? trade.stop_price ?? trade.original_stop_price
  return {
    symbol: trade.symbol,
    entry_price: String(trade.entry_price),
    exit_price: trade.exit_price != null ? String(trade.exit_price) : undefined,
    quantity: String(Number(trade.quantity)),
    entry_time: isoToDatetimeLocal(trade.entry_time),
    exit_time: isoToDatetimeLocal(trade.exit_time),
    fees: String(trade.fees ?? 0),
    setup: trade.setup || undefined,
    tactic: trade.tactic || undefined,
    stop_price: currentStop != null ? String(currentStop) : undefined,
    target_price: trade.target_price != null ? String(trade.target_price) : undefined,
    tags: tagsStr,
    notes: trade.notes || undefined,
    exchange: trade.exchange || 'UNKNOWN',
    segment: trade.segment || 'UNKNOWN',
    product_type: trade.product_type || 'UNKNOWN',
    executed_order_count: trade.executed_order_count != null ? String(trade.executed_order_count) : undefined,
  }
}
