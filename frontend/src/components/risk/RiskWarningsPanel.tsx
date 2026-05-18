import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RiskWarning, RiskWarningSeverity } from '@/types/riskDashboard'

const severityStyles: Record<RiskWarningSeverity, { icon: LucideIcon; iconColor: string; badge: string; row: string; label: string }> = {
  high: {
    icon: AlertTriangle,
    iconColor: 'text-loss',
    badge: 'bg-loss-muted text-loss border-loss/20',
    row: 'border-loss/20 bg-loss-faint',
    label: 'High',
  },
  medium: {
    icon: AlertTriangle,
    iconColor: 'text-gold',
    badge: 'bg-gold-faint text-gold border-gold/25',
    row: 'border-gold/25 bg-gold-faint',
    label: 'Medium',
  },
  low: {
    icon: Info,
    iconColor: 'text-accent',
    badge: 'bg-accent-muted text-accent border-accent/20',
    row: 'border-accent/20 bg-accent-faint',
    label: 'Low',
  },
}

export function RiskWarningsPanel({ warnings }: { warnings: RiskWarning[] }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 animate-card-in min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-accent" />
          <h3 className="truncate font-display text-sm text-text-heading">Risk Warnings</h3>
        </div>
        <div className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-text-muted font-data">
          {warnings.length}
        </div>
      </div>

      {warnings.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-profit/20 bg-profit-faint p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-profit" />
          <div>
            <div className="text-sm font-medium text-text-heading">Risk checks clear</div>
            <div className="mt-1 text-[length:var(--text-xs)] text-text-muted">
              No open-position alerts.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {warnings.map((warning, index) => {
            const style = severityStyles[warning.severity] ?? severityStyles.low
            const Icon = style.icon
            const key = `${warning.code}-${warning.trade_id ?? warning.symbol ?? index}`

            return (
              <div key={key} className={cn('rounded-xl border p-3', style.row)}>
                <div className="flex items-start gap-3">
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconColor)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-md border px-2 py-0.5 text-[length:var(--text-xs)] font-data', style.badge)}>
                        {style.label}
                      </span>
                      {warning.symbol ? (
                        <span className="font-data text-xs text-text-heading">{warning.symbol}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm leading-5 text-text-heading">{warning.message}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
