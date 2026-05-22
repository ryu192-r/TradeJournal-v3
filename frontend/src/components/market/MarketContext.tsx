import { useMarketRegimeQuery, useMarketCorrelationQuery, useFetchMarketDataMutation, useLiveQuotesQuery, useUpsertLiveQuotesMutation } from '@/hooks/useMarketContextQuery'
import { formatCurrency, formatPrice, parseDecimal } from '@/utils/format'
import {
  Globe, TrendingUp, TrendingDown, Minus, RefreshCw, Loader2,
  ArrowUpRight, ArrowDownRight, ChevronRight, Building2, BarChart3,
  Eye,
} from 'lucide-react'
import { EmptyState, SectionTitle, CardSkeleton, SectionHeader } from '@/components/ui'
import type { MarketRegimeSummary, MarketPerformanceCorrelation, LiveQuote } from '@/types'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

function TrendIcon({ trend }: { trend: string | null }) {
  if (trend === 'uptrend') return <TrendingUp className="w-4 h-4 text-profit" />
  if (trend === 'downtrend') return <TrendingDown className="w-4 h-4 text-loss" />
  return <Minus className="w-4 h-4 text-text-muted" />
}

function RegimeBadge({ regime }: { regime: string | null }) {
  if (!regime) return <span className="text-[length:var(--text-xs)] text-text-muted">—</span>
  const styles: Record<string, string> = {
    bullish: 'bg-profit-muted text-profit',
    bearish: 'bg-loss-muted text-loss',
    volatile: 'bg-amber-500/15 text-amber-400',
    neutral: 'bg-border text-text-muted',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-data ${styles[regime] || styles.neutral}`}>
      {regime.charAt(0).toUpperCase() + regime.slice(1)}
    </span>
  )
}

function quoteStatusLabel(status?: LiveQuote['status']) {
  if (status === 'fresh') return 'Fresh'
  if (status === 'stale') return 'Stale'
  if (status === 'failed') return 'Failed'
  return 'Not Synced'
}

function quoteStatusClass(status?: LiveQuote['status']) {
  if (status === 'fresh') return 'text-profit'
  if (status === 'stale') return 'text-amber-400'
  if (status === 'failed') return 'text-loss'
  return 'text-text-faint'
}

function CurrentRegimeCard({ data }: { data: MarketRegimeSummary }) {
  const cur = data.current
  if (!cur) return null

  const change = parseDecimal(cur.nifty_change_pct, 0)
  const isUp = change >= 0

  return (
    <div className={CARD}>
      <SectionHeader icon={Globe} title="Market Regime" badge={<RegimeBadge regime={cur.nifty_regime} />} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1">NIFTY 50</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold font-data text-text-heading">
              {cur.nifty_close ? `₹${Number(cur.nifty_close).toLocaleString('en-IN')}` : '—'}
            </span>
            {cur.nifty_change_pct && (
              <span className={`text-xs font-data flex items-center gap-0.5 ${isUp ? 'text-profit' : 'text-loss'}`}>
                {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1">Trend</div>
          <div className="flex items-center gap-1.5">
            <TrendIcon trend={cur.nifty_trend} />
            <span className="text-sm font-data text-text-heading capitalize">{cur.nifty_trend || '—'}</span>
          </div>
        </div>
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1">India VIX</div>
          <span className="text-sm font-bold font-data text-text-heading">{cur.india_vix ?? '—'}</span>
        </div>
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1">Breadth A/D</div>
          <span className="text-sm font-data text-text-heading">
            {cur.advance_count ?? '—'}/{cur.decline_count ?? '—'}
          </span>
        </div>
      </div>
      {data.total_days > 0 && (
        <div className="mt-[var(--page-gap)] pt-[var(--page-gap)] border-t border-border flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-text-muted">Regime (90d):</span>
          {Object.entries(data.regime_distribution).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <span key={k} className="text-[10px] font-data text-text-muted">
              {k}: <span className="text-text-heading">{v}d</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SectorStrengthCard({ data }: { data: MarketRegimeSummary }) {
  const cur = data.current
  if (!cur?.sector_strength) return null

  const sectors = Object.entries(cur.sector_strength)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([name, info]) => ({
      name,
      change: (info as any).change_pct ?? (info as any).pPerchange1d,
    }))
    .filter(s => s.change != null)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))

  if (sectors.length === 0) return null

  return (
    <div className={CARD}>
      <SectionHeader icon={Building2} title="Sector Strength" />
      <div className="space-y-1.5">
        {sectors.slice(0, 8).map((s) => {
          const ch = s.change ?? 0
          const isPos = ch >= 0
          return (
            <div key={s.name} className="flex items-center justify-between">
              <span className="text-[length:var(--text-xs)] text-text-muted truncate max-w-[140px]">{s.name}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isPos ? 'bg-profit' : 'bg-loss'}`}
                    style={{ width: `${Math.min(Math.abs(ch) * 10, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-data w-12 text-right ${isPos ? 'text-profit' : 'text-loss'}`}>
                  {ch >= 0 ? '+' : ''}{ch.toFixed(2)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LiveWatchlistCard() {
  const { data, isLoading } = useLiveQuotesQuery(60_000)

  if (isLoading) return <CardSkeleton height="h-40" />
  if (!data || data.quotes.length === 0) return <EmptyState icon={Eye} title="No watchlist" message="Open positions will appear here." compact />

  return (
    <div className={CARD}>
      <SectionHeader icon={Eye} title="My Stocks" badge={<span className="text-[10px] text-text-muted font-data">{data.total} live</span>} />
      <div className="space-y-1">
        {data.quotes.map((q: LiveQuote) => {
          const ltp = q.ltp ? parseFloat(q.ltp) : null
          const chg = q.change_pct ? parseFloat(q.change_pct) : null
          const isUp = (chg ?? 0) >= 0
          const status = q.status ?? 'not_synced'
          return (
            <div key={q.symbol} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
              <div className="min-w-0">
                <div className="text-xs font-medium font-display text-text-heading truncate">{q.symbol}</div>
                <div className="flex items-center gap-1.5">
                  {q.sector && <span className="text-[10px] text-text-muted truncate">{q.sector}</span>}
                  <span className={`text-[10px] font-data ${quoteStatusClass(status)}`}>{quoteStatusLabel(status)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs font-data text-text-heading">
                  {ltp != null ? formatPrice(ltp) : '—'}
                </span>
                {chg != null && (
                  <span className={`text-[11px] font-data w-16 text-right ${isUp ? 'text-profit' : 'text-loss'}`}>
                    {isUp ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                    {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CorrelationCard({ data }: { data: MarketPerformanceCorrelation }) {
  if (data.total_matched_trades === 0) return null

  const bucketRows: { label: string; data: Record<string, { trade_count: number; win_rate: number | null; avg_pnl: number | null }> }[] = [
    { label: 'By Trend', data: data.by_trend },
    { label: 'By Regime', data: data.by_regime },
    { label: 'By VIX', data: data.by_vix_bucket },
  ]

  return (
    <div className={CARD}>
      <SectionHeader icon={BarChart3} title="Performance vs Market" badge={<span className="text-[10px] text-text-muted font-data">{data.total_matched_trades} trades</span>} />
      <div className="space-y-[var(--page-gap)]">
        {bucketRows.map(({ label, data: buckets }) => {
          const entries = Object.entries(buckets)
          if (entries.length === 0) return null
          return (
            <div key={label}>
              <div className="text-[length:var(--text-xs)] text-text-muted mb-2 font-display">{label}</div>
              <div className="space-y-1">
                {entries.map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted capitalize">{key}</span>
                    <div className="flex items-center gap-3 font-data">
                      <span className="text-text-muted">{val.trade_count}t</span>
                      {val.win_rate != null && (
                        <span className={val.win_rate >= 50 ? 'text-profit' : 'text-loss'}>
                          {val.win_rate.toFixed(0)}%
                        </span>
                      )}
                      {val.avg_pnl != null && (
                        <span className={val.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}>
                          {formatCurrency(val.avg_pnl)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {data.insights.length > 0 && (
        <div className="mt-[var(--page-gap)] pt-[var(--page-gap)] border-t border-border space-y-1.5">
          {data.insights.map((ins, i) => (
            <div key={i} className={`text-xs font-data ${ins.type === 'warning' ? 'text-amber-400' : 'text-text-muted'}`}>
              <ChevronRight className="w-3 h-3 inline mr-1" />
              {ins.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SyncButton() {
  const { mutate: fetchMarketMutate, isPending: isFetchingMarket } = useFetchMarketDataMutation()
  const { isPending: isUpsertingQuotes } = useUpsertLiveQuotesMutation()

  const isPending = isFetchingMarket || isUpsertingQuotes

  const handleSync = () => {
    const today = new Date().toISOString().slice(0, 10)
    fetchMarketMutate({
      date: today,
      pulse: {},
      heatmap: [],
      fii_dii: {},
    })
  }

  return (
    <button
      onClick={handleSync}
      disabled={isPending}
      className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      Sync
    </button>
  )
}

export function MarketContext() {
  const { data: regimeData, isLoading: regimeLoading } = useMarketRegimeQuery(90)
  const { data: correlationData, isLoading: corrLoading } = useMarketCorrelationQuery()

  if (regimeLoading) {
    return (
      <div className="space-y-[var(--page-gap)]">
        <SectionTitle icon={Globe} title="Market Context" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton height="h-40" />
          <CardSkeleton height="h-40" />
          <CardSkeleton height="h-40" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-[var(--page-gap)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-[15px] h-[15px] text-accent" />
          <h2 className="font-display text-[length:var(--text-sm)] text-text-heading">Market Context</h2>
          {regimeData?.current && (
            <span className="text-[10px] text-text-muted font-data">{regimeData.current.date}</span>
          )}
        </div>
        <SyncButton />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regimeData?.current && <CurrentRegimeCard data={regimeData} />}
        {regimeData?.current?.sector_strength && Object.keys(regimeData.current.sector_strength).length > 0 && (
          <SectorStrengthCard data={regimeData} />
        )}
        <LiveWatchlistCard />
      </div>
      {!corrLoading && correlationData && correlationData.total_matched_trades > 0 && (
        <CorrelationCard data={correlationData} />
      )}
    </div>
  )
}
