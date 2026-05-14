// Setup playbook types — mirror of backend Pydantic schemas

export interface Tactic {
  name: string
  win_rate?: string | null
  avg_r?: string | null
  conditions: string[]
}

export interface RiskProfile {
  max_risk_pct?: number | null
  position_sizing_rule?: string | null
  stop_style?: string | null
}

export interface SetupPlaybookItem {
  id: number
  name: string
  description: string | null
  tactics: Tactic[]
  ideal_conditions: string[]
  risk_profile: RiskProfile
  rules: string[]
  win_rate: string | null
  avg_r: string | null
  trade_count: number
  is_active: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface SetupPlaybookListResponse {
  total: number
  items: SetupPlaybookItem[]
}

export interface SetupPlaybookCreatePayload {
  name: string
  description?: string | null
  tactics?: Tactic[]
  ideal_conditions?: string[]
  risk_profile?: RiskProfile
  rules?: string[]
}

export interface SetupPlaybookUpdatePayload {
  name?: string | null
  description?: string | null
  tactics?: Tactic[] | null
  ideal_conditions?: string[] | null
  risk_profile?: RiskProfile | null
  rules?: string[] | null
  is_active?: 'active' | 'archived' | null
}
