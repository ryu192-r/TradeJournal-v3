import {
  Activity,
  ArrowDownToLine,
  Banknote,
  BriefcaseBusiness,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { formatCurrency, formatMetricPercent, parseDecimal } from '@/utils/format'
import type { RiskDashboardPayload, RiskTrade, RiskWarning } from '@/types/riskDashboard'
import type { OperationalRiskSummary } from '@/types'
import { PortfolioHeatGauge } from '@/components/risk/PortfolioHeatGauge'
import { RiskExposureTable } from '@/components/risk/RiskExposureTable'
import { RiskMetricCard } from '@/components/risk/RiskMetricCard'
import { RiskWarningsPanel } from '@/components/risk/RiskWarningsPanel'
import { useMemo } from 'react'

/** Compact risk data that the dashboard passes. */
type CompactRiskInput = OperationalRiskSummary & {
  largest_position?: null
  largest_risk_position?: null
  risk_by_setup?: []
  risk_by_symbol?: []
  account_name?: string
}

function isFullPayload(data: RiskDashboardPayload | CompactRiskInput): data is RiskDashboardPayload {
  return 'largest_position' in data && data.largest_position !== undefined
}

function RiskPositionCard({ title, trade }: { title: string; trade: RiskTrade | null }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in min-w-0">
      <div className="mb-[var(--page-gap)] flex items-center gap-2">
        <BriefcaseBusiness className="h-4 w-4 shrink-0 text-accent" />
        <h3 className="truncate font-display text-[length:var(--text-sm)] text-text-heading">{title}</h3>
      </div>

      {trade == null ? (
        <div className="py-5 text-[length:var(--text-sm)] text-text-muted">No open positions</div>
      ) : (
        <div className="space-y-[var(--page-gap)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-data text-lg font-semibold text-text-heading">{trade.symbol}</div>
              <div className="mt-1 truncate text-[length:var(--text-xs)] text-text-muted">{trade.setup ?? 'Uncategorised'}</div>
            </div>
            <div className="shrink-0 rounded-md border border-border px-2 py-1 text-[length:var(--text-xs)] text-text-muted font-data">
              {formatMetricPercent(trade.risk_pct)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <div className="text-[length:var(--text-xs)] text-text-muted">Entry</div>
              <div className="mt-1 truncate font-data text-[length:var(--text-sm)] text-text-heading">{formatCurrency(trade.entry_price)}</div>
            </div>
            <div>
              <div className="text-[length:var(--text-xs)] text-text-muted">Stop</div>
              <div className={`mt-1 truncate font-data text-sm ${trade.stop_price ? 'text-text-heading' : 'text-loss'}`}>
                {trade.stop_price ? formatCurrency(trade.stop_price) : 'Missing'}
              </div>
            </div>
            <div>
              <div className="text-[length:var(--text-xs)] text-text-muted">Qty</div>
              <div className="mt-1 truncate font-data text-[length:var(--text-sm)] text-text-heading">{trade.quantity}</div>
            </div>
            <div>
              <div className="text-[length:var(--text-xs)] text-text-muted">Risk</div>
              <div className={`mt-1 truncate font-data text-sm ${Number(trade.open_risk) < 0 ? 'text-profit' : 'text-loss'}`}>{Number(trade.open_risk) < 0 ? '-' : ''}{formatCurrency(Math.abs(Number(trade.open_risk)))}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function RiskCommandCenter({ data }: { data: RiskDashboardPayload | CompactRiskInput }) {
  const full = isFullPayload(data) ? data : null
  const { warnings, setupBuckets, symbolBuckets, deployedCapital, openRisk, hasOpenPositions, hasMissingStops, heatTone } = useMemo(() => {
    const warnings = (data.warnings ?? []) as RiskWarning[]
    const setupBuckets = full?.risk_by_setup ?? []
    const symbolBuckets = full?.risk_by_symbol ?? []
    const deployedCapital = parseDecimal(data.deployed_capital, 0)
    const openRisk = parseDecimal(data.open_risk, 0)
    const hasOpenPositions = data.open_positions > 0
    const hasMissingStops = data.positions_without_stop > 0
    const heatTone = data.portfolio_heat_pct != null && data.portfolio_heat_pct > 6
      ? 'loss' as const
      : data.portfolio_heat_pct != null && data.portfolio_heat_pct > 4
        ? 'warning' as const
        : 'profit' as const
    return { warnings, setupBuckets, symbolBuckets, deployedCapital, openRisk, hasOpenPositions, hasMissingStops, heatTone }
  }, [data, full])

  return (
    <section className="space-y-[var(--page-gap)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[length:var(--text-xs)] text-accent font-data">
            <Shield className="h-3.5 w-3.5" />
            Risk Intelligence
          </div>
          <h2 className="mt-1 font-display text-xl text-text-heading sm:text-2xl">Risk Command Center</h2>
        </div>
        <div className="truncate text-[length:var(--text-xs)] text-text-muted font-data">
          {full?.account_name || 'Primary account'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <PortfolioHeatGauge data={data} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <RiskMetricCard
            label="Net Equity"
            value={formatCurrency(data.net_equity)}
            detail="account base"
            icon={Wallet}
            tone="neutral"
          />
          <RiskMetricCard
            label="Open Positions"
            value={String(data.open_positions)}
            detail={!hasOpenPositions ? 'no open trades' : hasMissingStops ? `${data.positions_without_stop} without SL` : 'all stopped'}
            icon={BriefcaseBusiness}
            tone={hasMissingStops ? 'loss' : hasOpenPositions ? 'accent' : 'neutral'}
          />
          <RiskMetricCard
            label="Deployed"
            value={formatCurrency(data.deployed_capital)}
            detail={formatMetricPercent(data.deployed_capital_pct)}
            icon={ArrowDownToLine}
            tone={data.deployed_capital_pct != null && data.deployed_capital_pct > 80 ? 'warning' : deployedCapital > 0 ? 'accent' : 'neutral'}
          />
          <RiskMetricCard
            label="Available"
            value={formatCurrency(data.available_capital)}
            detail="cash buffer"
            icon={Banknote}
            tone="profit"
          />
          <RiskMetricCard
            label="Open Risk"
            value={formatCurrency(data.open_risk)}
            detail={formatMetricPercent(data.portfolio_heat_pct)}
            icon={ShieldAlert}
            tone={openRisk < 0 ? 'profit' : openRisk > 0 ? heatTone : 'neutral'}
          />
          <RiskMetricCard
            label="Warnings"
            value={String(warnings.length)}
            detail={warnings.length > 0 ? 'active alerts' : 'clear'}
            icon={Activity}
            tone={warnings.some((warning) => warning.severity === 'high') ? 'loss' : warnings.length > 0 ? 'warning' : 'profit'}
          />
        </div>
      </div>

      {!hasOpenPositions ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-bg-elevated p-4 animate-card-in sm:flex-row sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-profit/20 bg-profit-muted">
            <ShieldCheck className="h-4 w-4 text-profit" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[length:var(--text-sm)] text-text-heading">No open trades</div>
            <div className="mt-1 text-[length:var(--text-sm)] text-text-muted">
              Portfolio heat is idle. New positions will appear here with stop coverage, setup exposure, and concentration warnings.
            </div>
          </div>
        </div>
      ) : null}

      {full && (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <RiskPositionCard title="Largest Position" trade={full.largest_position} />
              <RiskPositionCard title="Largest Risk" trade={full.largest_risk_position} />
            </div>
            <RiskWarningsPanel warnings={warnings} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RiskExposureTable title="Setup Exposure" variant="setup" buckets={setupBuckets} />
            <RiskExposureTable title="Symbol Exposure" variant="symbol" buckets={symbolBuckets} />
          </div>
        </>
      )}
    </section>
  )
}
