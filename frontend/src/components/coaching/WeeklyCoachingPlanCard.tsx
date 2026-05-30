import { Card } from '@/components/ui/Card'
import type { WeeklyCoachingPlan } from '@/types/coachingIntelligence'
import { AlertTriangle, CheckCircle2, Info, Target, Brain, Shield, ListChecks } from 'lucide-react'

const SEVERITY_ICONS: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  positive: CheckCircle2,
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-loss border-loss/30 bg-loss-muted/10',
  warning: 'text-gold border-gold/30 bg-gold-faint',
  info: 'text-accent border-accent/20 bg-accent-muted/10',
  positive: 'text-profit border-profit/30 bg-profit-muted/10',
}

export function WeeklyCoachingPlanCard({ plan }: { plan: WeeklyCoachingPlan }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading">Weekly Coaching Plan</h3>
        <span className="ml-auto text-[10px] text-text-faint">{plan.week_start} – {plan.week_end}</span>
      </div>

      <p className="text-sm text-text-heading font-medium mb-1">{plan.headline}</p>
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs text-text-muted">{plan.primary_focus}</span>
      </div>

      {plan.priorities.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-[10px] uppercase tracking-wider text-text-faint font-medium">Priorities</h4>
          {plan.priorities.slice(0, 5).map((p) => {
            const Icon = SEVERITY_ICONS[p.severity] || Info
            const color = SEVERITY_COLORS[p.severity] || SEVERITY_COLORS.info
            return (
              <div key={p.id} className={`rounded-lg border p-3 ${color}`}>
                <div className="flex items-start gap-2">
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-text-heading">{p.title}</div>
                    <p className="text-[11px] text-text-muted mt-0.5">{p.reason}</p>
                    {p.evidence && <p className="text-[10px] text-text-faint mt-1">{p.evidence}</p>}
                    {p.action && (
                      <div className="mt-1.5 text-[11px] text-accent">{p.action}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {plan.rules_for_next_week.length > 0 && (
        <div className="mb-3">
          <h4 className="text-[10px] uppercase tracking-wider text-text-faint font-medium mb-1.5 flex items-center gap-1">
            <ListChecks className="w-3 h-3" /> Rules
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {plan.rules_for_next_week.map((rule, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-[10px] text-text-muted">
                {rule}
              </span>
            ))}
          </div>
        </div>
      )}

      {plan.recommended_size_adjustments.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider text-text-faint font-medium mb-1.5 flex items-center gap-1">
            <Shield className="w-3 h-3" /> Size Adjustments
          </h4>
          <div className="space-y-1">
            {plan.recommended_size_adjustments.map((adj, i) => (
              <div key={i} className="text-xs text-text-muted flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0" />
                {adj}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
