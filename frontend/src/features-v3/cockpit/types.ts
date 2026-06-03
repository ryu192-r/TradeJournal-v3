import type { ApiTrade, IntelligenceDashboardPayload, OperationalDashboardPayload } from '@/types'

export type CockpitPeriod = 'today' | 'week' | 'month' | 'all'
export type CockpitTone = 'neutral' | 'accent' | 'profit' | 'loss' | 'warning' | 'info'

export interface CockpitV3Data {
  operational?: OperationalDashboardPayload
  intelligence?: IntelligenceDashboardPayload
  trades: ApiTrade[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export interface CockpitActionItem {
  id: string
  type: 'review' | 'risk' | 'setup' | 'charges' | 'position'
  tone: CockpitTone
  title: string
  reason: string
  trade?: ApiTrade
}

export interface CockpitSignal {
  id: string
  tone: CockpitTone
  title: string
  detail: string
}

export interface CockpitSetupSummary {
  name: string
  tradeCount: number
  closedCount: number
  grossPnl: number
  wins: number
  winRate: number | null
}

export interface CockpitMetrics {
  periodTrades: ApiTrade[]
  activeTrades: ApiTrade[]
  closedTrades: ApiTrade[]
  deletedExcludedCount: number
  grossPnl: number | null
  recordedFees: number | null
  hasRecordedFees: boolean
  chargesState: 'recorded' | 'pending' | 'no_trades'
  netPnlState: 'available' | 'pending_charges' | 'no_trades'
  netPnl: number | null
  openRisk: number | null
  winRate: number | null
  avgR: number | null
  reviewItems: CockpitActionItem[]
  attentionSignals: CockpitSignal[]
  setupSummaries: CockpitSetupSummary[]
  untaggedCount: number
}
