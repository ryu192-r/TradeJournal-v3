import { useOperationalDashboardQuery } from '@/hooks/useOperationalDashboardQuery'
import { useIntelligenceDashboardQuery } from '@/hooks/useIntelligenceDashboardQuery'
import { useLiveQuotesQuery, useSyncLiveQuotesMutation } from '@/hooks/useMarketContextQuery'
import { RiskCommandCenter } from '@/components/risk/RiskCommandCenter'
import { LiveDashboard } from '@/components/dashboard/LiveDashboard'
import { formatCurrency, formatPercent, formatDate } from '@/utils/format'
import {
  TrendingUp, Wallet, Activity, Target, Flame, AlertTriangle, RefreshCw,
  ChevronDown, ChevronRight, Brain, Shield, BookOpen, BarChart3, Loader2,
} from 'lucide-react'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { mark, measure } from '@/utils/performance'
import type { IntelligenceDashboardPayload, OperationalDashboardPayload } from '@/types'

const LifecycleInsights = lazy(() => import('@/components/lifecycle/LifecycleInsights').then(m => ({ default: m.LifecycleInsights })))
const BehavioralIntelligence = lazy(() => import('@/components/lifecycle/BehavioralIntelligence').then(m => ({ default: m.BehavioralIntelligence })))
const PlaybookIntelligence = lazy(() => import('@/components/lifecycle/PlaybookIntelligence').then(m => ({ default: m.PlaybookIntelligence })))
const MarketContext = lazy(() => import('@/components/market/MarketContext').then(m => ({ default: m.MarketContext })))

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

function SyncIndicator() {
  return (
    <span className="flex items-center gap-1 text-[10px] text-text-muted font-data animate-pulse">
      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
      Syncing
    </span>
  )
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  summary,
  children,
}: {
  title: string
  icon: React.ElementType
  defaultOpen?: boolean
  summary?: React.ReactNode
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className={CARD}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-accent shrink-0" />
          <h2 className="font-display text-[length:var(--text-sm)] text-text-heading">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && (
            <span className="text-[10px] text-text-muted font-data">Expanded</span>
          )}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-heading transition-colors" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-heading transition-colors" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="mt-[var(--page-gap)] pt-[var(--page-gap)] border-t border-border">
          {children}
        </div>
      )}
      {!isOpen && summary && (
        <div className="mt-3">
          {summary}
        </div>
      )}
    </div>
  )
}

function KpiCards({ kpi }: { kpi: OperationalDashboardPayload['kpi'] }) {
  const cards = useMemo(() => [
    { label: 'Net P&L', value: kpi.net_pnl != null ? formatCurrency(Number(kpi.net_pnl)) : 'N/A', sub: `${kpi.trade_count} trades`, icon: TrendingUp, color: Number(kpi.net_pnl) >= 0 ? 'profit' : 'loss', bg: Number(kpi.net_pnl) >= 0 ? 'bg-profit-muted' : 'bg-loss-muted' },
    { label: 'Win Rate', value: kpi.win_rate != null ? formatPercent(kpi.win_rate) : 'N/A', sub: `${kpi.trade_count} trades`, icon: Target, color: kpi.win_rate != null && kpi.win_rate >= 50 ? 'profit' : 'loss', bg: kpi.win_rate != null && kpi.win_rate >= 50 ? 'bg-profit-muted' : 'bg-loss-muted' },
    { label: 'Profit Factor', value: kpi.profit_factor != null ? kpi.profit_factor.toFixed(2) : 'N/A', sub: 'ratio', icon: Activity, color: kpi.profit_factor != null && kpi.profit_factor >= 1.5 ? 'profit' : kpi.profit_factor != null && kpi.profit_factor >= 1 ? 'text-accent' : 'loss' },
    { label: 'Avg R', value: kpi.avg_r_multiple != null ? kpi.avg_r_multiple.toFixed(2) + 'R' : 'N/A', sub: 'per trade', icon: Wallet, color: kpi.avg_r_multiple != null && kpi.avg_r_multiple >= 0 ? 'profit' : 'loss' },
    { label: 'Expectancy', value: kpi.expectancy != null ? formatCurrency(kpi.expectancy) : 'N/A', sub: 'per trade', icon: TrendingUp, color: kpi.expectancy != null && kpi.expectancy >= 0 ? 'profit' : 'loss' },
    { label: 'Max DD', value: kpi.max_drawdown_pct != null ? formatPercent(-kpi.max_drawdown_pct) : 'N/A', sub: 'drawdown', icon: Flame, color: 'text-loss' },
  ], [kpi])
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[var(--page-gap)]">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className={`${CARD}`}>
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

function StreakCard({ data }: { data: OperationalDashboardPayload['streaks'] }) {
  const { current_type, current_count, longest_win, longest_loss } = data || {}
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-[15px] h-[15px] text-accent" />
        <h3 className="font-display text-[length:var(--text-sm)] text-text-heading">Streaks</h3>
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-xs text-text-muted mb-1">Current</div>
          <div className={`font-data text-lg font-bold ${current_type === 'win' ? 'text-profit' : current_type === 'loss' ? 'text-loss' : 'text-text-muted'}`}>
            {current_type ? `${current_count} ${current_type}` : '—'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <div className="text-xs text-text-muted mb-1">Best</div>
            <div className="font-data text-base font-bold text-profit">{longest_win || 0}W</div>
          </div>
          <div>
            <div className="text-xs text-text-muted mb-1">Worst</div>
            <div className="font-data text-base font-bold text-loss">{longest_loss || 0}L</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertsCard({ warnings }: { warnings: Array<{ severity: string; message: string; code: string }> }) {
  const visible = warnings.filter(w => w.severity !== 'info').slice(0, 5)
  if (visible.length === 0) {
    return (
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-emerald-400" />
          <h3 className="font-display text-[length:var(--text-sm)] text-text-heading">Alerts</h3>
        </div>
        <div className="text-sm text-text-muted">No active alerts. Portfolio is within limits.</div>
      </div>
    )
  }
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="font-display text-[length:var(--text-sm)] text-text-heading">Alerts ({visible.length})</h3>
      </div>
      <div className="space-y-2">
        {visible.map((w, i) => (
          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${w.severity === 'high' ? 'bg-loss-muted/20' : w.severity === 'medium' ? 'bg-amber-400/10' : 'bg-accent-muted/20'}`}>
            <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${w.severity === 'high' ? 'bg-loss' : w.severity === 'medium' ? 'bg-amber-400' : 'bg-accent'}`} />
            <span className={`${w.severity === 'high' ? 'text-loss' : w.severity === 'medium' ? 'text-amber-400' : 'text-text-heading'}`}>{w.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

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

function playbookSummary(intelligence?: IntelligenceDashboardPayload) {
  const setups = intelligence?.playbook.setups ?? []
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

export function DashboardPage() {
  const { data, isLoading, error, isFetching } = useOperationalDashboardQuery()
  const { data: intelligenceData } = useIntelligenceDashboardQuery()
  const { data: liveQuotes } = useLiveQuotesQuery(60_000)
  const syncQuotes = useSyncLiveQuotesMutation()
  const queryClient = useQueryClient()

  useEffect(() => {
    mark('dashboard:mount')
    return () => mark('dashboard:unmount')
  }, [])

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
  const riskPayload = useMemo(() => {
    if (!operationalData?.risk) return null
    return {
      net_equity: operationalData.risk.net_equity,
      open_positions: operationalData.risk.open_positions,
      deployed_capital: operationalData.risk.deployed_capital,
      available_capital: operationalData.risk.available_capital,
      open_risk: operationalData.risk.open_risk,
      portfolio_heat_pct: operationalData.risk.portfolio_heat_pct ?? null,
      deployed_capital_pct: operationalData.risk.deployed_capital_pct ?? null,
      positions_without_stop: operationalData.risk.positions_without_stop,
      largest_position: null,
      largest_risk_position: null,
      risk_by_setup: [],
      risk_by_symbol: [],
      warnings: operationalData.risk.warnings,
    }
  }, [operationalData?.risk])

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operational'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'intelligence'] }),
      queryClient.invalidateQueries({ queryKey: ['market', 'live-quotes'] }),
    ])
  }, [queryClient])

  // ── First load — show skeletons only if truly no data ──
  if (isLoading && !data) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Dashboard</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[var(--page-gap)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${CARD} h-24 animate-pulse`} />
          ))}
        </div>
        <div className={`${CARD} h-40 animate-pulse`} />
        <RiskCommandCenterSkeleton />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)]">
        <div className={`${CARD} py-12 text-center`}>
          <AlertTriangle className="w-8 h-8 text-loss mx-auto mb-3" />
          <h2 className="text-lg font-medium text-text-heading font-display mb-2">Failed to load</h2>
          <p className="text-text-muted text-sm">{(error as Error)?.message || 'Something went wrong.'}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />Retry
          </button>
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

  const dashboardData = operationalData as OperationalDashboardPayload

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        {/* ── TODAY ── */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Dashboard</h1>
          <div className="flex items-center gap-3">
            {isFetching && <SyncIndicator />}
            <button
              onClick={() => syncQuotes.mutate()}
              disabled={syncQuotes.isPending}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer disabled:opacity-50"
              title="Sync live prices"
            >
              {syncQuotes.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync
            </button>
            <div className="text-sm text-text-muted font-data">{formatDate(new Date())}</div>
          </div>
        </div>

        <KpiCards kpi={dashboardData.kpi} />

        {/* ── OPEN POSITIONS ── */}
        <LiveDashboard trades={dashboardData.open_trades} quoteMap={quoteMap} />

        {/* ── RISK ── */}
        {isLoading && !riskPayload ? (
          <RiskCommandCenterSkeleton />
        ) : riskPayload ? (
          <RiskCommandCenter data={riskPayload as any} />
        ) : null}

        {/* ── STREAKS + ALERTS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StreakCard data={dashboardData.streaks} />
          <AlertsCard warnings={dashboardData.risk?.warnings ?? []} />
        </div>

        {/* ── COLLAPSIBLE INTELLIGENCE (OFF BY DEFAULT) ── */}
        <div className="space-y-[var(--page-gap)]">
          <CollapsibleSection title="Lifecycle Intelligence" icon={Brain} summary={lifecycleSummary(intelligenceData)}>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-text-muted animate-pulse">Loading…</div>}>
              <LifecycleInsights />
            </Suspense>
          </CollapsibleSection>

          <CollapsibleSection title="Behavioral Intelligence" icon={Shield} summary={behavioralSummary(intelligenceData)}>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-text-muted animate-pulse">Loading…</div>}>
              <BehavioralIntelligence />
            </Suspense>
          </CollapsibleSection>

          <CollapsibleSection title="Playbook Intelligence" icon={BookOpen} summary={playbookSummary(intelligenceData)}>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-text-muted animate-pulse">Loading…</div>}>
              <PlaybookIntelligence />
            </Suspense>
          </CollapsibleSection>

          <CollapsibleSection title="Market Context" icon={BarChart3} summary={marketSummary(intelligenceData)}>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-text-muted animate-pulse">Loading…</div>}>
              <MarketContext />
            </Suspense>
          </CollapsibleSection>
        </div>
      </div>
    </PullToRefresh>
  )
}
