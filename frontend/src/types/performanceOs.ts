// ────────────────────────── Improvement Action (ADR-025) ──────────────────────────
// (Legacy Performance OS types — DailyWorkflow / WeeklyReview / MonthlyReview /
// DailyDashboard — were removed in issue #67 alongside the dropped tables.)

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
