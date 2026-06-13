import type { SetupEdgeMetrics, SetupConditionBreakdown } from '@/types/playbookEdge'
import { Badge } from '@/new-ui'

// Canonical new-ui card surface (tjv3-card = Card primitive styling).
const CARD = 'tjv3-card animate-card-in'

const STATUS_STYLES = {
  FOCUS: 'success',
  WATCH: 'neutral',
  PAUSE: 'loss',
} as const

const CONF_LABELS = {
  LOW: 'Low confidence',
  MEDIUM: 'Medium confidence',
  HIGH: 'High confidence',
} as const

function formatR(value: number | null | undefined) {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}R`
}

export function PlaybookEdgeCard({ metrics }: { metrics: SetupEdgeMetrics }) {
  const statusVariant = STATUS_STYLES[metrics.status] ?? 'neutral'
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">{metrics.setup_name}</h3>
          <p className="text-[10px] text-text-muted mt-0.5">
            {metrics.sample_size} trades · {CONF_LABELS[metrics.confidence]}
          </p>
        </div>
        <Badge variant={statusVariant}>{metrics.status}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Expectancy" value={formatR(metrics.expectancy_r)} tone={metrics.expectancy_r} />
        <Metric label="Avg R" value={formatR(metrics.avg_r)} tone={metrics.avg_r} />
        <Metric label="Win rate" value={metrics.win_rate != null ? `${metrics.win_rate.toFixed(1)}%` : '—'} />
        <Metric label="Score" value={metrics.playbook_score != null ? String(metrics.playbook_score) : '—'} />
        <Metric label="Profit factor" value={metrics.profit_factor?.toFixed(2) ?? '—'} />
        <Metric label="30d avg R" value={formatR(metrics.recent_30d_r)} tone={metrics.recent_30d_r} />
        <Metric label="Best streak" value={String(metrics.best_streak)} />
        <Metric label="Worst streak" value={String(metrics.worst_streak)} />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: number | null
}) {
  const color =
    tone == null ? 'text-text-heading' :
    tone >= 0 ? 'text-profit' : 'text-loss'
  return (
    <div>
      <div className={`text-sm font-bold font-data ${color}`}>{value}</div>
      <div className="text-[10px] text-text-muted">{label}</div>
    </div>
  )
}

export function PlaybookConditionBreakdown({ conditions }: { conditions: SetupConditionBreakdown[] }) {
  if (conditions.length === 0) {
    return <p className="text-[length:var(--text-sm)] text-text-muted">No condition breakdown yet.</p>
  }
  const grouped = conditions.reduce<Record<string, SetupConditionBreakdown[]>>((acc, row) => {
    acc[row.condition_type] = acc[row.condition_type] ?? []
    acc[row.condition_type].push(row)
    return acc
  }, {})
  const labels: Record<string, string> = {
    market_context: 'Market context',
    time_of_day: 'Time of day',
    day_of_week: 'Day of week',
    direction: 'Direction',
  }
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, rows]) => (
        <div key={type}>
          <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">{labels[type] ?? type}</p>
          <div className="space-y-1">
            {rows.map((row) => (
              <div key={`${row.condition_type}-${row.condition_value}`} className="flex items-center justify-between text-[length:var(--text-xs)]">
                <span className="text-text-heading">{row.condition_value}</span>
                <span className="font-data text-text-muted">{row.sample_size} trades</span>
                <span className={`font-data ${(row.expectancy_r ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatR(row.expectancy_r)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PlaybookFocusCard({ setups }: { setups: SetupEdgeMetrics[] }) {
  const focus = setups.filter((s) => s.status === 'FOCUS')
  if (focus.length === 0) {
    return (
      <div className={`${CARD} border-profit/20 bg-profit-muted/5`}>
        <p className="text-[length:var(--text-sm)] text-text-muted">No focus setups yet. Need positive expectancy (&gt;0.25R) with 20+ trades.</p>
      </div>
    )
  }
  return (
    <div className={`${CARD} border-profit/20 bg-profit-muted/5`}>
      <p className="text-[10px] uppercase tracking-wider text-profit mb-2">Focus setups</p>
      <ul className="space-y-2">
        {focus.map((s) => (
          <li key={s.setup_name} className="flex items-center justify-between gap-2 text-[length:var(--text-sm)]">
            <span className="font-medium text-text-heading">{s.setup_name}</span>
            <span className="font-data text-profit">{formatR(s.expectancy_r)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PlaybookPauseCard({ setups }: { setups: SetupEdgeMetrics[] }) {
  const pause = setups.filter((s) => s.status === 'PAUSE')
  if (pause.length === 0) {
    return (
      <div className={`${CARD} border-loss/20 bg-loss-muted/5`}>
        <p className="text-[length:var(--text-sm)] text-text-muted">No pause setups. Negative expectancy setups need 20+ trades.</p>
      </div>
    )
  }
  return (
    <div className={`${CARD} border-loss/20 bg-loss-muted/5`}>
      <p className="text-[10px] uppercase tracking-wider text-loss mb-2">Pause setups</p>
      <ul className="space-y-2">
        {pause.map((s) => (
          <li key={s.setup_name} className="flex items-center justify-between gap-2 text-[length:var(--text-sm)]">
            <span className="font-medium text-text-heading">{s.setup_name}</span>
            <span className="font-data text-loss">{formatR(s.expectancy_r)} · {s.sample_size} trades</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
