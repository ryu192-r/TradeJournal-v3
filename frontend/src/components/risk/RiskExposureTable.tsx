import { Layers, PieChart } from 'lucide-react'
import { formatCurrency, formatMetricPercent } from '@/utils/format'
import type { RiskBucket } from '@/types/riskDashboard'

function exposureWidth(value: number | null): string {
  if (value == null) return '0%'
  return `${Math.min(Math.max(value, 0), 100)}%`
}

interface RiskExposureTableProps {
  title: string
  buckets: RiskBucket[]
  variant: 'setup' | 'symbol'
}

export function RiskExposureTable({ title, buckets, variant }: RiskExposureTableProps) {
  const Icon = variant === 'setup' ? Layers : PieChart

  return (
    <div className="bg-card rounded-2xl border border-border p-5 animate-card-in min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-accent" />
          <h3 className="truncate font-display text-sm text-text-heading">{title}</h3>
        </div>
        <div className="shrink-0 text-xs text-text-muted font-data">{buckets.length}</div>
      </div>

      {buckets.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">No open exposure</div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-[520px] w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 pr-3 text-left font-display">Name</th>
                <th className="py-2 px-3 text-right font-display">Positions</th>
                <th className="py-2 px-3 text-right font-display">Deployed</th>
                <th className="py-2 px-3 text-right font-display">Open Risk</th>
                <th className="py-2 pl-3 text-right font-display">Exposure</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.name} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-3">
                    <div className="max-w-[160px] truncate font-data text-text-heading">{bucket.name}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-low">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: exposureWidth(bucket.exposure_pct) }}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-data text-text-heading">{bucket.position_count}</td>
                  <td className="py-3 px-3 text-right font-data text-text-heading">{formatCurrency(bucket.deployed_capital)}</td>
                  <td className={`py-3 px-3 text-right font-data ${Number(bucket.open_risk) < 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(bucket.open_risk)}</td>
                  <td className="py-3 pl-3 text-right font-data text-text-heading">{formatMetricPercent(bucket.exposure_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
