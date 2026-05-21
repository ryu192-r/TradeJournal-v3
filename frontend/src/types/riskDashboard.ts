export type RiskWarningSeverity = 'low' | 'medium' | 'high'

export interface RiskBucket {
  name: string
  open_risk: string
  deployed_capital: string
  exposure_pct: number | null
  position_count: number
}

export interface RiskTrade {
  trade_id: number
  symbol: string
  setup: string | null
  entry_price: string
  stop_price: string | null
  quantity: string
  deployed_capital: string
  open_risk: string
  risk_pct: number | null
}

export interface RiskWarning {
  severity: RiskWarningSeverity
  code: string
  message: string
  trade_id: number | null
  symbol: string | null
}

export interface RiskDashboardPayload {
  account_id: number
  account_name: string
  net_equity: string
  open_positions: number
  deployed_capital: string
  available_capital: string
  open_risk: string
  portfolio_heat_pct: number | null
  deployed_capital_pct: number | null
  positions_without_stop: number
  largest_position: RiskTrade | null
  largest_risk_position: RiskTrade | null
  risk_by_setup: RiskBucket[]
  risk_by_symbol: RiskBucket[]
  warnings: RiskWarning[]
}
