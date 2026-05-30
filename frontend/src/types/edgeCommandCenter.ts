export type EdgePriorityCategory =
  | 'focus' | 'avoid' | 'risk' | 'review' | 'setup' | 'psychology' | 'workflow'
export type EdgePrioritySeverity = 'positive' | 'info' | 'warning' | 'critical'
export type EdgePrioritySource =
  | 'recommendation' | 'coaching' | 'trade_review_v2' | 'performance_os' | 'derived'
export type EdgeSetupAction = 'focus' | 'watch' | 'avoid' | 'develop'
export type EdgeReviewSeverity = 'info' | 'warning' | 'critical'

export interface EdgePriority {
  id: string
  title: string
  category: EdgePriorityCategory
  severity: EdgePrioritySeverity
  summary: string
  action: string
  evidence: string[]
  related_trade_ids: number[]
  related_setup: string | null
  source: EdgePrioritySource
}

export interface EdgeSetupFocus {
  setup: string
  score: number
  label: string
  action: EdgeSetupAction
  reason: string
  evidence: string[]
}

export interface EdgeReviewQueueItem {
  trade_id: number
  symbol: string
  setup: string | null
  reason: string
  severity: EdgeReviewSeverity
  score: number | null
  mistake_tags: string[]
}

export interface EdgeWorkflowStatus {
  date: string
  phase: string | null
  is_complete: boolean
  progress_percent: number
  next_step: string
  missing_items: string[]
}

export interface EdgeCommandCenterSummary {
  focus_today: string[]
  avoid_today: string[]
  review_today: string[]
  risk_warnings: string[]
  strengths: string[]
}

export interface EdgeDataQuality {
  closed_trades: number
  total_trades: number
  has_recommendations: boolean
  has_coaching: boolean
  has_trade_reviews: boolean
  notes: string[]
}

export interface EdgeCommandCenterResponse {
  generated_at: string
  period_start: string
  period_end: string
  headline: string
  primary_focus: string
  next_best_action: string
  priorities: EdgePriority[]
  setup_focus: EdgeSetupFocus[]
  review_queue: EdgeReviewQueueItem[]
  workflow: EdgeWorkflowStatus | null
  summary: EdgeCommandCenterSummary
  data_quality: EdgeDataQuality
  playbook_edge?: PlaybookEdgeCommandCenter | null
}

export interface PlaybookEdgeCommandCenter {
  focus_setups: string[]
  pause_setups: string[]
  highest_expectancy: import('@/types/playbookEdge').PlaybookEdgeSummaryItem | null
  lowest_expectancy: import('@/types/playbookEdge').PlaybookEdgeSummaryItem | null
}
