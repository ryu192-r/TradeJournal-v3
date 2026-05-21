import { useOperationalDashboardQuery } from '@/hooks/useOperationalDashboardQuery'
import { useIntelligenceDashboardQuery } from '@/hooks/useIntelligenceDashboardQuery'
import { useLiveQuotesQuery, useSyncLiveQuotesMutation } from '@/hooks/useMarketContextQuery'
import { RiskCommandCenter } from '@/components/risk/RiskCommandCenter'
import { LiveDashboard } from '@/components/dashboard/LiveDashboard'
import { formatCurrency, formatPercent } from '@/utils/format'
import {
  TrendingUp, Wallet, Activity, Target, Flame, AlertTriangle,
  Brain, Shield, BookOpen, BarChart3,
} from 'lucide-react'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { PageHeader, SyncBadge, LastUpdated, CollapsibleSection } from '@/components/ui/SharedUI'
import { EmptyState, ErrorState, SectionSkeleton, CardSkeleton, MetricSkeleton } from '@/components/ui/StateComponents'
import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react'
import { mark, measure } from '@/utils/performance'
import type { IntelligenceDashboardPayload, OperationalDashboardPayload } from '@/types'
import type { RiskDashboardPayload } from '@/types/riskDashboard'

const LifecycleInsights = lazy(() => import('@/components/lifecycle/LifecycleInsights').then(m => ({ default: m.LifecycleInsights })))
const BehavioralIntelligence = lazy(() => import('@/components/lifecycle/BehavioralIntelligence').then(m => ({ default: m.BehavioralIntelligence })))
const PlaybookIntelligence = lazy(() => import('@/components/lifecycle/PlaybookIntelligence').then(m => ({ default: m.PlaybookIntelligence })))
const MarketContext = lazy(() => import('@/components/market/MarketContext').then(m => ({ default: m.MarketContext })))

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

/* ── KPI Cards ────────────────────────────────────────────── */

function KpiCards({ kpi }: { kpi: OperationalDashboardPayload['kpi'] }) {
  const cards = useMemo(() => [
    { label: 'Net P&L', desc: 'Total realized profit/loss across all closed trades', value: kpi.net_pnl != null ? formatCurrency(Number(kpi.net_pnl)) : '—', sub: `${kpi.trade_count} trades`, icon: TrendingUp, color: Number(kpi.net_pnl) >= 0 ? 'profit' : 'loss' },
    { label: 'Win Rate', desc: 'Percentage of trades that closed in profit', value: kpi.win_rate != null ? `${kpi.win_rate.toFixed(1)}%` : '—', sub: `${kpi.trade_count} trades`, icon: Target, color: kpi.win_rate != null && kpi.win_rate >= 50 ? 'profit' : 'loss' },
    { label: 'Profit Factor', desc: 'Gross profit divided by gross loss. >1.5 is good, <1 is losing', value: kpi.profit_factor != null ? kpi.profit_factor.toFixed(2) : '—', sub: 'ratio', icon: Activity, color: kpi.profit_factor != null && kpi.profit_factor >= 1.5 ? 'profit' : kpi.profit_factor != null && kpi.profit_factor >= 1 ? 'text-heading' : 'loss' },
    { label: 'Avg R', desc: 'Average R-multiple per trade. Positive = edge exists', value: kpi.avg_r_multiple != null ? `${kpi.avg_r_multiple.toFixed(2)}R` : '—', sub: 'per trade', icon: Wallet, color: kpi.avg_r_multiple != null && kpi.avg_r_multiple >= 0 ? 'profit' : 'loss' },
    { label: 'Expectancy', desc: 'Average profit per trade. Positive edge over time', value: kpi.expectancy != null ? formatCurrency(kpi.expectancy) : '—', sub: 'per trade', icon: TrendingUp, color: kpi.expectancy != null && kpi.expectancy >= 0 ? 'profit' : 'loss' },
    { label: 'Max DD', desc: 'Largest peak-to-trough drawdown in account value', value: kpi.max_drawdown_pct != null ? formatCurrency(kpi.max_drawdown_pct) : '—', sub: 'drawdown', icon: Flame, color: 'loss' },
  ], [kpi])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[var(--page-gap)]">
      {cards.map((card) => {
        const Icon = card.icon
        const isLoss = card.color === 'loss'
        const isHeading = card.color === 'text-heading'
        const textClass = isLoss ? 'text-loss' : isHeading ? 'text-text-heading' : 'text-profit'
        return (
          <div
            key={card.label}
            className={`${CARD} group relative cursor-help`}
            title={card.desc}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLoss ? 'bg-loss-muted' : isHeading ? 'bg-border' : 'bg-profit-muted'}`}>
                <Icon className={`w-4 h-4 ${textClass}`} />
              </div>
              <span className="text-[10px] font-data uppercase tracking-wider text-text-muted" title={card.desc}>{card.label}</span>
            </div>
            <div className={`text-lg font-bold font-data ${textClass}`}>{card.value}</div>
            <div className="text-[10px] text-text-muted font-data mt-0.5">{card.sub}</div>
          </div>
        )
      })}
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

/* ── Streak Card ──────────────────────────────────────────── */

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

/* ── Alerts Card ──────────────────────────────────────────── */

function AlertsCard({ warnings }: { warnings: Array<{ severity: string; message: string; code: string }> }) {
  const visible = warnings.filter(w => w.severity !== 'info').slice(0, 5)
  if (visible.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="All Clear"
        message="No active alerts. Portfolio is within limits."
        compact
      />
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
          <div
            key={i}
            className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${
              w.severity === 'high' ? 'bg-loss-muted/20' : w.severity === 'medium' ? 'bg-gold-faint' : 'bg-accent-muted/20'
            }`}
          >
            <span className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
              w.severity === 'high' ? 'bg-loss' : w.severity === 'medium' ? 'bg-gold' : 'bg-accent'
            }`} />
            <span className={w.severity === 'high' ? 'text-loss' : w.severity === 'medium' ? 'text-gold' : 'text-text-heading'}>
              {w.message}
            </span>
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

/* ── Dashboard Page ───────────────────────────────────────── */

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
      ...operationalData.risk,
      account_name: 'Primary account',
    } as RiskDashboardPayload
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

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
        {/* ── HEADER: Today + Sync ── */}
        <PageHeader
          title="Dashboard"
          right={
            <div className="flex items-center gap-2">
              <SyncBadge isSyncing={isFetching || syncQuotes.isPending} onClick={() => syncQuotes.mutate()} />
              <LastUpdated />
            </div>
          }
        />

        {/* ── KPI ROW ── */}
        <KpiCards kpi={dashboardData.kpi} />

        {/* ── CRITICAL ALERTS ── */}
        {(dashboardData.risk?.warnings ?? []).filter(w => w.severity === 'high').length > 0 && (
          <div className={CARD + ' border-loss/30 bg-loss-muted/10'}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-loss" />
              <span className="text-sm font-medium text-loss">Critical Alert</span>
            </div>
            <div className="space-y-1">
              {dashboardData.risk.warnings
                .filter(w => w.severity === 'high')
                .slice(0, 2)
                .map((w, i) => (
                  <div key={i} className="text-sm text-loss">{w.message}</div>
                ))}
            </div>
          </div>
        )}

        {/* ── LIVE POSITIONS ── */}
        <LiveDashboard trades={dashboardData.open_trades} quoteMap={quoteMap} />

        {/* ── RISK COMMAND CENTER ── */}
        {riskPayload ? (
          <RiskCommandCenter data={riskPayload} />
        ) : (
          <RiskSkeleton />
        )}

        {/* ── STREAKS + ALERTS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StreakCard data={dashboardData.streaks} />
          <AlertsCard warnings={dashboardData.risk?.warnings ?? []} />
        </div>

        {/* ── COLLAPSIBLE INTELLIGENCE (OFF BY DEFAULT) ── */}
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
      </div>
    </PullToRefresh>
  )
}
