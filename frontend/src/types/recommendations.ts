export type RecommendationSeverity = 'info' | 'positive' | 'warning' | 'critical'

export type RecommendationCategory =
  | 'setup'
  | 'risk'
  | 'execution'
  | 'psychology'
  | 'timing'
  | 'market_context'
  | 'review'
  | 'capital'

export type RecommendationActionType =
  | 'increase_focus'
  | 'reduce_size'
  | 'pause_setup'
  | 'review_trades'
  | 'improve_rule'
  | 'journal_prompt'
  | 'capital_adjustment'
  | 'continue_behavior'

export interface RecommendationEvidence {
  metric: string
  value: string | number | null
  benchmark?: string | number | null
  sample_size?: number | null
  detail?: string | null
}

export interface TradingRecommendation {
  id: string
  category: RecommendationCategory
  severity: RecommendationSeverity
  action_type: RecommendationActionType
  title: string
  summary: string
  why: string
  suggested_action: string
  confidence: number
  evidence: RecommendationEvidence[]
  related_setup?: string | null
  related_trade_ids?: number[]
  created_for_period?: string
  priority_score: number
}

export interface RecommendationSummary {
  strengths: string[]
  risks: string[]
  focus_this_week: string[]
  avoid_this_week: string[]
}

export interface RecommendationDashboardResponse {
  generated_at: string
  period_start?: string | null
  period_end?: string | null
  total_trades: number
  closed_trades: number
  recommendations: TradingRecommendation[]
  summary: RecommendationSummary
}
