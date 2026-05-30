import { Card } from '@/components/ui/Card'
import type { BehavioralDriftSignal } from '@/types/coachingIntelligence'
import { AlertTriangle, TrendingDown, Activity } from 'lucide-react'

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; label: string }> = {
  critical: { icon: AlertTriangle, color: 'text-loss border-loss/30 bg-loss-muted/10', label: 'Critical' },
  warning: { icon: TrendingDown, color: 'text-gold border-gold/20 bg-gold-faint', label: 'Warning' },
  info: { icon: Activity, color: 'text-accent border-accent/20 bg-accent-muted/10', label: 'Info' },
}

export function BehavioralDriftCard({ signals }: { signals: BehavioralDriftSignal[] }) {
  if (!signals.length) return null

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading">Behavioral Drift</h3>
      </div>

      <div className="space-y-2">
        {signals.slice(0, 5).map((s) => {
          const cfg = SEVERITY_CONFIG[s.severity] || SEVERITY_CONFIG.info
          const Icon = cfg.icon
          return (
            <div key={s.id} className={`rounded-lg border p-3 ${cfg.color}`}>
              <div className="flex items-start gap-2">
                <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-text-heading">{s.title}</span>
                    <span className={`text-[10px] font-data uppercase ${s.severity === 'critical' ? 'text-loss' : s.severity === 'warning' ? 'text-gold' : 'text-accent'}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">{s.explanation}</p>
                  {s.current_value != null && s.baseline_value != null && (
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-text-faint font-data">
                      <span>Current: {s.current_value}</span>
                      <span>Baseline: {s.baseline_value}</span>
                      {s.change != null && (
                        <span className={s.change < 0 ? 'text-loss' : 'text-profit'}>
                          {s.change > 0 ? '+' : ''}{s.change.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                  {s.suggested_action && (
                    <p className="text-[11px] text-accent mt-1">{s.suggested_action}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
