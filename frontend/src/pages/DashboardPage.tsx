import { useOperationalDashboardQuery } from '@/hooks/useOperationalDashboardQuery'
import { useIntelligenceDashboardQuery } from '@/hooks/useIntelligenceDashboardQuery'
import { useLiveQuotesQuery, useSyncLiveQuotesMutation } from '@/hooks/useMarketContextQuery'
import { useDailyDashboard } from '@/hooks/usePerformanceOS'
import { RiskCommandCenter } from '@/components/risk/RiskCommandCenter'
import { LiveDashboard } from '@/components/dashboard/LiveDashboard'
import { formatCurrency, formatPercent, parseDecimal } from '@/utils/format'
import {
  TrendingUp, Wallet, Activity, Target, Flame, AlertTriangle,
  Brain, Shield, BookOpen, BarChart3, Eye, LineChart as LineChartIcon,
  CheckCircle2, ListChecks, SlidersHorizontal, ArrowUp,
  ArrowDown, PanelTopClose, PanelTopOpen, X,
} from 'lucide-react'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { PageHeader, SyncBadge, LastUpdated, CollapsibleSection, KpiCard } from '@/components/ui/SharedUI'
import { EmptyState, ErrorState, SectionSkeleton, CardSkeleton, MetricSkeleton } from '@/components/ui/StateComponents'
import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { mark, measure } from '@/utils/performance'
import type { IntelligenceDashboardPayload, OperationalDashboardPayload } from '@/types'
import type { RiskDashboardPayload } from '@/types/riskDashboard'
import type { DailyDashboard, WorkflowPhase } from '@/types/performanceOs'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const LifecycleInsights = lazy(() => import('@/components/lifecycle/LifecycleInsights').then(m => ({ default: m.LifecycleInsights })))
const BehavioralIntelligence = lazy(() => import('@/components/lifecycle/BehavioralIntelligence').then(m => ({ default: m.BehavioralIntelligence })))
const PlaybookIntelligence = lazy(() => import('@/components/lifecycle/PlaybookIntelligence').then(m => ({ default: m.PlaybookIntelligence })))
const MarketContext = lazy(() => import('@/components/market/MarketContext').then(m => ({ default: m.MarketContext })))

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'
const DASHBOARD_WIDGET_PREF_KEY = 'tjv3-dashboard-widgets-v1'

type DashboardWidgetId = 'alerts' | 'kpis' | 'equity' | 'live' | 'workflow' | 'risk' | 'intelligence' | 'deep'
type WidgetDensity = 'compact' | 'expanded'

type WidgetPreference = {
  id: DashboardWidgetId
  visible: boolean
  density: WidgetDensity
}

const DEFAULT_WIDGET_PREFS: WidgetPreference[] = [
  { id: 'alerts', visible: true, density: 'expanded' },
  { id: 'kpis', visible: true, density: 'compact' },
  { id: 'equity', visible: true, density: 'expanded' },
  { id: 'live', visible: true, density: 'expanded' },
  { id: 'workflow', visible: true, density: 'compact' },
  { id: 'risk', visible: true, density: 'expanded' },
  { id: 'intelligence', visible: true, density: 'compact' },
  { id: 'deep', visible: true, density: 'expanded' },
]

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  alerts: 'Alert Zone',
  kpis: 'KPI Cards',
  equity: 'Equity',
  live: 'Live Positions',
  workflow: 'Daily Workflow',
  risk: 'Risk Center',
  intelligence: 'Intelligence Cards',
  deep: 'Deep Sections',
}

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  pre_market: 'Pre-Market',
  execution: 'Execution',
  review: 'Review',
  behavior: 'Behavior',
}

function normalizeWidgetPrefs(raw: unknown): WidgetPreference[] {
  if (!Array.isArray(raw)) return DEFAULT_WIDGET_PREFS
  const incoming = new Map<string, Partial<WidgetPreference>>(
    raw
      .filter((item): item is Partial<WidgetPreference> => item && typeof item === 'object' && 'id' in item)
      .map((item) => [String(item.id), item])
  )
  const merged = DEFAULT_WIDGET_PREFS.map((pref) => {
    const next = incoming.get(pref.id)
    return {
      id: pref.id,
      visible: typeof next?.visible === 'boolean' ? next.visible : pref.visible,
      density: next?.density === 'expanded' || next?.density === 'compact' ? next.density : pref.density,
    }
  })
  return merged
}

function getInitialWidgetPrefs(): WidgetPreference[] {
  try {
    const stored = localStorage.getItem(DASHBOARD_WIDGET_PREF_KEY)
    if (!stored) return DEFAULT_WIDGET_PREFS
    return normalizeWidgetPrefs(JSON.parse(stored))
  } catch {
    return DEFAULT_WIDGET_PREFS
  }
}

function WidgetShell({
  pref,
  children,
}: {
  pref: WidgetPreference
  children: React.ReactNode
}) {
  if (!pref.visible) return null
  return (
    <section className={cn(pref.density === 'compact' && 'dashboard-widget-compact')}>
      {children}
    </section>
  )
}

/* ── KPI Cards ────────────────────────────────────────────── */

function KpiCards({ kpi }: { kpi: OperationalDashboardPayload['kpi'] }) {
  const cards = useMemo(() => [
    { label: 'Net P&L', desc: 'Total realized profit/loss across all closed trades', value: kpi.net_pnl != null ? formatCurrency(Number(kpi.net_pnl)) : '—', sub: `${kpi.trade_count} trades`, icon: TrendingUp, color: Number(kpi.net_pnl) >= 0 ? 'profit' : 'loss' },
    { label: 'Win Rate', desc: 'Percentage of trades that closed in profit', value: kpi.win_rate != null ? `${kpi.win_rate.toFixed(1)}%` : '—', sub: `${kpi.trade_count} trades`, icon: Target, color: kpi.win_rate != null && kpi.win_rate >= 50 ? 'profit' : 'loss' },
    { label: 'Profit Factor', desc: 'Gross profit divided by gross loss. >1.5 is good, <1 is losing', value: kpi.profit_factor != null ? Number(kpi.profit_factor).toFixed(2) : (Number(kpi.gross_profit) > 0 && Number(kpi.gross_loss) === 0 ? '∞' : '—'), sub: 'ratio', icon: Activity, color: (kpi.profit_factor != null ? (Number(kpi.profit_factor) >= 1.5 ? 'profit' : Number(kpi.profit_factor) >= 1 ? 'neutral' : 'loss') : (Number(kpi.gross_profit) > 0 && Number(kpi.gross_loss) === 0 ? 'profit' : 'loss')) as 'profit' | 'loss' | 'neutral' },
    { label: 'Avg R', desc: 'Average R-multiple per trade. Positive = edge exists', value: kpi.avg_r_multiple != null ? `${kpi.avg_r_multiple.toFixed(2)}R` : '—', sub: 'per trade', icon: Wallet, color: kpi.avg_r_multiple != null && kpi.avg_r_multiple >= 0 ? 'profit' : 'loss' },
    { label: 'Expectancy', desc: 'Average profit per trade. Positive edge over time', value: kpi.expectancy != null ? formatCurrency(kpi.expectancy) : '—', sub: 'per trade', icon: TrendingUp, color: kpi.expectancy != null && kpi.expectancy >= 0 ? 'profit' : 'loss' },
    { label: 'Max DD', desc: 'Largest peak-to-trough drawdown in account value', value: (() => {
      const amt = kpi.max_drawdown_amount ?? kpi.max_drawdown_pct
      const pct = kpi.max_drawdown_pct
      const amtStr = amt != null ? formatCurrency(amt) : '—'
      const pctStr = pct != null ? `${pct.toFixed(1)}%` : '—'
      return `${amtStr} (${pctStr})`
    })(), sub: 'drawdown', icon: Flame, color: 'loss' },
  ], [kpi])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[var(--page-gap)]">
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          label={card.label}
          value={card.value}
          sub={card.sub}
          icon={card.icon}
          color={card.color as 'profit' | 'loss' | 'neutral'}
          desc={card.desc}
        />
      ))}
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[var(--page-gap)]">
      {Array.from({ length: 6 }).map((_, i) => (
        <MetricSkeleton key={i} />
      ))}
    </div>
  )
}

/* ── Risk Skeleton ────────────────────────────────────────── */

const CHART_COLORS = {
  accent: 'var(--accent)',
  profit: 'var(--profit)',
  loss: 'var(--loss)',
  text: 'var(--text)',
  grid: 'var(--border)',
}

function EquityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card rounded-lg p-3 border border-border text-xs shadow-lg">
      <div className="text-text-muted mb-1 font-medium font-display">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color || CHART_COLORS.accent }} />
          <span className="text-text-heading font-data">{entry.name}: {formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

function EquitySection({ capital, equityCurve }: { capital: OperationalDashboardPayload['capital']; equityCurve: OperationalDashboardPayload['equity_curve'] }) {
  const netEquity = parseDecimal(capital?.net_equity ?? '0', 0)
  const initialBalance = parseDecimal(capital?.initial_balance ?? '0', 0)
  const unrealizedPnl = parseDecimal(capital?.unrealized_pnl ?? '0', 0)
  const totalEquityUnrealized = parseDecimal(capital?.total_equity_unrealized ?? '0', 0)
  const realizedDelta = netEquity - initialBalance
  const totalDelta = totalEquityUnrealized - initialBalance

  const curveData = useMemo(() => equityCurve ?? [], [equityCurve])
  const chartData = useMemo(() =>
    curveData.map(p => ({ date: p.date, equity: parseDecimal(p.equity, 0) })),
  [curveData])

  const minEquity = chartData.length ? Math.min(...chartData.map(d => d.equity)) : 0
  const maxEquity = chartData.length ? Math.max(...chartData.map(d => d.equity)) : 0
  const yDomain = [Math.floor((minEquity * 0.995) / 1000) * 1000, Math.ceil((maxEquity * 1.005) / 1000) * 1000]

  return (
    <div className="space-y-[var(--page-gap)]">
      <div className="grid grid-cols-2 gap-[var(--page-gap)]">
        <div className={`${CARD} relative overflow-hidden`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[length:var(--text-xs)] uppercase tracking-wider text-text-muted mb-1 font-display">Realized Equity</div>
              <div className={`text-2xl sm:text-3xl font-bold font-data ${netEquity >= initialBalance ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(capital.net_equity)}
              </div>
              <div className={`text-xs font-data mt-1 ${realizedDelta >= 0 ? 'text-profit' : 'text-loss'}`}>
                {realizedDelta >= 0 ? '+' : ''}{formatCurrency(realizedDelta)} from starting
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center">
              <Wallet className="w-4 h-4 text-accent" />
            </div>
          </div>
        </div>
        <div className={`${CARD} relative overflow-hidden`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[length:var(--text-xs)] uppercase tracking-wider text-text-muted mb-1 font-display">Total Equity</div>
              <div className={`text-2xl sm:text-3xl font-bold font-data ${totalEquityUnrealized >= initialBalance ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(capital.total_equity_unrealized)}
              </div>
              <div className={`text-xs font-data mt-1 ${totalDelta >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)} from starting
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center">
              <Eye className="w-4 h-4 text-accent" />
            </div>
          </div>
          {unrealizedPnl !== 0 && (
            <div className={`mt-2 text-xs font-data ${unrealizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              Unrealized: {unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(unrealizedPnl)}
            </div>
          )}
        </div>
      </div>

      {chartData.length > 1 && (
        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <LineChartIcon className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-text-heading font-display">Equity Curve</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                tickFormatter={(v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}` }}
                minTickGap={30}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<EquityTooltip />} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={CHART_COLORS.accent}
                strokeWidth={2}
                fill="url(#eqGrad)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.accent }}
                name="Equity"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function RiskSkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-bg-elevated animate-pulse" />
          <div className="h-7 w-52 rounded bg-bg-elevated animate-pulse" />
        </div>
        <div className="hidden h-3 w-28 rounded bg-bg-elevated animate-pulse sm:block" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${CARD} h-72 animate-pulse bg-bg-elevated/50`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

type DashboardAlert = {
  severity: 'high' | 'medium' | 'low'
  code: string
  title: string
  message: string
}

function buildDashboardAlerts({
  warnings,
  openTrades,
  liveQuotes,
  intelligence,
}: {
  warnings: Array<{ severity: string; message: string; code: string; symbol?: string | null }>
  openTrades: OperationalDashboardPayload['open_trades']
  liveQuotes: ReturnType<typeof useLiveQuotesQuery>['data']
  intelligence?: IntelligenceDashboardPayload
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = []

  for (const warning of warnings) {
    const severity = warning.severity === 'high' ? 'high' : warning.severity === 'medium' ? 'medium' : 'low'
    alerts.push({
      severity,
      code: warning.code,
      title: warning.symbol ? warning.symbol : warning.code.replace(/_/g, ' '),
      message: warning.message,
    })
  }

  const quoteStatusCounts = liveQuotes?.status_counts ?? {}
  const failedQuotes = Number(quoteStatusCounts.failed ?? 0)
  const staleQuotes = Number(quoteStatusCounts.stale ?? 0)
  const quoteCount = liveQuotes?.quotes?.length ?? 0
  if (openTrades.length > 0 && quoteCount === 0) {
    alerts.push({
      severity: 'medium',
      code: 'quotes_missing',
      title: 'Live quote sync',
      message: `${openTrades.length} open position${openTrades.length === 1 ? '' : 's'} without live quote data.`,
    })
  } else if (failedQuotes > 0 || staleQuotes > 0) {
    alerts.push({
      severity: failedQuotes > 0 ? 'high' : 'medium',
      code: 'quotes_stale_or_failed',
      title: 'Quote quality',
      message: `${failedQuotes} failed and ${staleQuotes} stale quote${failedQuotes + staleQuotes === 1 ? '' : 's'} in the live cache.`,
    })
  }

  const behavioral = intelligence?.behavioral
  if ((behavioral?.revenge_trades ?? 0) > 0) {
    alerts.push({
      severity: 'medium',
      code: 'revenge_trades',
      title: 'Behavior',
      message: `${behavioral?.revenge_trades ?? 0} revenge pattern${behavioral?.revenge_trades === 1 ? '' : 's'} need review.`,
    })
  }
  if ((behavioral?.overtrading_days ?? 0) > 0) {
    alerts.push({
      severity: 'medium',
      code: 'overtrading_days',
      title: 'Trade frequency',
      message: `${behavioral?.overtrading_days ?? 0} overtrading day${behavioral?.overtrading_days === 1 ? '' : 's'} detected.`,
    })
  }

  const priority = { high: 0, medium: 1, low: 2 }
  const seen = new Set<string>()
  return alerts
    .filter((alert) => {
      if (seen.has(alert.code)) return false
      seen.add(alert.code)
      return true
    })
    .sort((a, b) => priority[a.severity] - priority[b.severity])
}

function AlertZone({ alerts }: { alerts: DashboardAlert[] }) {
  const visible = alerts.slice(0, 4)
  const highCount = alerts.filter((alert) => alert.severity === 'high').length
  const mediumCount = alerts.filter((alert) => alert.severity === 'medium').length

  if (visible.length === 0) {
    return (
      <div className={cn(CARD, 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between')}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-profit-muted">
            <CheckCircle2 className="h-4 w-4 text-profit" />
          </div>
          <div>
            <div className="font-display text-[length:var(--text-sm)] text-text-heading">Clear for now</div>
            <p className="mt-1 text-[length:var(--text-sm)] text-text-muted">No critical risk, behavior, or quote alerts are active.</p>
          </div>
        </div>
        <span className="rounded-full border border-profit/20 bg-profit-muted px-3 py-1 text-[10px] font-data uppercase tracking-wider text-profit">
          All clear
        </span>
      </div>
    )
  }

  return (
    <div className={cn(CARD, 'border-loss/20 bg-loss-muted/10')}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-loss" />
          <h2 className="font-display text-[length:var(--text-sm)] text-text-heading">Action Zone</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-wider">
          {highCount > 0 && <span className="rounded-full bg-loss-muted px-2 py-1 text-loss">{highCount} high</span>}
          {mediumCount > 0 && <span className="rounded-full bg-gold-faint px-2 py-1 text-gold">{mediumCount} medium</span>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {visible.map((alert) => (
          <div
            key={alert.code}
            className={cn(
              'flex min-h-[76px] items-start gap-3 rounded-xl border p-3',
              alert.severity === 'high'
                ? 'border-loss/20 bg-loss-muted/20'
                : alert.severity === 'medium'
                  ? 'border-gold/20 bg-gold-faint'
                  : 'border-border bg-bg-elevated'
            )}
          >
            <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', alert.severity === 'high' ? 'bg-loss' : alert.severity === 'medium' ? 'bg-gold' : 'bg-accent')} />
            <div className="min-w-0">
              <div className={cn('font-data text-xs uppercase tracking-wider', alert.severity === 'high' ? 'text-loss' : alert.severity === 'medium' ? 'text-gold' : 'text-accent')}>
                {alert.title}
              </div>
              <div className="mt-1 text-sm leading-5 text-text-heading">{alert.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Intelligence Summaries (collapsed) ─────────────────────── */

function IntelligenceSummaryRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-bg-elevated px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">{item.label}</div>
          <div className="mt-1 truncate font-data text-sm text-text-heading">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function lifecycleSummary(intelligence?: IntelligenceDashboardPayload) {
  const lifecycle = intelligence?.lifecycle
  return (
    <IntelligenceSummaryRow
      items={[
        { label: 'Logs', value: String(lifecycle?.total_emotion_logs ?? 0) },
        { label: 'Top Emotion', value: lifecycle?.most_frequent_emotion ?? '—' },
        { label: 'Avg Grade', value: lifecycle?.avg_grade_score != null ? lifecycle.avg_grade_score.toFixed(2) : '—' },
        { label: 'Discipline', value: lifecycle?.discipline_score != null ? formatPercent(lifecycle.discipline_score) : '—' },
      ]}
    />
  )
}

function behavioralSummary(intelligence?: IntelligenceDashboardPayload) {
  const behavioral = intelligence?.behavioral
  return (
    <IntelligenceSummaryRow
      items={[
        { label: 'Overtrade Days', value: String(behavioral?.overtrading_days ?? 0) },
        { label: 'Revenge Trades', value: String(behavioral?.revenge_trades ?? 0) },
        { label: 'Early Exits', value: behavioral?.early_exit_rate != null ? formatPercent(behavioral.early_exit_rate) : '—' },
        { label: 'Capture', value: behavioral?.avg_capture_ratio != null ? behavioral.avg_capture_ratio.toFixed(2) : '—' },
      ]}
    />
  )
}

function getPlaybookSetups(intelligence?: IntelligenceDashboardPayload) {
  return intelligence?.playbook?.setups ?? []
}

function playbookSummary(intelligence?: IntelligenceDashboardPayload) {
  const setups = getPlaybookSetups(intelligence)
  const best = setups[0]
  return (
    <IntelligenceSummaryRow
      items={[
        { label: 'Setups', value: String(setups.length) },
        { label: 'Best Setup', value: best?.name ?? '—' },
        { label: 'Win Rate', value: best?.win_rate != null ? formatPercent(best.win_rate) : '—' },
        { label: 'Total P&L', value: best?.total_pnl != null ? formatCurrency(Number(best.total_pnl)) : '—' },
      ]}
    />
  )
}

function marketSummary(intelligence?: IntelligenceDashboardPayload) {
  const market = intelligence?.market
  return (
    <IntelligenceSummaryRow
      items={[
        { label: 'Regime', value: market?.nifty_regime ?? '—' },
        { label: 'NIFTY', value: market?.nifty_close != null ? market.nifty_close.toLocaleString('en-IN') : '—' },
        { label: 'VIX', value: market?.india_vix != null ? market.india_vix.toFixed(2) : '—' },
        { label: 'Breadth', value: market?.breadth_advance != null && market?.breadth_decline != null ? `${market.breadth_advance}/${market.breadth_decline}` : '—' },
      ]}
    />
  )
}

function WorkflowCard({ dashboard, onOpenPerformanceOS }: { dashboard?: DailyDashboard; onOpenPerformanceOS: () => void }) {
  const workflow = dashboard?.workflow
  const progress = dashboard?.phase_progress
  const phase = workflow?.phase ?? progress?.current_phase ?? 'pre_market'
  const checklist = workflow?.checklist_items ?? []
  const completedItems = checklist.filter((item) => item.checked).length
  const totalItems = checklist.length
  const nextItem = checklist.find((item) => !item.checked)
  const openPositions = dashboard?.open_positions?.length ?? 0
  const todayTrades = dashboard?.today_trades?.length ?? 0
  const doneCount = progress?.completed?.filter(Boolean).length ?? 0
  const allDone = Boolean(progress?.all_done)

  const phaseTone =
    phase === 'pre_market' ? 'text-blue-400' :
    phase === 'execution' ? 'text-gold' :
    phase === 'review' ? 'text-profit' :
    'text-accent'

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-accent" />
            <h2 className="font-display text-[length:var(--text-sm)] text-text-heading">Daily Workflow</h2>
          </div>
          <div className="mt-1 text-[length:var(--text-sm)] text-text-muted">
            {allDone ? 'Trading day closed out.' : nextItem?.label ?? 'Keep the daily loop moving.'}
          </div>
        </div>
        <button
          onClick={onOpenPerformanceOS}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent cursor-pointer"
        >
          Open
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Phase</div>
          <div className={cn('mt-1 font-data text-sm font-semibold', phaseTone)}>{PHASE_LABELS[phase]}</div>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Progress</div>
          <div className="mt-1 font-data text-sm font-semibold text-text-heading">{doneCount}/4 phases</div>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Checklist</div>
          <div className="mt-1 font-data text-sm font-semibold text-text-heading">{completedItems}/{totalItems || 0} done</div>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Session</div>
          <div className="mt-1 font-data text-sm font-semibold text-text-heading">{todayTrades} trades, {openPositions} open</div>
        </div>
      </div>
    </div>
  )
}

function IntelligenceCards({ intelligence }: { intelligence?: IntelligenceDashboardPayload }) {
  const setups = getPlaybookSetups(intelligence)
  const bestSetup = setups[0]
  const behavioral = intelligence?.behavioral
  const lifecycle = intelligence?.lifecycle
  const market = intelligence?.market
  const worstBehavior = (behavioral?.revenge_trades ?? 0) > 0
    ? `${behavioral?.revenge_trades ?? 0} revenge trades`
    : (behavioral?.overtrading_days ?? 0) > 0
      ? `${behavioral?.overtrading_days ?? 0} overtrading days`
      : 'No active pattern'

  const cards = [
    {
      label: 'Best Setup',
      value: bestSetup?.name ?? 'No setup data',
      detail: bestSetup?.win_rate != null ? `${formatPercent(bestSetup.win_rate)} win rate` : 'Needs more closed trades',
      icon: BookOpen,
      tone: 'text-profit',
    },
    {
      label: 'Worst Pattern',
      value: worstBehavior,
      detail: behavioral?.early_exit_rate != null ? `${formatPercent(behavioral.early_exit_rate)} early exits` : 'Behavior signals are quiet',
      icon: Shield,
      tone: worstBehavior === 'No active pattern' ? 'text-profit' : 'text-gold',
    },
    {
      label: 'Market Regime',
      value: market?.nifty_regime ?? 'Not synced',
      detail: market?.nifty_close != null ? `NIFTY ${market.nifty_close.toLocaleString('en-IN')}` : 'Sync market context',
      icon: BarChart3,
      tone: 'text-accent',
    },
    {
      label: 'Execution Trend',
      value: lifecycle?.avg_grade_score != null ? `${lifecycle.avg_grade_score.toFixed(2)}/5` : 'No grades',
      detail: lifecycle?.discipline_score != null ? `${formatPercent(lifecycle.discipline_score)} discipline` : 'Grade trades to unlock trend',
      icon: Brain,
      tone: lifecycle?.avg_grade_score != null && lifecycle.avg_grade_score >= 3.5 ? 'text-profit' : 'text-text-heading',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className={CARD}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-[10px] font-data uppercase tracking-wider text-text-muted">{card.label}</div>
              <Icon className="h-4 w-4 text-accent" />
            </div>
            <div className={cn('truncate font-data text-lg font-semibold capitalize', card.tone)}>{card.value}</div>
            <div className="mt-1 truncate text-[length:var(--text-xs)] text-text-muted">{card.detail}</div>
          </div>
        )
      })}
    </div>
  )
}

function WidgetControls({
  prefs,
  onToggleVisible,
  onMove,
  onDensity,
  onReset,
}: {
  prefs: WidgetPreference[]
  onToggleVisible: (id: DashboardWidgetId) => void
  onMove: (id: DashboardWidgetId, direction: -1 | 1) => void
  onDensity: (id: DashboardWidgetId, density: WidgetDensity) => void
  onReset: () => void
}) {
  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-accent" />
          <h2 className="font-display text-[length:var(--text-sm)] text-text-heading">Dashboard Widgets</h2>
        </div>
        <button onClick={onReset} className="text-xs text-text-muted hover:text-text-heading cursor-pointer">Reset</button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {prefs.map((pref, index) => (
          <div key={pref.id} className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated p-2">
            <button
              onClick={() => onToggleVisible(pref.id)}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border cursor-pointer',
                pref.visible ? 'border-accent/25 bg-accent-muted text-accent' : 'border-border text-text-faint'
              )}
              title={pref.visible ? 'Hide widget' : 'Show widget'}
            >
              {pref.visible ? <PanelTopOpen className="h-4 w-4" /> : <PanelTopClose className="h-4 w-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text-heading">{WIDGET_LABELS[pref.id]}</div>
              <div className="text-[10px] font-data uppercase tracking-wider text-text-faint">{pref.density}</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDensity(pref.id, pref.density === 'compact' ? 'expanded' : 'compact')}
                className="rounded-md border border-border px-2 py-1 text-[10px] font-data uppercase tracking-wider text-text-muted hover:text-text-heading cursor-pointer"
              >
                {pref.density === 'compact' ? 'Full' : 'Compact'}
              </button>
              <button
                onClick={() => onMove(pref.id, -1)}
                disabled={index === 0}
                className="rounded-md p-1 text-text-muted hover:text-text-heading disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Move up"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => onMove(pref.id, 1)}
                disabled={index === prefs.length - 1}
                className="rounded-md p-1 text-text-muted hover:text-text-heading disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Move down"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Dashboard Page ───────────────────────────────────────── */

export function DashboardPage() {
  const { data, isLoading, error, isFetching } = useOperationalDashboardQuery()
  const { data: intelligenceData } = useIntelligenceDashboardQuery()
  const { data: dailyDashboard } = useDailyDashboard()
  const { data: liveQuotes } = useLiveQuotesQuery(60_000)
  const syncQuotes = useSyncLiveQuotesMutation()
  const queryClient = useQueryClient()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [widgetPrefs, setWidgetPrefs] = useState<WidgetPreference[]>(getInitialWidgetPrefs)

  useEffect(() => {
    mark('dashboard:mount')
    return () => mark('dashboard:unmount')
  }, [])

  useEffect(() => {
    localStorage.setItem(DASHBOARD_WIDGET_PREF_KEY, JSON.stringify(widgetPrefs))
  }, [widgetPrefs])

  useEffect(() => {
    if (!data) return
    mark('dashboard:data-visible')
    measure('dashboard:mount-to-data-visible', 'dashboard:mount', 'dashboard:data-visible')
  }, [data])

  const quoteMap = useMemo(() => {
    const map = new Map<string, import('@/types').LiveQuote>()
    if (liveQuotes?.quotes) {
      for (const q of liveQuotes.quotes) map.set(q.symbol, q)
    }
    return map
  }, [liveQuotes])

  const operationalData = data as OperationalDashboardPayload | undefined
  const openTrades = useMemo(() => operationalData?.open_trades ?? [], [operationalData?.open_trades])
  const equityCurve = useMemo(() => operationalData?.equity_curve ?? [], [operationalData?.equity_curve])
  const riskWarnings = useMemo(() => operationalData?.risk?.warnings ?? [], [operationalData?.risk?.warnings])
  const dashboardAlerts = useMemo(() => buildDashboardAlerts({
    warnings: riskWarnings,
    openTrades,
    liveQuotes,
    intelligence: intelligenceData,
  }), [riskWarnings, openTrades, liveQuotes, intelligenceData])
  const riskPayload = useMemo(() => {
    if (!operationalData?.risk) return null
    return {
      ...operationalData.risk,
      warnings: operationalData.risk.warnings ?? [],
      account_name: 'Primary account',
    } as RiskDashboardPayload
  }, [operationalData?.risk])

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operational'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'intelligence'] }),
      queryClient.invalidateQueries({ queryKey: ['market', 'live-quotes'] }),
      queryClient.invalidateQueries({ queryKey: ['daily-dashboard'] }),
    ])
  }, [queryClient])

  const toggleWidgetVisible = useCallback((id: DashboardWidgetId) => {
    setWidgetPrefs((prev) => prev.map((pref) => pref.id === id ? { ...pref, visible: !pref.visible } : pref))
  }, [])

  const setWidgetDensity = useCallback((id: DashboardWidgetId, density: WidgetDensity) => {
    setWidgetPrefs((prev) => prev.map((pref) => pref.id === id ? { ...pref, density } : pref))
  }, [])

  const moveWidget = useCallback((id: DashboardWidgetId, direction: -1 | 1) => {
    setWidgetPrefs((prev) => {
      const index = prev.findIndex((pref) => pref.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }, [])

  const resetWidgets = useCallback(() => {
    setWidgetPrefs(DEFAULT_WIDGET_PREFS)
  }, [])

  // ── First load — show skeletons only if truly no data ──
  if (isLoading && !data) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        <PageHeader title="Dashboard" right={<SyncBadge isSyncing={isFetching || syncQuotes.isPending} />} />
        <KpiSkeleton />
        <CardSkeleton height="h-40" />
        <RiskSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)]">
        <ErrorState
          title="Dashboard failed to load"
          message={(error as Error)?.message || 'Something went wrong loading your dashboard.'}
          onRetry={handleRefresh}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)]">
        <EmptyState title="No data" message="Your dashboard is empty. Add trades to see performance metrics." />
      </div>
    )
  }

  const dashboardData = operationalData as OperationalDashboardPayload

  const widgetContent: Record<DashboardWidgetId, React.ReactNode> = {
    alerts: <AlertZone alerts={dashboardAlerts} />,
    kpis: <KpiCards kpi={dashboardData.kpi} />,
    equity: <EquitySection capital={dashboardData.capital} equityCurve={equityCurve} />,
    live: <LiveDashboard trades={openTrades} quoteMap={quoteMap} />,
    workflow: <WorkflowCard dashboard={dailyDashboard} onOpenPerformanceOS={() => setActiveView('perf-os')} />,
    risk: riskPayload ? <RiskCommandCenter data={riskPayload} /> : <RiskSkeleton />,
    intelligence: <IntelligenceCards intelligence={intelligenceData} />,
    deep: (
      <div className="space-y-[var(--page-gap)]">
        <CollapsibleSection title="Lifecycle Intelligence" icon={Brain} summary={lifecycleSummary(intelligenceData)}>
          <Suspense fallback={<SectionSkeleton rows={6} />}>
            <LifecycleInsights />
          </Suspense>
        </CollapsibleSection>

        <CollapsibleSection title="Behavioral Intelligence" icon={Shield} summary={behavioralSummary(intelligenceData)}>
          <Suspense fallback={<SectionSkeleton rows={6} />}>
            <BehavioralIntelligence />
          </Suspense>
        </CollapsibleSection>

        <CollapsibleSection title="Playbook Intelligence" icon={BookOpen} summary={playbookSummary(intelligenceData)}>
          <Suspense fallback={<SectionSkeleton rows={6} />}>
            <PlaybookIntelligence />
          </Suspense>
        </CollapsibleSection>

        <CollapsibleSection title="Market Context" icon={BarChart3} summary={marketSummary(intelligenceData)}>
          <Suspense fallback={<SectionSkeleton rows={6} />}>
            <MarketContext />
          </Suspense>
        </CollapsibleSection>
      </div>
    ),
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
        {/* ── HEADER: Today + Sync ── */}
        <PageHeader
          title="Dashboard"
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCustomizeOpen((open) => !open)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-data transition-all cursor-pointer',
                  customizeOpen ? 'border-accent/30 bg-accent-muted text-accent' : 'border-border/60 text-text-muted hover:border-text-muted hover:text-text-heading'
                )}
              >
                {customizeOpen ? <X className="h-3 w-3" /> : <SlidersHorizontal className="h-3 w-3" />}
                Widgets
              </button>
              <SyncBadge isSyncing={isFetching || syncQuotes.isPending} onClick={() => syncQuotes.mutate()} />
              <LastUpdated />
            </div>
          }
        />

        {customizeOpen && (
          <WidgetControls
            prefs={widgetPrefs}
            onToggleVisible={toggleWidgetVisible}
            onMove={moveWidget}
            onDensity={setWidgetDensity}
            onReset={resetWidgets}
          />
        )}

        {widgetPrefs.map((pref) => (
          <WidgetShell key={pref.id} pref={pref}>
            {widgetContent[pref.id]}
          </WidgetShell>
        ))}
      </div>
    </PullToRefresh>
  )
}
