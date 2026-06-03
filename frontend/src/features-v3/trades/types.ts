import type { ApiTrade } from '@/types'

export type TradesV3Period = 'today' | 'week' | 'month' | 'all'
export type TradesV3StatusFilter = 'active' | 'open' | 'partial' | 'closed' | 'deleted'
export type TradesV3DirectionFilter = 'all' | 'long' | 'short'
export type TradesV3AttentionFilter =
  | 'all'
  | 'missing_setup'
  | 'missing_notes'
  | 'missing_sl'
  | 'review_pending'
  | 'partial_open'
export type TradesV3Sort =
  | 'newest'
  | 'oldest'
  | 'pnl_high'
  | 'pnl_low'
  | 'r_high'
  | 'symbol'

export interface TradesV3Filters {
  search: string
  status: TradesV3StatusFilter
  direction: TradesV3DirectionFilter
  period: TradesV3Period
  setup: string
  attention: TradesV3AttentionFilter
  sort: TradesV3Sort
}

export interface TradesV3Data {
  trades: ApiTrade[]
  total: number
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export interface TradeQualityBadge {
  id: string
  label: string
  tone: 'neutral' | 'accent' | 'profit' | 'loss' | 'warning' | 'info'
}

export interface TradesV3Summary {
  total: number
  open: number
  partial: number
  closed: number
  deleted: number
  grossPnl: number | null
  avgR: number | null
  winRate: number | null
  missingSetup: number
  missingNotes: number
  missingStop: number
  needsAttention: number
}

export interface TradesV3PageProps {
  dataEnabled?: boolean
  onOpenTradeDetail?: (tradeId: number) => void
  /** @deprecated Use onOpenTradeDetail */
  onOpenLegacyDetail?: (tradeId: number) => void
}
