import { Activity, TrendingUp, TrendingDown, Gauge, Grid3x3 } from 'lucide-react'
import { EmptyState, SectionHeader, CardSkeleton } from '@/components/ui'
import {
  useCurrentRegimeQuery,
  useRegimePerformanceQuery,
  useRegimeMatrixQuery,
} from '@/hooks/useMarketRegimeQuery'
import {
  REGIME_LABELS,
  type CurrentRegime,
  type RegimePerformance,
  type RegimePerformanceResponse,
  type RegimeStatus,
  type RegimeConfidence,
  type SetupRegimeMatrix as SetupRegimeMatrixData,
  type MarketRegimeType,
} from '@/types/marketRegime'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

function regimeLabel(regime: MarketRegimeType): string {
  return REGIME_LABELS[regime] ?? regime
}

function statusClass(status: RegimeStatus): string {
  if (status === 'FAVORABLE') return 'bg-profit-muted text-profit'
  if (status === 'UNFAVORABLE') return 'bg-loss-muted text-loss'
  return 'bg-border text-text-muted'
}

function StatusChip({ status }: { status: RegimeStatus }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium font-data ${statusClass(status)}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

function ConfidenceChip({ confidence }: { confidence: RegimeConfidence }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-data bg-border text-text-muted">
      {confidence}
    </span>
  )
}

function rClass(r: number | null | undefined): string {
  if (r == null) return 'text-text-muted'
  return r > 0 ? 'text-profit' : r < 0 ? 'text-loss' : 'text-text-muted'
}

function fmtR(r: number | null | undefined): string {
  if (r == null) return '—'
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`
}

/* ─── CurrentRegimeCard ─────────────────────────────────────── */

export function CurrentRegimeCard({ data }: { data: CurrentRegime }) {
  return (
    <div className={CARD}>
      <SectionHeader
        icon={Activity}
        title="Current Market Regime"
        subtitle={data.as_of_date ? `As of ${data.as_of_date}` : undefined}
        badge={<StatusChip status={data.status} />}
      />
      <div className="mt-3 flex items-baseline gap-3 flex-wrap">
        <span className="font-display text-[length:var(--heading-size)] text-text-heading">
          {regimeLabel(data.regime)}
        </span>
        <ConfidenceChip confidence={data.confidence} />
      </div>

      {(data.best_setup || data.worst_setup) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {data.best_setup && (
            <div className="rounded-xl border border-border p-3">
              <div className="text-[10px] text-text-muted font-data flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-profit" /> Best setup
              </div>
              <div className="mt-1 text-[length:var(--text-sm)] text-text-heading truncate">{data.best_setup}</div>
              <div className={`text-[length:var(--text-xs)] font-data ${rClass(data.best_setup_expectancy_r)}`}>
                {fmtR(data.best_setup_expectancy_r)}
              </div>
            </div>
          )}
          {data.worst_setup && (
            <div className="rounded-xl border border-border p-3">
              <div className="text-[10px] text-text-muted font-data flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-loss" /> Avoid
              </div>
              <div className="mt-1 text-[length:var(--text-sm)] text-text-heading truncate">{data.worst_setup}</div>
              <div className={`text-[length:var(--text-xs)] font-data ${rClass(data.worst_setup_expectancy_r)}`}>
                {fmtR(data.worst_setup_expectancy_r)}
              </div>
            </div>
          )}
        </div>
      )}

      {data.reasoning.length > 0 && (
        <ul className="mt-3 space-y-1">
          {data.reasoning.map((r, i) => (
            <li key={i} className="text-[length:var(--text-xs)] text-text-muted font-data">• {r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ─── RegimePerformanceTable ────────────────────────────────── */

export function RegimePerformanceTable({ data }: { data: RegimePerformanceResponse }) {
  if (!data.regimes.length) {
    return (
      <div className={CARD}>
        <SectionHeader icon={Gauge} title="Regime Performance" />
        <EmptyState
          title="No regime data yet"
          message="Log market snapshots and close trades to see which regimes are profitable."
        />
      </div>
    )
  }

  return (
    <div className={CARD}>
      <SectionHeader
        icon={Gauge}
        title="Regime Performance"
        subtitle={`${data.matched_trades} matched trade(s)`}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[length:var(--text-xs)] font-data">
          <thead>
            <tr className="text-text-muted text-left border-b border-border">
              <th className="py-2 pr-3">Regime</th>
              <th className="py-2 px-2 text-right">n</th>
              <th className="py-2 px-2 text-right">Win%</th>
              <th className="py-2 px-2 text-right">Avg R</th>
              <th className="py-2 px-2 text-right">Exp R</th>
              <th className="py-2 px-2 text-right">PF</th>
              <th className="py-2 pl-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.regimes.map((r: RegimePerformance) => (
              <tr key={r.regime} className="border-b border-border/50">
                <td className="py-2 pr-3 text-text-heading">{regimeLabel(r.regime)}</td>
                <td className="py-2 px-2 text-right text-text-muted">{r.sample_size}</td>
                <td className="py-2 px-2 text-right">{r.win_rate != null ? `${r.win_rate}%` : '—'}</td>
                <td className={`py-2 px-2 text-right ${rClass(r.avg_r)}`}>{fmtR(r.avg_r)}</td>
                <td className={`py-2 px-2 text-right ${rClass(r.expectancy_r)}`}>{fmtR(r.expectancy_r)}</td>
                <td className="py-2 px-2 text-right text-text-muted">{r.profit_factor != null ? r.profit_factor.toFixed(2) : '—'}</td>
                <td className="py-2 pl-2 text-right"><StatusChip status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── SetupRegimeMatrix ─────────────────────────────────────── */

function cellClass(exp: number | null): string {
  if (exp == null) return 'text-text-faint'
  if (exp > 0.25) return 'bg-profit-muted text-profit'
  if (exp < 0) return 'bg-loss-muted text-loss'
  return 'bg-border/40 text-text-muted'
}

export function SetupRegimeMatrix({ data }: { data: SetupRegimeMatrixData }) {
  if (!data.rows.length) {
    return (
      <div className={CARD}>
        <SectionHeader icon={Grid3x3} title="Setup × Regime Matrix" />
        <EmptyState
          title="No setup-regime data"
          message="Closed trades matched to market snapshots populate this matrix."
        />
      </div>
    )
  }

  return (
    <div className={CARD}>
      <SectionHeader icon={Grid3x3} title="Setup × Regime Matrix" subtitle="Expectancy (R) per regime" />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[length:var(--text-xs)] font-data border-collapse">
          <thead>
            <tr className="text-text-muted">
              <th className="py-2 pr-3 text-left sticky left-0 bg-card">Setup</th>
              {data.regimes.map((rg) => (
                <th key={rg} className="py-2 px-2 text-center whitespace-nowrap">{regimeLabel(rg)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const byRegime = new Map(row.cells.map((c) => [c.regime, c]))
              return (
                <tr key={row.setup} className="border-t border-border/50">
                  <td className="py-2 pr-3 text-text-heading whitespace-nowrap sticky left-0 bg-card">{row.setup}</td>
                  {data.regimes.map((rg) => {
                    const cell = byRegime.get(rg)
                    if (!cell) return <td key={rg} className="py-2 px-2 text-center text-text-faint">—</td>
                    return (
                      <td key={rg} className="py-1.5 px-1 text-center">
                        <div className={`rounded-md px-1.5 py-1 ${cellClass(cell.expectancy_r)}`}>
                          <div>{fmtR(cell.expectancy_r)}</div>
                          <div className="text-[9px] opacity-70">n={cell.sample_size}</div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── MarketRegimeCard (composed panel) ─────────────────────── */

export function MarketRegimeCard() {
  const current = useCurrentRegimeQuery()
  const perf = useRegimePerformanceQuery()
  const matrix = useRegimeMatrixQuery()

  const loading = current.isLoading || perf.isLoading || matrix.isLoading
  if (loading) return <CardSkeleton />

  const hasCurrent = current.data && !current.isError
  const hasPerf = !!perf.data
  const hasMatrix = !!matrix.data

  if (!hasCurrent && !hasPerf && !hasMatrix) {
    return (
      <div className={CARD}>
        <SectionHeader icon={Activity} title="Market Regime Intelligence" />
        <EmptyState
          title="No regime intelligence yet"
          message="Add daily market snapshots and close trades to unlock regime analytics."
        />
      </div>
    )
  }

  return (
    <div className="space-y-[var(--page-gap)]">
      {hasCurrent && current.data && <CurrentRegimeCard data={current.data} />}
      {hasPerf && perf.data && <RegimePerformanceTable data={perf.data} />}
      {hasMatrix && matrix.data && <SetupRegimeMatrix data={matrix.data} />}
    </div>
  )
}
