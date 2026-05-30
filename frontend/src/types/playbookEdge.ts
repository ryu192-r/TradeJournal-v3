export type SetupEdgeConfidence = 'LOW' | 'MEDIUM' | 'HIGH'
export type SetupEdgeStatus = 'FOCUS' | 'WATCH' | 'PAUSE'

export interface SetupEdgeMetrics {
  setup_name: string
  sample_size: number
  wins: number
  losses: number
  breakeven: number
  win_rate: number | null
  avg_winner_r: number | null
  avg_loser_r: number | null
  avg_r: number | null
  expectancy_r: number | null
  profit_factor: number | null
  recent_30d_r: number | null
  recent_90d_r: number | null
  max_drawdown_r: number | null
  best_streak: number
  worst_streak: number
  confidence: SetupEdgeConfidence
  status: SetupEdgeStatus
  playbook_score: number | null
}

export interface SetupConditionBreakdown {
  setup_name: string
  condition_type: string
  condition_value: string
  sample_size: number
  avg_r: number | null
  expectancy_r: number | null
}

export interface PlaybookScore {
  setup_name: string
  score: number
  expectancy_component: number
  win_rate_component: number
  consistency_component: number
  recent_component: number
}

export interface SetupEdgeDetailResponse {
  metrics: SetupEdgeMetrics
  playbook_score: PlaybookScore
  conditions: SetupConditionBreakdown[]
}

export interface PlaybookEdgeListResponse {
  generated_at: string
  setups: SetupEdgeMetrics[]
  focus_setups: string[]
  pause_setups: string[]
}

export interface PlaybookEdgeSummaryItem {
  setup_name: string
  expectancy_r: number | null
  avg_r: number | null
  sample_size: number
  confidence: SetupEdgeConfidence
  status: SetupEdgeStatus
  playbook_score: number | null
}
