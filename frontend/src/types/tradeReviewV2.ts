export type ScoreLabel = 'excellent' | 'good' | 'average' | 'weak' | 'critical'
export type MistakeSeverity = 'info' | 'warning' | 'critical'
export type MistakeCategory = 'setup' | 'entry' | 'exit' | 'risk' | 'psychology' | 'process'

export interface ReviewDimensionScore {
  dimension: string
  score: number
  label: ScoreLabel
  reason: string
  evidence: string[]
  improvement: string | null
}

export interface MistakeTag {
  tag: string
  severity: MistakeSeverity
  category: MistakeCategory
  explanation: string
  suggested_fix: string
}

export interface TradeReviewV2Response {
  trade_id: number
  symbol: string
  setup: string | null
  direction: string
  status: string
  reviewed_at: string
  overall_score: number
  overall_label: ScoreLabel
  verdict: string
  dimension_scores: ReviewDimensionScore[]
  mistake_tags: MistakeTag[]
  strengths: string[]
  weaknesses: string[]
  what_should_have_happened: string[]
  next_time_rules: string[]
  review_questions: string[]
  evidence: Record<string, unknown>
  source: string
}

export interface TradeReviewBatchSummary {
  avg_score: number
  common_mistakes: string[]
  strongest_dimension: string | null
  weakest_dimension: string | null
}

export interface TradeReviewBatchResponse {
  generated_at: string
  count: number
  reviews: TradeReviewV2Response[]
  summary: TradeReviewBatchSummary
}
