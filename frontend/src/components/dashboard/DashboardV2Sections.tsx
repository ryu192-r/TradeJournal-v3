import { useMemo } from 'react'
import { ArrowRight, Briefcase, Flame, Target, TrendingUp } from 'lucide-react'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { useEdgeCommandCenterQuery } from '@/hooks/useEdgeCommandCenterQuery'
import { useAppStore } from '@/store/appStore'
import { formatCurrency, parseDecimal } from '@/utils/format'
import { KpiCard } from '@/components/ui/SharedUI'
import { CARD_COMPACT } from '@/components/layout/layoutTokens'
import { cn } from '@/lib/utils'
import type { AnalyticsKpi, OperationalDashboardPayload, OperationalOpenTrade } from '@/types'
import type { LiveQuote } from '@/types'

export function CompactKpiRow({ kpi }: { kpi: AnalyticsKpi }) {
  const cards = useMemo(
    () => [
      {
        label: 'Net P&L',
        value: kpi.net_pnl != null ? formatCurrency(Number(kpi.net_pnl)) : '—',
        sub: `${kpi.trade_count} closed`,
        icon: TrendingUp,
        color: Number(kpi.net_pnl) >= 0 ? 'profit' : 'loss',
      },
      {
        label: 'Win Rate',
        value: kpi.win_rate != null ? `${kpi.win_rate.toFixed(1)}%` : '—',
        sub: 'closed trades',
        icon: Target,
        color: kpi.win_rate != null && kpi.win_rate >= 50 ? 'profit' : 'loss',
      },
      {
        label: 'Avg R',
        value: kpi.avg_r_multiple != null ? `${kpi.avg_r_multiple.toFixed(2)}R` : '—',
        sub: 'risk-adjusted',
        icon: Flame,
        color: kpi.avg_r_multiple != null && kpi.avg_r_multiple >= 0 ? 'profit' : 'loss',
      },
      {
        label: 'Profit Factor',
        value:
          kpi.profit_factor != null
            ? Number(kpi.profit_factor).toFixed(2)
            : Number(kpi.gross_profit) > 0 && Number(kpi.gross_loss) === 0
              ? '∞'
              : '—',
        sub: 'gross win / loss',
        icon: Briefcase,
        color:
          kpi.profit_factor != null
            ? Number(kpi.profit_factor) >= 1
              ? 'profit'
              : 'loss'
            : 'neutral',
      },
    ],
    [kpi]
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          label={card.label}
          value={card.value}
          sub={card.sub}
          icon={card.icon}
          color={card.color as 'profit' | 'loss' | 'neutral'}
          desc=""
        />
      ))}
    </div>
  )
}

export function QuickPerformanceOverview({
  streaks,
  capital,
}: {
  streaks: OperationalDashboardPayload['streaks']
  capital: OperationalDashboardPayload['capital']
}) {
  const netEquity = parseDecimal(capital?.net_equity ?? '0', 0)
  const unrealized = parseDecimal(capital?.unrealized_pnl ?? '0', 0)

  return (
    <div className={cn(CARD_COMPACT, 'grid grid-cols-2 sm:grid-cols-4 gap-3')}>
      <div>
        <div className="text-[10px] font-data uppercase tracking-wider text-text-faint">Equity</div>
        <div className="text-lg font-data font-semibold text-text-heading mt-0.5">{formatCurrency(netEquity)}</div>
      </div>
      <div>
        <div className="text-[10px] font-data uppercase tracking-wider text-text-faint">Unrealized</div>
        <div
          className={cn(
            'text-lg font-data font-semibold mt-0.5',
            unrealized >= 0 ? 'text-profit' : 'text-loss'
          )}
        >
          {unrealized >= 0 ? '+' : ''}
          {formatCurrency(unrealized)}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-data uppercase tracking-wider text-text-faint">Win streak</div>
        <div className="text-lg font-data font-semibold text-text-heading mt-0.5">{streaks.current_type === 'win' ? streaks.current_count : 0}</div>
      </div>
      <div>
        <div className="text-[10px] font-data uppercase tracking-wider text-text-faint">Loss streak</div>
        <div className="text-lg font-data font-semibold text-text-heading mt-0.5">{streaks.current_type === 'loss' ? streaks.current_count : 0}</div>
      </div>
    </div>
  )
}

export function RecentTradesCard() {
  const { data, isLoading } = useTradesQuery({ limit: 12 })
  const openDetailTrade = useAppStore((s) => s.openDetailTrade)
  const setActiveView = useAppStore((s) => s.setActiveView)

  const recent = useMemo(() => {
    const items = data?.items ?? []
    return [...items]
      .filter((t) => t.exit_price != null)
      .sort((a, b) => {
        const ta = new Date(a.exit_time ?? a.entry_time ?? 0).getTime()
        const tb = new Date(b.exit_time ?? b.entry_time ?? 0).getTime()
        return tb - ta
      })
      .slice(0, 6)
  }, [data?.items])

  return (
    <div className={CARD_COMPACT}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-heading font-display">Recent trades</h3>
        <button
          type="button"
          onClick={() => setActiveView('trades')}
          className="text-[length:var(--text-xs)] text-accent hover:underline cursor-pointer"
        >
          All trades →
        </button>
      </div>
      {isLoading && !data ? (
        <div className="h-24 rounded-lg bg-border/30 animate-pulse" />
      ) : recent.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-text-muted">No closed trades yet.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {recent.map((trade) => {
            const pnl = trade.pnl != null ? Number(trade.pnl) : null
            return (
              <li key={trade.id}>
                <button
                  type="button"
                  onClick={() => openDetailTrade(trade.id)}
                  className="w-full flex items-center justify-between gap-2 py-2 text-left hover:bg-accent-faint/50 rounded-lg px-1 -mx-1 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-heading truncate">{trade.symbol}</div>
                    <div className="text-[10px] text-text-faint truncate">{trade.setup ?? '—'}</div>
                  </div>
                  <div
                    className={cn(
                      'text-sm font-data font-medium shrink-0',
                      pnl == null ? 'text-text-muted' : pnl >= 0 ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {pnl != null ? `${pnl >= 0 ? '+' : ''}${formatCurrency(Math.abs(pnl))}` : '—'}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function OpenActionsPreview() {
  const { data } = useEdgeCommandCenterQuery()
  const setActiveView = useAppStore((s) => s.setActiveView)

  const items = useMemo(() => {
    if (!data) return []
    const out: string[] = []
    if (data.review_queue.length > 0) {
      out.push(`${data.review_queue.length} trade${data.review_queue.length === 1 ? '' : 's'} need review`)
    }
    if (data.workflow && !data.workflow.is_complete) {
      out.push(data.workflow.next_step)
    }
    if (data.summary.risk_warnings[0]) out.push(data.summary.risk_warnings[0])
    if (data.next_best_action && out.length < 3) out.push(data.next_best_action)
    return out.slice(0, 3)
  }, [data])

  if (items.length === 0) {
    return (
      <div className={cn(CARD_COMPACT, 'flex items-center gap-2 text-[length:var(--text-xs)] text-text-muted')}>
        <Target className="w-4 h-4 text-profit shrink-0" />
        All caught up — open the actions bell for details.
      </div>
    )
  }

  return (
    <div className={CARD_COMPACT}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-heading font-display">Open actions</h3>
        <button
          type="button"
          onClick={() => setActiveView('review')}
          className="inline-flex items-center gap-0.5 text-[length:var(--text-xs)] text-accent cursor-pointer"
        >
          Review queue <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <ul className="space-y-1.5">
        {items.map((line, i) => (
          <li key={i} className="text-[length:var(--text-xs)] text-text-muted flex gap-2">
            <span className="text-accent shrink-0">•</span>
            <span className="line-clamp-2">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CompactOpenPositions({
  trades,
  quoteMap,
}: {
  trades: OperationalOpenTrade[]
  quoteMap: Map<string, LiveQuote>
}) {
  const openDetailTrade = useAppStore((s) => s.openDetailTrade)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const slice = trades.slice(0, 4)

  if (slice.length === 0) {
    return (
      <div className={CARD_COMPACT}>
        <p className="text-[length:var(--text-xs)] text-text-muted">No open positions.</p>
      </div>
    )
  }

  return (
    <div className={CARD_COMPACT}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-heading font-display">Open positions</h3>
        <button
          type="button"
          onClick={() => setActiveView('trades')}
          className="text-[length:var(--text-xs)] text-accent hover:underline cursor-pointer"
        >
          Manage →
        </button>
      </div>
      <ul className="space-y-2">
        {slice.map((t) => {
          const quote = quoteMap.get(t.symbol)
          const ltp = quote?.ltp != null ? Number(quote.ltp) : null
          const entry = Number(t.entry_price)
          const qty = Number(t.quantity)
          const livePnl = ltp != null ? (ltp - entry) * qty : null
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openDetailTrade(t.id)}
                className="w-full flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-2 hover:border-accent/25 cursor-pointer"
              >
                <span className="text-sm font-medium text-text-heading">{t.symbol}</span>
                <span
                  className={cn(
                    'text-xs font-data',
                    livePnl == null ? 'text-text-muted' : livePnl >= 0 ? 'text-profit' : 'text-loss'
                  )}
                >
                  {livePnl != null ? `${livePnl >= 0 ? '+' : ''}${formatCurrency(Math.abs(livePnl))}` : '—'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {trades.length > 4 && (
        <p className="text-[10px] text-text-faint mt-2">+{trades.length - 4} more open</p>
      )}
    </div>
  )
}
