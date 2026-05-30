// Market Regime Intelligence — frontend types (mirror backend schemas/market_regime.py)

export type MarketRegimeType =
  | 'TRENDING_BULL'
  | 'TRENDING_BEAR'
  | 'RANGE_BOUND'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'BREAKOUT'
  | 'REVERSAL'
  | 'UNKNOWN'

export type RegimeConfidence = 'LOW' | 'MEDIUM' | 'HIGH'
export type RegimeStatus = 'FAVORABLE' | 'NEUTRAL' | 'UNFAVORABLE'

export interface RegimePerformance {
  regime: MarketRegimeType
  sample_size: number
  wins: number
  losses: number
  breakeven: number
  win_rate: number | null
  avg_r: number | null
  expectancy_r: number | null
  profit_factor: number | null
  total_pnl: number | null
  confidence: RegimeConfidence
  status: RegimeStatus
}

export interface RegimePerformanceResponse {
  generated_at: string
  regimes: RegimePerformance[]
  matched_trades: number
  favorable_regimes: MarketRegimeType[]
  unfavorable_regimes: MarketRegimeType[]
}

export interface SetupRegimeCell {
  regime: MarketRegimeType
  sample_size: number
  avg_r: number | null
  expectancy_r: number | null
  win_rate: number | null
  confidence: RegimeConfidence
}

export interface SetupRegimeRow {
  setup: string
  cells: SetupRegimeCell[]
  best_regime: MarketRegimeType | null
  worst_regime: MarketRegimeType | null
}

export interface SetupRegimeMatrix {
  generated_at: string
  regimes: MarketRegimeType[]
  rows: SetupRegimeRow[]
}

export interface CurrentRegime {
  regime: MarketRegimeType
  confidence: RegimeConfidence
  as_of_date: string | null
  status: RegimeStatus
  reasoning: string[]
  nifty_trend: string | null
  nifty_regime: string | null
  nifty_change_pct: number | null
  india_vix: number | null
  atr_pct: number | null
  advance_decline_ratio: number | null
  best_setup: string | null
  best_setup_expectancy_r: number | null
  worst_setup: string | null
  worst_setup_expectancy_r: number | null
}

export interface MarketRegimeDashboard {
  generated_at: string
  current: CurrentRegime | null
  performance: RegimePerformanceResponse
  matrix: SetupRegimeMatrix
}

export const REGIME_LABELS: Record<MarketRegimeType, string> = {
  TRENDING_BULL: 'Trending Bull',
  TRENDING_BEAR: 'Trending Bear',
  RANGE_BOUND: 'Range Bound',
  HIGH_VOLATILITY: 'High Volatility',
  LOW_VOLATILITY: 'Low Volatility',
  BREAKOUT: 'Breakout',
  REVERSAL: 'Reversal',
  UNKNOWN: 'Unknown',
}
