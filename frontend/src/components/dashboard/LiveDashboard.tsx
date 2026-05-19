import { useMarketRegimeQuery } from '@/hooks/useMarketContextQuery'
import { formatCurrency, formatPrice } from '@/utils/format'
import {
  ArrowUpRight, ArrowDownRight, Briefcase,
  Activity, Globe, BarChart3, Wallet,
} from 'lucide-react'
import type { LiveQuote, ApiTrade } from '@/types'

const CARD = 'bg-card rounded-2xl border border-border p-5 animate-card-in'

interface OpenPositionLive {
  trade: ApiTrade
  quote: LiveQuote | undefined
  ltp: number | null
  changePct: number | null
  livePnl: number
  livePnlPct: number
  investedValue: number
  marketValue: number
}

function computeLivePositions(trades: ApiTrade[], quoteMap: Map<string, LiveQuote>): OpenPositionLive[] {
  return trades
    .filter(t => !t.exit_price)
    .map(t => {
      const quote = quoteMap.get(t.symbol)
      const ltp = quote?.ltp ? parseFloat(quote.ltp) : null
      const changePct = quote?.change_pct ? parseFloat(quote.change_pct) : null
      const entry = parseFloat(t.entry_price)
      const fullQty = parseFloat(t.quantity)
      const remainingQty = t.remaining_qty ? parseFloat(t.remaining_qty) : fullQty
      const fees = parseFloat(t.fees)
      const feeRatio = fullQty > 0 ? remainingQty / fullQty : 1
      const investedValue = entry * remainingQty
      const marketValue = ltp != null ? ltp * remainingQty : investedValue
      const livePnl = ltp != null ? (ltp - entry) * remainingQty - fees * feeRatio : 0
      const livePnlPct = investedValue > 0 ? (livePnl / investedValue) * 100 : 0
      return { trade: t, quote, ltp, changePct, livePnl, livePnlPct, investedValue, marketValue }
    })
}

function LivePortfolioCard({ positions }: { positions: OpenPositionLive[] }) {
  const totalInvested = positions.reduce((s, p) => s + p.investedValue, 0)
  const totalMarketValue = positions.reduce((s, p) => s + p.marketValue, 0)
  const totalLivePnl = positions.reduce((s, p) => s + p.livePnl, 0)
  const totalLivePnlPct = totalInvested > 0 ? (totalLivePnl / totalInvested) * 100 : 0
  const hasLive = positions.some(p => p.ltp != null)
  const isProfit = totalLivePnl >= 0

  if (positions.length === 0) return null

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-4 h-4 text-accent" />
        <h3 className="font-display text-sm text-text-heading">Live Portfolio</h3>
        {hasLive && <span className="ml-auto flex items-center gap-1 text-[10px] text-profit font-data"><span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />LIVE</span>}
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-xs text-text-muted mb-1">Unrealized P&L</div>
          <div className={`text-2xl font-bold font-data ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {hasLive ? `${isProfit ? '+' : ''}${formatCurrency(totalLivePnl)}` : '—'}
          </div>
          {hasLive && (
            <span className={`text-xs font-data ${isProfit ? 'text-profit' : 'text-loss'}`}>
              {isProfit ? '+' : ''}{totalLivePnlPct.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
          <div>
            <div className="text-[10px] text-text-muted mb-1">Invested</div>
            <div className="text-sm font-data text-text-heading">{formatCurrency(totalInvested)}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted mb-1">Market Value</div>
            <div className={`text-sm font-data ${hasLive ? 'text-text-heading' : 'text-text-muted'}`}>
              {hasLive ? formatCurrency(totalMarketValue) : '—'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-3 border-t border-border">
          <div>
            <div className="text-[10px] text-text-muted mb-1">Open</div>
            <div className="text-sm font-data text-text-heading">{positions.length} {positions.length === 1 ? 'pos' : 'pos'}</div>
          </div>
          {positions.length > 1 && hasLive && (
            <div>
              <div className="text-[10px] text-text-muted mb-1">Best</div>
              <div className="text-xs font-data text-profit">
                {positions.reduce((b, p) => p.livePnl > b.livePnl ? p : b, positions[0]).trade.symbol}
              </div>
            </div>
          )}
          {positions.length > 1 && hasLive && (
            <div>
              <div className="text-[10px] text-text-muted mb-1">Worst</div>
              <div className="text-xs font-data text-loss">
                {positions.reduce((w, p) => p.livePnl < w.livePnl ? p : w, positions[0]).trade.symbol}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MarketPulseCard() {
  const { data: regimeData, isLoading } = useMarketRegimeQuery(1)
  const cur = regimeData?.current

  if (isLoading) {
    return (
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-accent" />
          <h3 className="font-display text-sm text-text-heading">Market Pulse</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-5 w-28 rounded bg-bg-elevated animate-pulse" />)}
        </div>
      </div>
    )
  }

  const niftyClose = cur?.nifty_close ? parseFloat(cur.nifty_close) : null
  const niftyChg = cur?.nifty_change_pct ? parseFloat(cur.nifty_change_pct) : null
  const isUp = (niftyChg ?? 0) >= 0

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-accent" />
        <h3 className="font-display text-sm text-text-heading">Market Pulse</h3>
        {cur?.date && <span className="text-[10px] text-text-muted font-data ml-auto">{cur.date}</span>}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">NIFTY 50</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold font-data text-text-heading">
              {niftyClose != null ? `₹${niftyClose.toLocaleString('en-IN')}` : '—'}
            </span>
            {niftyChg != null && (
              <span className={`text-[11px] font-data flex items-center gap-0.5 ${isUp ? 'text-profit' : 'text-loss'}`}>
                {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {isUp ? '+' : ''}{niftyChg.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">India VIX</span>
          <span className="text-sm font-data text-text-heading">{cur?.india_vix ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Breadth A/D</span>
          <span className="text-sm font-data text-text-heading">{cur?.advance_count ?? '—'}/{cur?.decline_count ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Regime</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-data font-medium ${
            cur?.nifty_regime === 'bullish' ? 'bg-profit-muted text-profit' :
            cur?.nifty_regime === 'bearish' ? 'bg-loss-muted text-loss' :
            cur?.nifty_regime === 'volatile' ? 'bg-amber-500/15 text-amber-400' :
            'bg-border text-text-muted'
          }`}>
            {cur?.nifty_regime ? cur.nifty_regime.charAt(0).toUpperCase() + cur.nifty_regime.slice(1) : '—'}
          </span>
        </div>
        {cur?.fii_flow_cr && (
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-muted">FII Flow</span>
            <span className={`text-xs font-data ${parseFloat(cur.fii_flow_cr) >= 0 ? 'text-profit' : 'text-loss'}`}>
              {parseFloat(cur.fii_flow_cr) >= 0 ? '+' : ''}{formatCurrency(parseFloat(cur.fii_flow_cr))}cr
            </span>
          </div>
        )}
        {cur?.dii_flow_cr && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">DII Flow</span>
            <span className={`text-xs font-data ${parseFloat(cur.dii_flow_cr) >= 0 ? 'text-profit' : 'text-loss'}`}>
              {parseFloat(cur.dii_flow_cr) >= 0 ? '+' : ''}{formatCurrency(parseFloat(cur.dii_flow_cr))}cr
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function OpenPositionsCard({ positions }: { positions: OpenPositionLive[] }) {
  if (positions.length === 0) {
    return (
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-accent" />
          <h3 className="font-display text-sm text-text-heading">Open Positions</h3>
        </div>
        <div className="py-5 text-sm text-text-muted text-center">No open positions</div>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-4 h-4 text-accent" />
        <h3 className="font-display text-sm text-text-heading">Open Positions</h3>
        <span className="text-[10px] text-text-muted font-data">{positions.length}</span>
      </div>
      <div className="space-y-2">
        {positions.map(p => {
          const isProfit = p.livePnl >= 0
          const hasLive = p.ltp != null
          return (
            <div key={p.trade.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="min-w-0">
                <div className="text-xs font-medium font-display text-text-heading truncate">{p.trade.symbol}</div>
                <div className="text-[10px] text-text-muted font-data">
                  {parseFloat(p.trade.quantity).toLocaleString('en-IN')} @ {formatPrice(p.trade.entry_price)}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-right">
                <div className="hidden sm:block">
                  {hasLive ? (
                    <div className="text-[10px] font-data text-text-muted">
                      LTP <span className="text-text-heading">{formatPrice(p.ltp!)}</span>
                    </div>
                  ) : null}
                  {p.changePct != null && (
                    <span className={`text-[10px] font-data ${p.changePct >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {p.changePct >= 0 ? '+' : ''}{p.changePct.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="min-w-[72px]">
                  {hasLive ? (
                    <>
                      <div className={`text-xs font-data font-medium ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {isProfit ? '+' : ''}{formatCurrency(p.livePnl)}
                      </div>
                      <div className={`text-[10px] font-data ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {isProfit ? '+' : ''}{p.livePnlPct.toFixed(2)}%
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-text-faint font-data">—</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface LiveDashboardProps {
  trades: ApiTrade[]
  quoteMap: Map<string, LiveQuote>
}

export function LiveDashboard({ trades, quoteMap }: LiveDashboardProps) {
  const positions = computeLivePositions(trades, quoteMap)
  const hasOpen = positions.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-[15px] h-[15px] text-accent" />
        <h2 className="font-display text-sm text-text-heading">Live Now</h2>
        {positions.some(p => p.ltp != null) && (
          <span className="flex items-center gap-1 text-[10px] text-profit font-data">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            MARKET OPEN
          </span>
        )}
      </div>
      {hasOpen ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LivePortfolioCard positions={positions} />
          <MarketPulseCard />
          <OpenPositionsCard positions={positions} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <MarketPulseCard />
          </div>
          <OpenPositionsCard positions={positions} />
        </div>
      )}
    </div>
  )
}