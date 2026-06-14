export type ActionSeverity = 'info' | 'warning' | 'critical'
export type ActionStatus = 'open' | 'dismissed' | 'completed'
export type ActionSource = 'trade' | 'journal' | 'risk' | 'system' | 'edge' | 'review' | 'improvement'
export type ActionTier = 'simple' | 'pro'
export type ActionType =
  | 'trade_review'
  | 'journal'
  | 'risk'
  | 'rule_violation'
  | 'workflow'
  | 'suggestion'
  | 'notification'
  | 'system'
  | 'focus_reminder'

export type ActionTarget = {
  view?: string | null
  tab?: string | null
  trade_id?: number | null
}

export type ActionItem = {
  id: string
  type: ActionType
  title: string
  description?: string | null
  severity: ActionSeverity
  status: ActionStatus
  source: ActionSource
  related_trade_id?: number | null
  created_at: string
  due_at?: string | null
  action_url?: string | null
  target: ActionTarget
  tier: ActionTier
}

export type ActionInboxSection = {
  id: string
  title: string
  items: ActionItem[]
}

export type ActionsInboxResponse = {
  generated_at: string
  interface_mode: ActionTier
  open_count: number
  items: ActionItem[]
  sections: ActionInboxSection[]
}
