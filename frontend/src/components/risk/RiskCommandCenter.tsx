import {
  Activity,
  ArrowDownToLine,
  Banknote,
  BriefcaseBusiness,
  Shield,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { formatCurrency, formatPrice, formatQuantity } from '@/utils/format'
import type { RiskDashboardPayload, RiskTrade } from '@/types/riskDashboard'
import { PortfolioHeatGauge } from '@/components/risk/PortfolioHeatGauge'
import { RiskExposureTable } from '@/components/risk/RiskExposureTable'
import { RiskMetricCard } from '@/components/risk/RiskMetricCard'
import { RiskWarningsPanel } from '@/components/risk/RiskWarningsPanel'

function formatPct(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)}%`
}

function RiskPositionCard({ title, trade }: { title: string; trade: RiskTrade | null }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 animate-card-in min-w-0">
      <div className="mb-4 flex items-center gap-2">
        <BriefcaseBusiness className="h-4 w-4 shrink-0 text-accent" />
        <h3 className="truncate font-display text-sm text-text-heading">{title}</h3>
      </div>

      {trade == null ? (
        <div className="py-5 text-sm text-text-muted">No open positions</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-data text-lg font-semibold text-text-heading">{trade.symbol}</div>
              <div className="mt-1 truncate text-xs text-text-muted">{trade.setup ?? 'Uncategorised'}</div>
            </div>
            <div className="rounded-md border border-border px-2 py-1 text-xs text-text-muted font-data">
              {formatPct(trade.risk_pct)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <div className="text-[length:var(--text-xs)] text-text-muted">Entry</div>
              <div className="mt-1 truncate font-data text-sm text-text-heading">{formatPrice(trade.entry_price)}</div>
            </div>
            <div>
              <div className="text-[length:var(--text-xs)] text-text-muted">Stop</div>
              <div className={`mt-1 truncate font-data text-sm ${trade.stop_price ? 'text-text-heading' : 'text-loss'}`}>
                {trade.stop_price ? formatPrice(trade.stop_price) : 'Missing'}
              </div>
            </div>
            <div>
              <div className="text-[length:var(--text-xs)] text-text-muted">Qty</div>
              <div className="mt-1 truncate font-data text-sm text-text-heading">{formatQuantity(trade.quantity)}</div>
            </div>
            <div>
              <div className="text-[length:var(--text-xs)] text-text-muted">Risk</div>
              <div className="mt-1 truncate font-data text-sm text-loss">{formatCurrency(trade.open_risk)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function RiskCommandCenter({ data }: { data: RiskDashboardPayload }) {
  const hasMissingStops = data.positions_without_stop > 0
  const heatTone = data.portfolio_heat_pct != null && data.portfolio_heat_pct > 6
    ? 'loss'
    : data.portfolio_heat_pct != null && data.portfolio_heat_pct > 4
      ? 'warning'
      : 'profit'

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[length:var(--text-xs)] text-accent font-data">
            <Shield className="h-3.5 w-3.5" />
            Risk Intelligence
          </div>
          <h2 className="mt-1 font-display text-xl text-text-heading sm:text-2xl">Risk Command Center</h2>
        </div>
        <div className="truncate text-[length:var(--text-xs)] text-text-muted font-data">
          {data.account_name}
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
            detail={hasMissingStops ? `${data.positions_without_stop} without SL` : 'all stopped'}
            icon={BriefcaseBusiness}
            tone={hasMissingStops ? 'loss' : 'accent'}
          />
          <RiskMetricCard
            label="Deployed"
            value={formatCurrency(data.deployed_capital)}
            detail={formatPct(data.deployed_capital_pct)}
            icon={ArrowDownToLine}
            tone={data.deployed_capital_pct != null && data.deployed_capital_pct > 80 ? 'warning' : 'accent'}
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
            detail={formatPct(data.portfolio_heat_pct)}
            icon={ShieldAlert}
            tone={heatTone}
          />
          <RiskMetricCard
            label="Warnings"
            value={String(data.warnings.length)}
            detail={data.warnings.length > 0 ? 'active alerts' : 'clear'}
            icon={Activity}
            tone={data.warnings.some((warning) => warning.severity === 'high') ? 'loss' : data.warnings.length > 0 ? 'warning' : 'profit'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RiskPositionCard title="Largest Position" trade={data.largest_position} />
          <RiskPositionCard title="Largest Risk" trade={data.largest_risk_position} />
        </div>
        <RiskWarningsPanel warnings={data.warnings} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RiskExposureTable title="Setup Exposure" variant="setup" buckets={data.risk_by_setup} />
        <RiskExposureTable title="Symbol Exposure" variant="symbol" buckets={data.risk_by_symbol} />
      </div>
    </section>
  )
}
