// AI Coach types — matches backend schemas in schemas/coach.py

export interface PatternResult {
  name: string
  severity: 'positive' | 'negative' | 'neutral'
  description: string
  evidence: string
  suggestion?: string | null
}

export interface PatternDetectionResponse {
  patterns: PatternResult[]
  trades_analyzed: number
  lookback_days: number
  model_used: string
  generated_at: string
}

export interface RuleReminderResponse {
  reminder: string
  trades_analyzed: number
  rules_checked: number
  model_used: string
  generated_at: string
}

export interface CoachReviewResponse {
  insight: string
  review_type: 'daily' | 'weekly' | 'insight' | 'answer'
  trades_analyzed: number
  model_used: string
  generated_at: string
}

export interface CoachReviewListItem {
  id: number
  review_type: string
  content_preview: string
  period_start: string | null
  period_end: string | null
  trades_analyzed: number
  model_used: string
  created_at: string
}

export interface CoachReviewListResponse {
  total: number
  items: CoachReviewListItem[]
}

export interface CoachReviewRequest {
  trade_ids?: number[]
  period_start?: string
  period_end?: string
  context?: string
}

export interface AskCoachRequest {
  question: string
  trade_ids?: number[]
  period_start?: string
  period_end?: string
}

export interface PatternDetectionRequest {
  lookback_days?: number
}

export interface RuleReminderRequest {
  lookback_days?: number
  rules?: string[]
}
