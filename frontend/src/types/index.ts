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
}

export interface ApiTradeListResponse {
  total: number
  items: ApiTrade[]
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
  target_price?: string | null
  r_multiple?: string | null
  status?: BackendTradeStatus
  exit_reason?: string | null
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

// ---------------------------------------------------------------------------
// Analytics API types (matches analytics schemas)
// ---------------------------------------------------------------------------

export interface AnalyticsKpi {
  trade_count: number
  win_rate: number | null
  profit_factor: number | null
  expectancy: number | null
  avg_r_multiple: number | null
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
  merged?: number
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

export interface ExecutionGradeUpdatePayload extends ExecutionGradeCreatePayload {}

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
