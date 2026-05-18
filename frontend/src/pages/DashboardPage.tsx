// Dashboard — key metrics at a glance
import { useDashboardQuery } from '@/hooks/useDashboardQuery'
import { useRiskDashboardQuery } from '@/hooks/useRiskDashboardQuery'
import { RiskCommandCenter } from '@/components/risk/RiskCommandCenter'
import { LifecycleInsights } from '@/components/lifecycle/LifecycleInsights'
import { BehavioralIntelligence } from '@/components/lifecycle/BehavioralIntelligence'
import { PlaybookIntelligence } from '@/components/lifecycle/PlaybookIntelligence'
import {
  formatCurrency, formatPercent, parseDecimal, formatDate,
} from '@/utils/format'
import {
  TrendingUp, Wallet, Activity, Target, Calendar, Flame, AlertTriangle,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type {
  AnalyticsKpi, DailyPnlEntry, MonthlyPnlEntry, AnalyticsStreaks,
} from '@/types'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

function pnlNum(v: string | null): number { return parseDecimal(v, 0) }

const COLORS = { profit: 'var(--profit)', loss: 'var(--loss)', accent: 'var(--accent)', text: 'var(--text)', grid: 'var(--border)' }
const CARD = 'bg-card rounded-2xl border border-border p-5 animate-card-in'

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card rounded-lg p-3 border border-border text-xs shadow-lg">
      <div className="text-text-muted mb-1 font-medium font-display">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color || COLORS.accent }} />
          <span className="text-text-heading font-data">{entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function KpiCards({ kpi }: { kpi: AnalyticsKpi }) {
  const cards = [
    { label: 'Net P&L', value: kpi.net_pnl != null ? formatCurrency(pnlNum(kpi.net_pnl)) : 'N/A', sub: `${kpi.trade_count} trades`, icon: TrendingUp, color: pnlNum(kpi.net_pnl) >= 0 ? 'profit' : 'loss', bg: pnlNum(kpi.net_pnl) >= 0 ? 'bg-profit-muted' : 'bg-loss-muted' },
    { label: 'Win Rate', value: kpi.win_rate != null ? formatPercent(kpi.win_rate) : 'N/A', sub: `${kpi.trade_count} trades`, icon: Target, color: kpi.win_rate != null && kpi.win_rate >= 50 ? 'profit' : 'loss', bg: kpi.win_rate != null && kpi.win_rate >= 50 ? 'bg-profit-muted' : 'bg-loss-muted' },
    { label: 'Profit Factor', value: kpi.profit_factor != null ? kpi.profit_factor.toFixed(2) : 'N/A', sub: 'ratio', icon: Activity, color: kpi.profit_factor != null && kpi.profit_factor >= 1.5 ? 'profit' : kpi.profit_factor != null && kpi.profit_factor >= 1 ? 'text-accent' : 'loss' },
    { label: 'Avg R', value: kpi.avg_r_multiple != null ? kpi.avg_r_multiple.toFixed(2) + 'R' : 'N/A', sub: `${kpi.avg_r_multiple != null ? 'per trade' : ''}`, icon: Wallet, color: kpi.avg_r_multiple != null && kpi.avg_r_multiple >= 0 ? 'profit' : 'loss' },
    { label: 'Expectancy', value: kpi.expectancy != null ? formatCurrency(kpi.expectancy) : 'N/A', sub: 'per trade', icon: TrendingUp, color: kpi.expectancy != null && kpi.expectancy >= 0 ? 'profit' : 'loss' },
    { label: 'Max DD', value: kpi.max_drawdown_pct != null ? formatPercent(-kpi.max_drawdown_pct) : 'N/A', sub: 'drawdown', icon: Flame, color: 'text-loss' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className={`${CARD} p-4`}>
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 text-${card.color}`} />
            </div>
            <div className={`text-lg font-bold font-data ${card.color === 'profit' ? 'text-profit' : card.color === 'loss' ? 'text-loss' : card.color === 'text-accent' ? 'text-accent' : 'text-text-heading'}`}>{card.value}</div>
            <div className="text-[11px] text-text-muted font-data mt-0.5">{card.sub}</div>
          </div>
        )
      })}
    </div>
  )
}

function EquityCurve({ data }: { data: DailyPnlEntry[] }) {
  const chartData = data.map((d) => ({ date: formatDate(d.date), pnl: pnlNum(d.net_pnl), cum: pnlNum(d.cumulative_pnl) }))
  const isPositive = chartData.length > 0 && (chartData[chartData.length - 1]?.cum ?? 0) >= 0
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-[15px] h-[15px] text-accent" />
        <h3 className="font-display text-sm text-text-heading">Equity Curve</h3>
      </div>
      {chartData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-text-muted text-sm">No trade data</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? COLORS.profit : COLORS.loss} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isPositive ? COLORS.profit : COLORS.loss} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} width={70} />
            <Tooltip content={<GlassTooltip />} />
            <Area type="monotone" dataKey="cum" stroke={isPositive ? COLORS.profit : COLORS.loss} fill="url(#equityFill)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function StreakCard({ data }: { data: AnalyticsStreaks }) {
  const { current_streak, longest_win_streak, longest_loss_streak } = data || {}
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-[15px] h-[15px] text-accent" />
        <h3 className="font-display text-sm text-text-heading">Streaks</h3>
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-xs text-text-muted mb-1">Current</div>
          <div className={`font-data text-lg font-bold ${current_streak?.type === 'win' ? 'text-profit' : current_streak?.type === 'loss' ? 'text-loss' : 'text-text-muted'}`}>
            {current_streak?.type ? `${current_streak.count} ${current_streak.type}` : '—'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <div className="text-xs text-text-muted mb-1">Best</div>
            <div className="font-data text-base font-bold text-profit">{longest_win_streak || 0}W</div>
          </div>
          <div>
            <div className="text-xs text-text-muted mb-1">Worst</div>
            <div className="font-data text-base font-bold text-loss">{longest_loss_streak || 0}L</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MonthlyPnl({ data }: { data: MonthlyPnlEntry[] }) {
  const chartData = (data || []).map((d) => ({ month: d.month, pnl: pnlNum(d.net_pnl), count: d.trade_count }))
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-[15px] h-[15px] text-accent" />
        <h3 className="font-display text-sm text-text-heading">Monthly P&L</h3>
      </div>
      {chartData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-text-muted text-sm">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} width={70} />
            <Tooltip content={<GlassTooltip />} />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <rect key={i} fill={entry.pnl >= 0 ? COLORS.profit : COLORS.loss} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function RiskCommandCenterSkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="h-4 w-32 rounded bg-bg-elevated animate-pulse" />
          <div className="mt-2 h-7 w-52 rounded bg-bg-elevated animate-pulse" />
        </div>
        <div className="hidden h-4 w-28 rounded bg-bg-elevated animate-pulse sm:block" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${CARD} h-72 animate-pulse`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${CARD} h-28 animate-pulse`} />
          ))}
        </div>
      </div>
    </section>
  )
}

function RiskCommandCenterError({ error }: { error: unknown }) {
  return (
    <div className={`${CARD} flex items-start gap-3`}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-loss" />
      <div>
        <h2 className="font-display text-sm text-text-heading">Risk layer unavailable</h2>
        <p className="mt-1 text-sm text-text-muted">
          {(error as Error)?.message || 'Unable to load current risk metrics.'}
        </p>
      </div>
    </div>
  )
}

function RiskCommandCenterNoAccount() {
  return (
    <div className={`${CARD} flex items-start gap-3`}>
      <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <div>
        <h2 className="font-display text-sm text-text-heading">Risk layer waiting for account</h2>
        <p className="mt-1 text-sm text-text-muted">
          Create a capital account to activate portfolio heat, deployment, and open-risk metrics.
        </p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, error } = useDashboardQuery()
  const { data: riskData, isLoading: isRiskLoading, error: riskError } = useRiskDashboardQuery()
  const queryClient = useQueryClient()

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['analytics'] })
    await queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] })
  }, [queryClient])

  if (isLoading) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${CARD} h-24 animate-pulse`} />
          ))}
        </div>
        <div className={`${CARD} h-40 animate-pulse`} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)]">
        <div className={`${CARD} py-12 text-center`}>
          <AlertTriangle className="w-8 h-8 text-loss mx-auto mb-3" />
          <h2 className="text-lg font-medium text-text-heading font-display mb-2">Failed to load</h2>
          <p className="text-text-muted text-sm">{(error as Error)?.message || 'Something went wrong.'}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)]">
        <div className={`${CARD} py-12 text-center`}>
          <p className="text-text-muted font-data">No data available.</p>
        </div>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Dashboard</h1>
        <div className="text-sm text-text-muted font-data">{formatDate(new Date())}</div>
      </div>
      <KpiCards kpi={data.kpi} />
      {isRiskLoading ? (
        <RiskCommandCenterSkeleton />
      ) : riskData ? (
        <RiskCommandCenter data={riskData} />
      ) : riskData === null ? (
        <RiskCommandCenterNoAccount />
      ) : (
        <RiskCommandCenterError error={riskError} />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EquityCurve data={data.daily_pnl} />
        </div>
        <StreakCard data={data.streaks} />
      </div>
      <MonthlyPnl data={data.monthly_pnl} />
      <LifecycleInsights />
      <BehavioralIntelligence />
      <PlaybookIntelligence />
    </div>
    </PullToRefresh>
  )
}
