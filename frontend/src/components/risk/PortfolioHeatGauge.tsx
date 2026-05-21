import { Gauge, ShieldAlert } from 'lucide-react'
import { formatCurrency, formatMetricPercent, parseDecimal } from '@/utils/format'
import type { RiskDashboardPayload } from '@/types/riskDashboard'

function heatTone(value: number | null) {
  if (value == null) return { label: 'Unknown', color: 'var(--text-muted)', className: 'text-text-muted' }
  if (value > 6) return { label: 'High', color: 'var(--loss)', className: 'text-loss' }
  if (value > 4) return { label: 'Elevated', color: 'var(--gold)', className: 'text-gold' }
  return { label: 'Controlled', color: 'var(--profit)', className: 'text-profit' }
}

export function PortfolioHeatGauge({ data }: { data: Pick<RiskDashboardPayload, 'portfolio_heat_pct' | 'open_risk' | 'positions_without_stop'> }) {
  const heat = data.portfolio_heat_pct
  const progress = heat == null ? 0 : Math.min(Math.max(heat / 8, 0), 1)
  const strokeDasharray = 283
  const dashOffset = strokeDasharray * (1 - progress)
  const tone = heatTone(heat)
  const openRisk = parseDecimal(data.open_risk, 0)

  return (
    <div className="bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Gauge className="h-4 w-4 shrink-0 text-accent" />
          <h3 className="truncate font-display text-[length:var(--text-sm)] text-text-heading">Portfolio Heat</h3>
        </div>
        <div className={`shrink-0 rounded-md border border-border px-2 py-1 text-xs font-data ${tone.className}`}>
          {tone.label}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <div className="relative h-36 w-36 sm:h-40 sm:w-40">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" role="img" aria-label={`Portfolio heat ${formatMetricPercent(heat)}`}>
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="var(--border)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={tone.color}
              strokeLinecap="round"
              strokeWidth="10"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`font-data text-3xl font-semibold ${tone.className}`}>
              {formatMetricPercent(heat)}
            </div>
            <div className="mt-1 text-[length:var(--text-xs)] text-text-muted font-data">
              of equity
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted">Open Risk</div>
          <div className={`mt-1 truncate font-data text-sm font-medium ${openRisk < 0 ? 'text-profit' : openRisk > 0 ? 'text-loss' : 'text-text-heading'}`}>
            {formatCurrency(data.open_risk)}
          </div>
        </div>
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted">No SL</div>
          <div className={`mt-1 flex items-center justify-end gap-1 font-data text-sm font-medium sm:justify-start ${data.positions_without_stop > 0 ? 'text-loss' : 'text-profit'}`}>
            {data.positions_without_stop > 0 ? <ShieldAlert className="h-3.5 w-3.5" /> : null}
            {data.positions_without_stop}
          </div>
        </div>
      </div>
    </div>
  )
}
