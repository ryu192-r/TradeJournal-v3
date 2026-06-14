// ────────────────────────── Performance OS types ──────────────────────────

export type WorkflowPhase = 'pre_market' | 'execution' | 'review' | 'behavior'

export interface ChecklistItem {
  id: string
  label: string
  checked: boolean
}

export interface DailyWorkflow {
  id: number
  date: string
  phase: WorkflowPhase
  pre_market_done: boolean
  execution_done: boolean
  review_done: boolean
  behavior_done: boolean
  checklist_items: ChecklistItem[]
  watchlist_symbols: string[]
  pre_market_notes: string | null
  intraday_notes: string | null
  post_market_notes: string | null
  mood_rating: number | null
  discipline_rating: number | null
  created_at: string
  updated_at: string
}

export interface DailyWorkflowUpdate {
  phase?: WorkflowPhase
  pre_market_done?: boolean
  execution_done?: boolean
  review_done?: boolean
  behavior_done?: boolean
  checklist_items?: ChecklistItem[]
  watchlist_symbols?: string[]
  pre_market_notes?: string | null
  intraday_notes?: string | null
  post_market_notes?: string | null
  mood_rating?: number | null
  discipline_rating?: number | null
}

export interface PhaseProgress {
  current_phase: WorkflowPhase
  current_index: number
  phases: WorkflowPhase[]
  completed: [boolean, boolean, boolean, boolean]
  all_done: boolean
}

export interface DailyDashboard {
  workflow: DailyWorkflow | null
  today_trades: { id: number; symbol: string; entry_price: string; exit_price: string | null; quantity: string; pnl: string | null; setup: string | null; exit_reason: string | null }[]
  open_positions: { id: number; symbol: string; entry_price: string; quantity: string; stop_price: string | null; target_price: string | null; setup: string | null; entry_time: string | null }[]
  market_regime: { nifty_close: string | null; nifty_trend: string | null; nifty_regime: string | null; india_vix: string | null; advance_count: number | null; decline_count: number | null } | null
  journal: { id: number; mood_rating: number | null; discipline_rating: number | null; rules_followed: string | null; rules_violated: string | null } | null
  discipline_score: { avg_execution_grade: number; total_graded: number } | null
  phase_progress: PhaseProgress
}

export interface WeeklyReview {
  id: number
  week_start: string
  week_end: string
  total_trades: number
  total_pnl: string
  win_rate: string | null
  best_trade_id: number | null
  worst_trade_id: number | null
  top_setup: string | null
  rules_followed: number
  rules_violated: number
  key_lessons: string | null
  discipline_score: string | null
  emotion_summary: Record<string, unknown> | null
  notes: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

export interface WeeklyReviewDetail extends WeeklyReview {
  best_trade: { id: number; symbol: string; pnl: string } | null
  worst_trade: { id: number; symbol: string; pnl: string } | null
  daily_breakdown: { date: string; trades: number; pnl: string }[]
  setup_breakdown: { setup: string; count: number; pnl: string }[]
}

export interface MonthlyReview {
  id: number
  month: string
  total_trades: number
  total_pnl: string
  win_rate: string | null
  profit_factor: string | null
  avg_r: string | null
  best_setup: string | null
  worst_setup: string | null
  best_day: string | null
  worst_day: string | null
  discipline_avg: string | null
  behavioral_patterns: Record<string, unknown> | null
  rule_compliance_rate: string | null
  capital_growth_pct: string | null
  goals_met: Record<string, unknown>[] | null
  next_month_goals: Record<string, unknown>[] | null
  notes: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

export interface MonthlyReviewDetail extends MonthlyReview {
  weekly_summaries: { week_start: string; total_trades: number; total_pnl: string }[]
  top_emotions: { emotion: string; count: number }[]
  setup_performance: { setup: string; count: number; pnl: string }[]
}

export interface WeeklyReviewUpdate {
  key_lessons?: string | null
  rules_followed?: number | null
  rules_violated?: number | null
  discipline_score?: string | null
  emotion_summary?: Record<string, unknown> | null
  notes?: string | null
  completed?: boolean | null
}

export interface MonthlyReviewUpdate {
  best_setup?: string | null
  worst_setup?: string | null
  best_day?: string | null
  worst_day?: string | null
  discipline_avg?: string | null
  behavioral_patterns?: Record<string, unknown> | null
  rule_compliance_rate?: string | null
  capital_growth_pct?: string | null
  goals_met?: Record<string, unknown>[] | null
  next_month_goals?: Record<string, unknown>[] | null
  notes?: string | null
  completed?: boolean | null
}


// ────────────────────────── Improvement Action (ADR-025) ──────────────────────────

export type ImprovementActionStatus = 'suggested' | 'active' | 'kept' | 'broken' | 'retired'

export type ImprovementContractType =
  | 'no_early_entry'
  | 'max_trades'
  | 'cooldown_after_loss'
  | 'stop_not_widened'
  | 'manual_check'

export interface ImprovementAction {
  id: number
  title: string
  description: string | null
  status: ImprovementActionStatus
  due_session: string | null
  contract_type: ImprovementContractType
  contract_params: Record<string, unknown>
  source_evidence: Record<string, unknown>
  is_daily_focus: boolean
  created_at: string
  updated_at: string
}

export interface ImprovementActionCreate {
  title: string
  description?: string | null
  status?: ImprovementActionStatus
  due_session?: string | null
  contract_type?: ImprovementContractType
  contract_params?: Record<string, unknown>
  source_evidence?: Record<string, unknown>
}

export interface ImprovementActionUpdate {
  title?: string
  description?: string | null
  status?: ImprovementActionStatus
  due_session?: string | null
  contract_type?: ImprovementContractType
  contract_params?: Record<string, unknown>
  source_evidence?: Record<string, unknown>
}

export interface DailyFocus {
  date: string
  focus: ImprovementAction | null
  backlog: ImprovementAction[]
}

export type VerificationResultKind = 'kept' | 'broken' | 'manual'

export interface VerificationResult {
  action_id: number
  contract_type: ImprovementContractType
  session: string | null
  result: VerificationResultKind
  summary: string
  evidence: Record<string, unknown>
  requires_confirmation: boolean
}
