// Coaching Intelligence types — matches backend schemas in schemas/coaching_intelligence.py

export interface CoachingPriority {
  id: string
  title: string
  category: string
  severity: string
  reason: string
  evidence: string
  action: string
  due_context?: string | null
  related_recommendation_ids?: string[]
  related_trade_ids?: number[]
}

export interface SetupConfidenceScore {
  setup: string
  score: number
  label: 'avoid' | 'watch' | 'developing' | 'trusted' | 'priority'
  sample_size: number
  win_rate: number | null
  avg_r: number | null
  total_pnl: number | null
  consistency_score: number | null
  risk_score: number | null
  notes: string | null
}

export interface BehavioralDriftSignal {
  id: string
  title: string
  severity: string
  metric: string
  current_value: number | null
  baseline_value: number | null
  change: number | null
  explanation: string
  suggested_action: string
  related_trade_ids: number[]
}

export interface WeeklyCoachingPlan {
  generated_at: string
  week_start: string
  week_end: string
  headline: string
  primary_focus: string
  priorities: CoachingPriority[]
  setup_scores: SetupConfidenceScore[]
  behavioral_drift: BehavioralDriftSignal[]
  review_prompts: string[]
  rules_for_next_week: string[]
  recommended_size_adjustments: string[]
  summary_markdown: string
}

export interface TradeReviewPrompt {
  trade_id: number
  symbol: string
  setup: string | null
  prompt: string
  focus_area: string
  why_this_trade: string
  related_patterns: string[]
  questions: string[]
}

export interface CoachingIntelligenceDashboard {
  generated_at: string
  weekly_plan: WeeklyCoachingPlan | null
  top_trade_review_prompts: TradeReviewPrompt[]
  setup_scores: SetupConfidenceScore[]
  behavioral_drift: BehavioralDriftSignal[]
  next_best_actions: string[]
}
