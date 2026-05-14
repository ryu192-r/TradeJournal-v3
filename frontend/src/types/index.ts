// Shared TypeScript types for the trading journal

export type TradeDirection = 'LONG' | 'SHORT'

export type TradeStatus = 'OPEN' | 'CLOSED' | 'MISSED'

export type BackendTradeStatus = 'draft' | 'reviewed' | 'analytics'

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
  entry_price?: number
  exit_price?: number | null
  quantity?: number
  entry_time?: string
  exit_time?: string | null
  fees?: number
  notes?: string | null
  tags?: string[] | null
  setup?: string | null
  tactic?: string | null
  stop_price?: number | null
  target_price?: number | null
  r_multiple?: number | null
  status?: BackendTradeStatus
}

export interface JournalEntry {
  id: number
  date: string
  type: 'PRE_MARKET' | 'POST_MARKET' | 'WEEKLY'
  content: string
  linkedTrades?: number[]
}


export interface TradeIdea {
  id: number
  symbol: string
  setup: SetupType
  triggerPrice: number
  reasonMissed?: string
  revisitDate?: string
  createdAt: string
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
  mood_notes: string | null
  rules_followed: string | null
  rules_violated: string | null
  lessons_learned: string | null
  created_at?: string
  updated_at?: string
}

export interface DailyJournalPayload {
  date: string
  pre_trade_notes?: string | null
  post_trade_notes?: string | null
  trade_count?: number | null
  mood_rating?: number | null
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
