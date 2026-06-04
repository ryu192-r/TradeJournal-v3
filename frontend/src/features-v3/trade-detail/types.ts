import type { ApiTrade, PartialExit, StopHistoryEntry, TimelineEvent } from '@/types'

export interface TradeDetailV3PageProps {
  tradeId: number
  onOpenLegacyWorkspace?: () => void
}

export interface TradeDetailV3Data {
  trade: ApiTrade | undefined
  partialExits: PartialExit[]
  stopHistory: StopHistoryEntry[]
  timelineEvents: TimelineEvent[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export type TradeDetailTimelineKind = 'entry' | 'stop' | 'partial' | 'exit' | 'review' | 'status' | 'timeline'

export interface TradeDetailTimelineEvent {
  id: string
  timestamp: string
  label: string
  detail: string
  kind: TradeDetailTimelineKind
  type?: string
  sourceId?: number | null
}

export type RiskProtectionState =
  | 'planned_risk'
  | 'risk_reduced'
  | 'risk_free'
  | 'profit_locked'
  | 'no_sl'
  | 'unavailable'
