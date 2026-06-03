// Shared TypeScript types for the trading journal

export type TradeDirection = 'LONG'

export type TradeStatus = 'OPEN' | 'CLOSED' | 'MISSED'

export type BackendTradeStatus = 'open' | 'closed' | 'deleted'
export type SetupType =
  | 'EP'
  | 'Momentum Burst'
  | 'Pullback'
  | 'Reversal'
  | 'IPO'
  | 'Gap Up'
  | 'Parabolic Long'
  | 'Custom'

export type EntryTactic =
  | 'ORB'
  | 'PDH'
  | '10-DMA Touch'
  | 'Intraday Reversal'
  | 'Custom'

export interface Trade {
  id: number
  symbol: string
  direction: TradeDirection
  setup: SetupType
  tactic: EntryTactic
  entryDate: string
  exitDate?: string
  entryPrice: number
  exitPrice?: number
  quantity: number
  stopLoss: number
  target?: number
  realizedPnl?: number
  rMultiple?: number
  status: TradeStatus
  tags: string[]
  notes?: string
  chartImages?: string[]
}

// ---------------------------------------------------------------------------
// Backend API types (snake_case, matches TradeResponse schema)
// ---------------------------------------------------------------------------

export interface ApiTrade {
  id: number
  symbol: string
  direction: string
  entry_price: string
  exit_price: string | null
  quantity: string
  entry_time: string
  exit_time: string | null
  fees: string
  notes: string | null
  tags: string[] | null
  setup: string | null
  tactic: string | null
  original_stop_price?: string | null
  current_stop_price?: string | null
  stop_loss_status?: 'original' | 'breakeven' | 'trailing' | 'manual' | 'risk_free' | 'profit_locked' | null
  stop_price: string | null
  target_price: string | null
  r_multiple: string | null
  status: BackendTradeStatus
  pnl?: string | null
  chart_images?: string[] | null
  review_notes?: string | null
  review_tags?: string[] | null
  exit_reason?: string | null
  created_at?: string
  updated_at?: string
  remaining_qty?: string | null
  partial_realized_pnl?: string | null
  unrealized_pnl?: string | null
  weighted_avg_exit_price?: string | null
  exchange?: string
  segment?: string
  product_type?: string
  executed_order_count?: number | null
}

export interface ApiTradeListResponse {
  total: number
  items: ApiTrade[]
}

export interface OpenLiveTrade {
  id: number
  symbol: string
  entry_price: string
  quantity: string
  remaining_qty: string
  original_stop_price?: string | null
  current_stop_price?: string | null
  stop_loss_status?: 'original' | 'breakeven' | 'trailing' | 'manual' | 'risk_free' | 'profit_locked' | null
  stop_price: string | null
  fees: string
}

export interface ApiTradeUpdatePayload {
  symbol?: string
  direction?: string
  entry_price?: string
  exit_price?: string | null
  quantity?: string
  entry_time?: string
  exit_time?: string | null
  fees?: string
  notes?: string | null
  tags?: string[] | null
  setup?: string | null
  tactic?: string | null
  stop_price?: string | null
  original_stop_price?: string | null
  stop_loss_status?: 'original' | 'breakeven' | 'trailing' | 'manual' | 'risk_free' | 'profit_locked' | null
  target_price?: string | null
  r_multiple?: string | null
  status?: BackendTradeStatus
  exit_reason?: string | null
  review_notes?: string | null
  review_tags?: string[] | null
}

export interface DashboardKpi {
  totalPnl: number
  winRate: number
  avgRMultiple: number
  maxDrawdown: number
  tradesThisMonth: number
  profitFactor: number
  expectancy: number
}

// Review-specific types
export type ReviewTag =
  | 'entered-too-early'
  | 'broke-stop-rule'
  | 'took-stop-too-quick'
  | 'fomo-trade'
  | 'emotional-decision'
  | string // custom tags

// ---------------------------------------------------------------------------
// Daily Journal types (matches DailyJournal ORM model)
// ---------------------------------------------------------------------------

export type JournalType = 'PRE_MARKET' | 'POST_MARKET'

export interface DailyJournal {
  id: number
  date: string
  pre_trade_notes: string | null
  post_trade_notes: string | null
  trade_count: number | null
  total_pnl: string | null
  avg_r_multiple: string | null
  win_rate: string | null
  mood_rating: number | null
  discipline_rating: number | null
  mood_notes: string | null
  rules_followed: string | null
  rules_violated: string | null
  lessons_learned: string | null
  created_at?: string
  updated_at?: string
}

export interface WeeklyJournalStats {
  week_start: string
  week_end: string
  trade_count: number
  total_pnl: string
  win_rate: string
  avg_r: string
}

export interface DailyJournalPayload {
  date: string
  pre_trade_notes?: string | null
  post_trade_notes?: string | null
  trade_count?: number | null
  mood_rating?: number | null
  discipline_rating?: number | null
  mood_notes?: string | null
  rules_followed?: string | null
  rules_violated?: string | null
  lessons_learned?: string | null
}

export interface JournalEntryFormData {
  preTradeNotes: string
  postTradeNotes: string
  moodRating: number | null
  moodNotes: string
  rulesFollowed?: string
  rulesViolated?: string
  lessonsLearned: string
}

export interface CalendarTrade {
  id: number
  symbol: string
  setup: string | null
  /** Asia/Kolkata session date from entry_time (YYYY-MM-DD) */
  session_date?: string | null
  entry_time: string | null
  exit_time: string | null
  entry_price: string
  exit_price: string | null
  quantity: string
  pnl: string | null
  chart_image_count: number
}

export interface CalendarEmotion {
  id: number
  trade_id: number
  emotion: string
  confidence: number | null
  stress: number | null
  note: string | null
  timestamp: string | null
}

export interface CalendarRealizedEvent {
  source: 'closed' | 'partial_exit'
  trade_id: number
  symbol: string
  setup: string | null
  realized_date: string | null
  timestamp: string | null
  pnl: string
  quantity: string
  exit_price: string | null
  r_multiple: string | null
  entry_time: string | null
  exit_time: string | null
}

export interface CalendarDay {
  date: string
  trade_count: number
  closed_count: number
  net_pnl: string
  win_rate: number | null
  discipline_rating: number | null
  discipline_score: number | null
  journal_done: boolean
  workflow_done: boolean
  workflow_phase: string | null
  warnings: string[]
  trades: CalendarTrade[]
  journal: {
    pre_trade_notes: string | null
    post_trade_notes: string | null
    mood_rating: number | null
    discipline_rating: number | null
    rules_followed: string | null
    rules_violated: string | null
    lessons_learned: string | null
  } | null
  emotions: CalendarEmotion[]
  realized_events: CalendarRealizedEvent[]
  ai_summary: string | null
}

export interface CalendarMonthPayload {
  month: string
  summary: {
    trade_count: number
    closed_count: number
    net_pnl: string
    journal_days: number
    warning_days: number
  }
  days: CalendarDay[]
}

export interface ReportTrade {
  id: number
  symbol: string
  setup: string
  entry_time: string | null
  exit_time: string | null
  entry_price: string
  exit_price: string | null
  quantity: string
  pnl: string | null
  r_multiple: string | null
  exit_reason: string | null
}

export interface DeterministicReportPayload {
  period: 'weekly' | 'monthly'
  start_date: string
  end_date: string
  summary: {
    trade_count: number
    closed_count: number
    net_pnl: string
    gross_profit: string
    gross_loss: string
    win_rate: number | null
    profit_factor: number | null
    best_trade: ReportTrade | null
    worst_trade: ReportTrade | null
  }
  daily_report: { date: string; trade_count: number; net_pnl: string }[]
  setup_report: { setup: string; trade_count: number; closed_count: number; net_pnl: string; win_rate: number | null }[]
  behavior_report: {
    journal_days: number
    avg_discipline_rating: number | null
    rule_violation_days: number
    top_emotions: { emotion: string; count: number }[]
  }
  trades: ReportTrade[]
  export_formats: string[]
}

// ---------------------------------------------------------------------------
// Analytics API types (matches analytics schemas)
// ---------------------------------------------------------------------------

export interface AnalyticsKpi {
  trade_count: number
  win_rate: number | null
  profit_factor: number | null
  expectancy: number | null
  avg_r_multiple: number | null
  max_drawdown_amount: number | null
  max_drawdown_pct: number | null
  net_pnl: string | null
  gross_profit: string | null
  gross_loss: string | null
}

export interface SetupPerformanceItem {
  setup: string
  trade_count: number
  win_rate: number | null
  total_pnl: string | null
  avg_pnl: string | null
  avg_r_multiple: number | null
  max_r: number | null
  min_r: number | null
  r_std: number | null
  profit_factor: number | null
  expectancy: number | null
}

export interface AnalyticsStreaks {
  current_streak: { type: string | null; count: number }
  longest_win_streak: number
  longest_loss_streak: number
  streaks: Array<{
    type: string
    count: number
    start_date: string | null
    end_date: string | null
  }>
}

export interface RDistributionBin {
  range_start: number
  range_end: number
  count: number
}

export interface AnalyticsRDist {
  bins: RDistributionBin[]
  mean_r: number | null
  median_r: number | null
  std_r: number | null
}

export interface MonthlyPnlEntry {
  month: string
  trade_count: number
  net_pnl: string | null
  win_rate: number | null
}

export interface DailyPnlEntry {
  date: string
  trade_count: number
  net_pnl: string | null
  cumulative_pnl: string | null
}

export interface DayOfWeekEntry {
  day: string
  day_index: number
  trade_count: number
  net_pnl: string | null
  win_rate: number | null
  avg_r: number | null
}

export interface TimeOfDayEntry {
  hour: number
  label: string
  trade_count: number
  net_pnl: string | null
  win_rate: number | null
  avg_r: number | null
}

export interface HoldingPeriodEntry {
  trade_id: number
  symbol: string
  setup: string | null
  holding_hours: number
  r_multiple: number | null
  pnl: string | null
}

export interface CapitalDashboardPayload {
  account_id: number
  account_name: string
  net_equity: string
  total_deposits: string
  total_withdrawals: string
  total_realized_pnl: string
  unrealized_pnl: string
  deployed_capital: string
  available_capital: string
  current_balance: string
  initial_balance: string
  breakeven_threshold: string
  total_trades: number
  win_rate: number | null
  best_trade: string
  worst_trade: string
  average_win: string
  average_loss: string
  profit_factor: number | null
  equity_curve: { date: string; equity: string }[]
  events: { id: number; date: string; type: string; amount: string; description: string | null }[]
  tiers: { name: string; min: string; max: string | null; current: boolean; progress_pct: number | null }[]
  progress_to_next_tier: number | null
}

export interface AccountInfo {
  id: number
  name: string
  broker: string | null
  account_number: string | null
  initial_balance: string
  current_balance: string
  breakeven_threshold: string | null
  currency: string
}

export interface CapitalEvent {
  id: number
  event_type: string
  amount: string
  timestamp: string
  description: string | null
  account_id: number
  trade_id: number | null
}

export type CapitalEventType = 'deposit' | 'withdrawal' | 'profit' | 'fee' | 'adjustment' | 'trade_deletion' | 'pyramid'

export interface TierConfigItem {
  id?: number
  name: string
  min_amount: string
  max_amount: string | null
  sort_order: number
}

export interface TierConfigListResponse {
  items: TierConfigItem[]
}

export interface BrokerInfo {
  id: string
  name: string
}

export interface BrokerImportResult {
  status: 'success' | 'error'
  added: number
  updated: number
  skipped: number
  total: number
  errors: string[]
  preview: (Record<string, string> & { _skipped?: boolean })[]
}

export interface StopHistoryEntry {
  id: number
  trade_id: number
  stop_type: 'initial' | 'manual' | 'breakeven' | 'trailing' | 'target'
  price: string
  timestamp: string
}

export interface StopHistoryListResponse {
  items: StopHistoryEntry[]
}

export interface StopHistoryCreatePayload {
  stop_type: string
  price: string
  timestamp: string
}

export interface FullDashboardPayload {
  kpi: AnalyticsKpi
  setup_performance: SetupPerformanceItem[]
  streaks: AnalyticsStreaks
  r_distribution: AnalyticsRDist
  monthly_pnl: MonthlyPnlEntry[]
  daily_pnl: DailyPnlEntry[]
  day_of_week: DayOfWeekEntry[]
  time_of_day: TimeOfDayEntry[]
  holding_period: HoldingPeriodEntry[]
}

// ---------------------------------------------------------------------------
// Trade Timeline types
// ---------------------------------------------------------------------------

export type TimelineEventType = 'trade_opened' | 'stop_updated' | 'target_updated' | 'pyramided' | 'partial_exit' | 'note_added' | 'conviction_changed' | 'emotion_logged' | 'trade_closed' | 'review_added'

export interface TimelineEvent {
  id: number
  trade_id: number
  event_type: TimelineEventType
  timestamp: string
  old_value: string | null
  new_value: string | null
  note: string | null
  emotion: string | null
  confidence: number | null
}

export interface TimelineEventCreatePayload {
  event_type: TimelineEventType
  old_value?: string | null
  new_value?: string | null
  note?: string | null
  emotion?: string | null
  confidence?: number | null
  timestamp?: string | null
}

export interface TimelineListResponse {
  items: TimelineEvent[]
}

// ---------------------------------------------------------------------------
// Partial Exit types
// ---------------------------------------------------------------------------

export interface PartialExit {
  id: number
  trade_id: number
  qty: string
  exit_price: string
  exit_time: string
  realized_pnl: string | null
  r_captured: string | null
  exit_reason: string | null
  note: string | null
}

export interface PartialExitCreatePayload {
  qty: string
  exit_price: string
  exit_time: string
  realized_pnl?: string | null
  r_captured?: string | null
  exit_reason?: string | null
  note?: string | null
}

export interface PartialExitListResponse {
  items: PartialExit[]
  remaining_qty: string
}

// ---------------------------------------------------------------------------
// Emotion Log types
// ---------------------------------------------------------------------------

export type EmotionType = 'calm' | 'fearful' | 'euphoric' | 'revenge' | 'fomo' | 'hesitant' | 'disciplined'

export interface EmotionLog {
  id: number
  trade_id: number
  emotion: EmotionType
  confidence: number | null
  stress: number | null
  conviction: number | null
  patience: number | null
  focus: number | null
  note: string | null
  timestamp: string
}

export interface EmotionLogCreatePayload {
  emotion: EmotionType
  confidence?: number | null
  stress?: number | null
  conviction?: number | null
  patience?: number | null
  focus?: number | null
  note?: string | null
  timestamp?: string | null
}

export interface EmotionLogListResponse {
  items: EmotionLog[]
}

// ---------------------------------------------------------------------------
// Execution Grade types
// ---------------------------------------------------------------------------

export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'F'

export interface ExecutionGrade {
  id: number
  trade_id: number
  entry_quality: GradeLetter | null
  sizing_quality: GradeLetter | null
  stop_quality: GradeLetter | null
  patience: GradeLetter | null
  rule_adherence: GradeLetter | null
  exit_quality: GradeLetter | null
  overall_grade: GradeLetter | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ExecutionGradeCreatePayload {
  entry_quality?: GradeLetter | null
  sizing_quality?: GradeLetter | null
  stop_quality?: GradeLetter | null
  patience?: GradeLetter | null
  rule_adherence?: GradeLetter | null
  exit_quality?: GradeLetter | null
  overall_grade?: GradeLetter | null
  notes?: string | null
}

export interface ExecutionGradeUpdatePayload {
  entry_quality?: GradeLetter | null
  sizing_quality?: GradeLetter | null
  stop_quality?: GradeLetter | null
  patience?: GradeLetter | null
  rule_adherence?: GradeLetter | null
  exit_quality?: GradeLetter | null
  overall_grade?: GradeLetter | null
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Lifecycle Analytics types
// ---------------------------------------------------------------------------

export interface EmotionSummaryEntry {
  emotion: string
  count: number
  avg_confidence: number | null
  avg_stress: number | null
  avg_conviction: number | null
  avg_patience: number | null
  avg_focus: number | null
  trade_count: number
  total_pnl: string
  win_rate: number | null
}

export interface EmotionSummaryResponse {
  emotions: EmotionSummaryEntry[]
  total_logs: number
  most_frequent: string | null
  worst_performing: string | null
}

export interface GradePnlEntry {
  grade: string
  count: number
  avg_pnl: string
  total_pnl: string
  win_rate: number | null
}

export interface GradeSummaryResponse {
  grade_distribution: Record<string, number>
  dimension_averages: Record<string, number | null>
  grade_pnl: GradePnlEntry[]
  avg_overall: number | null
}

export interface EmotionGradeMatrixEntry {
  emotion: string
  count: number
  avg_pnl: number
  total_pnl: number
  win_rate: number
  avg_grade_numeric: number | null
}

export interface BehavioralInsight {
  type: 'warning' | 'insight'
  message: string
  emotion: string
}

export interface BehavioralAnalyticsResponse {
  emotion_grade_matrix: EmotionGradeMatrixEntry[]
  discipline_score: number | null
  insights: BehavioralInsight[]
}

export interface RevengeTrade {
  trade_id: number
  symbol: string
  entry_time: string | null
  pnl: string | null
  emotion: string | null
  flagged_reason: 'emotion' | 'window' | 'both'
  hours_after_loss: number | null
}

export interface RevengeTradesResponse {
  revenge_trades: RevengeTrade[]
  total_flagged: number
  avg_pnl_flagged: number | null
  avg_pnl_unflagged: number | null
}

// ---------------------------------------------------------------------------
// Overtrading Detection types
// ---------------------------------------------------------------------------

export interface OvertradingDay {
  date: string
  trade_count: number
  threshold: number
  total_pnl: number | null
  avg_pnl: number | null
  win_rate: number | null
  emotions: string[]
  trade_ids: number[]
}

export interface OvertradingWeek {
  week: string
  trade_count: number
  threshold: number
  total_pnl: number | null
  avg_pnl: number | null
  win_rate: number | null
  top_emotions: string[]
}

export interface OvertradingResponse {
  overtrading_days: OvertradingDay[]
  overtrading_weeks: OvertradingWeek[]
  total_overtrading_trades: number
  avg_pnl_overtrading: number | null
  avg_pnl_normal: number | null
  summary: {
    total_days: number
    overtrading_days: number
    total_weeks: number
    overtrading_weeks: number
  }
}

// ---------------------------------------------------------------------------
// Early Exit Analysis types
// ---------------------------------------------------------------------------

export interface ExitReasonBreakdown {
  reason: string
  count: number
  total_pnl: number
  avg_pnl: number
  win_rate: number | null
}

export interface EarlyExit {
  trade_id: number
  symbol: string
  entry_price: string
  exit_price: string
  target_price: string | null
  stop_price: string | null
  pnl: string
  exit_reason: string
  capture_ratio: number
  actual_r: number
  max_r: number
  exit_quality_grade: string | null
  entry_time: string | null
}

export interface EarlyExitResponse {
  total_closed: number
  exit_reason_breakdown: ExitReasonBreakdown[]
  capture_stats: {
    avg_capture_ratio: number | null
    median_capture_ratio: number | null
    target_reach_rate: number | null
    stop_hit_rate: number | null
    manual_exit_rate: number | null
  } | null
  early_exits: EarlyExit[]
  early_exit_rate: number | null
  avg_pnl_early_exit: number | null
  avg_pnl_full_exit: number | null
  dimension_scores: { exit_quality_avg: number | null; graded_count: number } | null
}

// ---------------------------------------------------------------------------
// Composite Discipline Score types
// ---------------------------------------------------------------------------

export interface DisciplineInsight {
  type: 'warning' | 'insight'
  area: string
  message: string
}

export interface DisciplineScoreResponse {
  overall_score: number | null
  components: Record<string, number>
  grade: string | null
  insights: DisciplineInsight[]
}

// ---------------------------------------------------------------------------
// AI Behavioral Score types
// ---------------------------------------------------------------------------

export interface AIAssessment {
  behavioral_summary: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  risk_level: 'low' | 'medium' | 'high' | 'unknown'
  composite_score: number | null
}

export interface BehavioralScoreResponse {
  programmatic: DisciplineScoreResponse
  ai_assessment: AIAssessment
  lookback_days: number
  trades_analyzed: number
  model_used: string
  generated_at: string
}

// ---------------------------------------------------------------------------
// Playbook Intelligence types
// ---------------------------------------------------------------------------

export interface PlaybookOverviewSetup {
  setup_id: number
  setup_name: string
  trade_count: number
  closed_count: number
  win_rate: number | null
  expectancy: number | null
  profit_factor: number | null
  total_pnl: number | null
  avg_r: number | null
}

export interface PlaybookOverviewResponse {
  setups: PlaybookOverviewSetup[]
  best_by_expectancy: PlaybookOverviewSetup | null
  best_by_win_rate: PlaybookOverviewSetup | null
  best_by_pnl: PlaybookOverviewSetup | null
}

export interface SetupPerformance {
  trade_count: number
  closed_count: number
  win_rate: number | null
  total_pnl: number | null
  avg_pnl: number | null
  profit_factor: number | null
  expectancy: number | null
  avg_r: number | null
  max_r: number | null
  min_r: number | null
  r_std: number | null
}

export interface HoldTimePerformance {
  count: number
  avg_pnl: number | null
  win_rate: number | null
}

export interface SetupHoldTime {
  avg_hours: number | null
  median_hours: number | null
  min_hours: number | null
  max_hours: number | null
  sample_size: number
  hold_performance: Record<string, HoldTimePerformance>
  best_hold_bucket: string | null
}

export interface TimeOfDayEntry {
  hour: number
  label: string
  count: number
  win_rate: number | null
  avg_pnl: number | null
}

export interface DayOfWeekEntry {
  day_of_week: number
  day_name: string
  count: number
  win_rate: number | null
  avg_pnl: number | null
}

export interface SetupMarketConditions {
  time_of_day: TimeOfDayEntry[]
  day_of_week: DayOfWeekEntry[]
  best_time: TimeOfDayEntry | null
  best_day: DayOfWeekEntry | null
  worst_time: TimeOfDayEntry | null
  worst_day: DayOfWeekEntry | null
}

export interface ExitReasonOnLoss {
  reason: string
  count: number
}

export interface FailureInsight {
  type: 'warning' | 'pattern'
  message: string
}

export interface SetupFailurePatterns {
  loss_count: number
  avg_loss: number | null
  max_loss: number | null
  max_consecutive_losses: number
  current_loss_streak: number
  exit_reasons_on_losses: ExitReasonOnLoss[]
  missing_stop_rate: number | null
  insights: FailureInsight[]
}

export interface EmotionPnlEntry {
  emotion: string
  count: number
  win_rate: number | null
  avg_pnl: number | null
}

export interface GradePnlEntry2 {
  grade: string
  count: number
  win_rate: number | null
  avg_pnl: number | null
}

export interface SetupBehaviorCrossover {
  emotion_breakdown: EmotionPnlEntry[]
  grade_breakdown: GradePnlEntry2[]
}

export interface TacticPerformance {
  tactic: string
  trade_count: number
  closed_count: number
  win_rate: number | null
  avg_pnl: number | null
  total_pnl: number | null
}

export interface RecentTrade {
  id: number
  symbol: string
  entry_price: string
  exit_price: string | null
  pnl: string | null
  r_multiple: string | null
  exit_reason: string | null
  tactic: string | null
  entry_time: string | null
}

export interface SetupRegimePerformanceCell {
  regime: string
  sample_size: number
  avg_r: number | null
  expectancy_r: number | null
  win_rate: number | null
  confidence: string
}

export interface SetupRegimePerformance {
  best_regime: string | null
  worst_regime: string | null
  by_regime: SetupRegimePerformanceCell[]
}

export interface SetupIntelligenceResponse {
  setup_name: string
  description: string | null
  ideal_conditions: string[]
  risk_profile: Record<string, unknown>
  rules: string[]
  performance: SetupPerformance
  regime_performance: SetupRegimePerformance | null
  hold_time: SetupHoldTime
  market_conditions: SetupMarketConditions
  failure_patterns: SetupFailurePatterns
  behavior_crossover: SetupBehaviorCrossover
  tactic_breakdown: TacticPerformance[]
  recent_trades: RecentTrade[]
}

// ---------------------------------------------------------------------------
// Market Context types
// ---------------------------------------------------------------------------

export interface MarketSnapshotEntry {
  date: string
  nifty_close: string | null
  nifty_change_pct: string | null
  nifty_trend: string | null
  nifty_regime: string | null
  india_vix: string | null
  atr_pct: string | null
  advance_count: number | null
  decline_count: number | null
  advance_decline_ratio: string | null
  sector_strength: Record<string, { change_pct: number | null; last_price: number | null }>
  fii_flow_cr: string | null
  dii_flow_cr: string | null
  is_earnings_season: string | null
  macro_events: string[] | null
}

export interface MarketSnapshotsResponse {
  snapshots: MarketSnapshotEntry[]
  total: number
}

export interface MarketCorrelationBucket {
  trade_count: number
  win_rate: number | null
  avg_pnl: number | null
  total_pnl: number | null
  expectancy: number | null
}

export interface MarketCorrelationInsight {
  type: 'insight' | 'warning'
  message: string
}

export interface MarketPerformanceCorrelation {
  by_trend: Record<string, MarketCorrelationBucket>
  by_regime: Record<string, MarketCorrelationBucket>
  by_vix_bucket: Record<string, MarketCorrelationBucket>
  by_breadth: Record<string, MarketCorrelationBucket>
  by_earnings_season: Record<string, MarketCorrelationBucket>
  insights: MarketCorrelationInsight[]
  total_matched_trades: number
}

export interface MarketRegimeCurrent {
  date: string
  nifty_close: string | null
  nifty_change_pct: string | null
  nifty_trend: string | null
  nifty_regime: string | null
  india_vix: string | null
  advance_count: number | null
  decline_count: number | null
  sector_strength: Record<string, { change_pct: number | null; last_price: number | null }> | null
  is_earnings_season: string | null
  fii_flow_cr: string | null
  dii_flow_cr: string | null
}

export interface MarketRegimeSummary {
  current: MarketRegimeCurrent | null
  regime_distribution: Record<string, number>
  trend_distribution: Record<string, number>
  avg_vix: number | null
  total_days: number
}

export interface LiveQuote {
  symbol: string
  company_name: string | null
  ltp: string | null
  change: string | null
  change_pct: string | null
  volume: string | null
  high_52w: string | null
  low_52w: string | null
  pe: string | null
  market_cap_cr: string | null
  sector: string | null
  updated_at: string | null
  status?: 'fresh' | 'stale' | 'failed' | 'not_synced'
  age_seconds?: number | null
  stale_after_seconds?: number
}

export interface LiveQuotesResponse {
  quotes: LiveQuote[]
  total: number
  status_counts?: Record<string, number>
  stale_after_seconds?: number
}

export interface MySymbolsResponse {
  symbols: string[]
}

// ---------------------------------------------------------------------------
// Aggregated Dashboard payloads
// ---------------------------------------------------------------------------

export interface OperationalOpenTrade {
  id: number
  symbol: string
  entry_price: string
  quantity: string
  remaining_qty: string
  stop_price: string | null
  fees: string
}

export interface OperationalRiskSummary {
  net_equity: string
  open_positions: number
  deployed_capital: string
  available_capital: string
  open_risk: string
  portfolio_heat_pct: number | null
  deployed_capital_pct: number | null
  positions_without_stop: number
  warnings: Array<{
    severity: string
    code: string
    message: string
    trade_id: number | null
    symbol: string | null
  }>
}

export interface OperationalCapitalSummary {
  net_equity: string
  initial_balance: string
  total_deposits: string
  total_withdrawals: string
  total_realized_pnl: string
  unrealized_pnl: string
  total_equity_unrealized: string
  total_trades: number
  win_rate: number | null
}

export interface OperationalStreaks {
  current_type: string | null
  current_count: number
  longest_win: number
  longest_loss: number
}

export interface OperationalDashboardPayload {
  kpi: AnalyticsKpi
  open_trades: OperationalOpenTrade[]
  risk: OperationalRiskSummary
  capital: OperationalCapitalSummary
  streaks: OperationalStreaks
  equity_curve: { date: string; equity: string }[]
}

export interface IntelligenceLifecycleHighlight {
  total_emotion_logs: number
  most_frequent_emotion: string | null
  worst_performing_emotion: string | null
  graded_trades: number
  avg_grade_score: number | null
  high_grade_rate: number | null
  discipline_score: number | null
}

export interface IntelligenceBehavioralHighlight {
  overtrading_days: number
  overtrading_weeks: number
  revenge_trades: number
  early_exit_rate: number | null
  avg_capture_ratio: number | null
}

export interface IntelligencePlaybookHighlight {
  setups: Array<{
    name: string
    trade_count: number
    win_rate: number | null
    avg_r: string | null
    total_pnl: string | null
  }>
}

export interface IntelligenceMarketHighlight {
  date: string | null
  nifty_close: number | null
  nifty_change_pct: number | null
  nifty_regime: string | null
  india_vix: number | null
  fii_flow_cr: string | null
  dii_flow_cr: string | null
  breadth_advance: number | null
  breadth_decline: number | null
}

export interface IntelligenceDashboardPayload {
  lifecycle: IntelligenceLifecycleHighlight
  behavioral: IntelligenceBehavioralHighlight
  playbook: IntelligencePlaybookHighlight
  market: IntelligenceMarketHighlight
}

// ---------------------------------------------------------------------------
// Daily charges ledger
// ---------------------------------------------------------------------------

export interface DailyCharges {
  id: number
  trade_date: string
  broker: string | null
  account_ref: string | null
  contract_note_ref: string | null
  entry_mode: 'breakdown' | 'total_only'
  brokerage: string
  stt: string
  exchange_txn_charges: string
  sebi_charges: string
  stamp_duty: string
  gst: string
  clearing_charges: string
  other_charges: string
  total_charges: string
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface DailyChargesDaySummary {
  trade_date: string
  gross_realized_pnl: string | null
  charges_recorded: boolean
  total_charges: string | null
  net_realized_pnl: string | null
  trade_count: number
  entry_mode: 'breakdown' | 'total_only' | null
  broker: string | null
}

export interface DailyChargesSummary {
  start_date: string
  end_date: string
  gross_realized_pnl: string | null
  total_charges: string | null
  net_realized_pnl: string | null
  charges_recorded_days: number
  trading_days: number
  missing_charge_days: number
  days: DailyChargesDaySummary[]
}

export type DailyChargesCreatePayload = Omit<DailyCharges, 'id' | 'total_charges' | 'created_at' | 'updated_at'> & {
  total_charges?: string | null
}

export interface DailyChargesListResponse {
  total: number
  items: DailyCharges[]
}
