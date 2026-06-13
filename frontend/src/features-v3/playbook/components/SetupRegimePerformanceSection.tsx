import { TrendingUp, TrendingDown } from 'lucide-react'
import type { SetupRegimePerformance } from '@/types'
import { REGIME_LABELS, type MarketRegimeType } from '@/types/marketRegime'

function fmtR(r: number | null | undefined): string {
  if (r == null) return '—'
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`
}

function regimeLabel(regime: string): string {
  return REGIME_LABELS[regime as MarketRegimeType] ?? regime.replace(/_/g, ' ')
}

export function SetupRegimePerformanceSection({ regimePerf }: { regimePerf: SetupRegimePerformance | null }) {
  if (!regimePerf?.by_regime.length) {
    return <div className="text-[length:var(--text-xs)] text-text-muted">No regime-matched trades yet.</div>
  }

  const byRegime = new Map(regimePerf.by_regime.map((c) => [c.regime, c]))
  const best = regimePerf.best_regime ? byRegime.get(regimePerf.best_regime) : null
  const worst = regimePerf.worst_regime ? byRegime.get(regimePerf.worst_regime) : null

  return (
    <div className="space-y-3">
      {(best || worst) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {best && regimePerf.best_regime && (
            <div className="tjv3-card tjv3-card--muted p-3">
              <div className="text-[10px] text-text-muted font-data flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-profit" /> Best regime
              </div>
              <div className="mt-1 text-[length:var(--text-sm)] text-text-heading">{regimeLabel(regimePerf.best_regime)}</div>
              <div className="text-[length:var(--text-xs)] font-data text-profit">{fmtR(best.expectancy_r)}</div>
              <div className="text-[10px] text-text-muted font-data">n={best.sample_size}</div>
            </div>
          )}
          {worst && regimePerf.worst_regime && (
            <div className="tjv3-card tjv3-card--muted p-3">
              <div className="text-[10px] text-text-muted font-data flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-loss" /> Worst regime
              </div>
              <div className="mt-1 text-[length:var(--text-sm)] text-text-heading">{regimeLabel(regimePerf.worst_regime)}</div>
              <div className="text-[length:var(--text-xs)] font-data text-loss">{fmtR(worst.expectancy_r)}</div>
              <div className="text-[10px] text-text-muted font-data">n={worst.sample_size}</div>
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[length:var(--text-xs)] font-data">
          <thead>
            <tr className="text-text-muted border-b border-border">
              <th className="py-1.5 pr-3 text-left">Regime</th>
              <th className="py-1.5 px-2 text-right">n</th>
              <th className="py-1.5 pl-2 text-right">Exp R</th>
            </tr>
          </thead>
          <tbody>
            {regimePerf.by_regime.map((cell) => (
              <tr key={cell.regime} className="border-b border-border/50">
                <td className="py-1.5 pr-3 text-text-heading">{regimeLabel(cell.regime)}</td>
                <td className="py-1.5 px-2 text-right text-text-muted">{cell.sample_size}</td>
                <td className={`py-1.5 pl-2 text-right ${(cell.expectancy_r ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {fmtR(cell.expectancy_r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
