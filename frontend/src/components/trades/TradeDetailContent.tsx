import { useState, useEffect, useMemo } from 'react'
import { Target, Loader2, Edit3, ShieldAlert, Info } from 'lucide-react'
import { ChartImageGallery } from '@/components/trades/ChartImageGallery'
import { LifecycleReviewPanel } from '@/components/lifecycle/LifecycleReviewPanel'
import { useTradeReviewMutation } from '@/hooks/useTradeReviewMutation'
import { useAppStore } from '@/store/appStore'
import { formatCurrency, formatPrice, formatQuantity, formatDate } from '@/utils/format'
import { calculateTradeMetrics } from '@/utils/calculations'
import { StatusBadge, SectionHeader } from '@/components/ui'
import type { ApiTrade } from '@/types'
import type { TradeReviewResponse } from '@/types/coach'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

interface TradeDetailContentProps {
  trade: ApiTrade
}

export function TradeDetailContent({ trade }: TradeDetailContentProps) {
  const [inlineReview, setInlineReview] = useState<TradeReviewResponse | null>(null)
  const reviewMut = useTradeReviewMutation()
  const openEditTrade = useAppStore((s) => s.openEditTrade)

  useEffect(() => { setInlineReview(null) }, [trade.id])

  const calc = useMemo(() => calculateTradeMetrics({
    entryPrice: Number(trade.entry_price),
    exitPrice: trade.exit_price != null ? Number(trade.exit_price) : undefined,
    quantity: Number(trade.quantity),
    fees: Number(trade.fees ?? 0),
    stopPrice: trade.stop_price != null ? Number(trade.stop_price) : undefined,
    targetPrice: trade.target_price != null ? Number(trade.target_price) : undefined,
    direction: trade.direction ?? 'LONG',
  }), [trade])

  const handleTradeReview = () => {
    reviewMut.mutate(trade.id, {
      onSuccess: (data) => setInlineReview(data),
    })
  }

  const pnlValue = calc.netPnl
  const pnlIsProfit = pnlValue != null && pnlValue >= 0
  const remainingQty = trade.remaining_qty != null ? Number(trade.remaining_qty) : null
  const partialPnl = trade.partial_realized_pnl != null ? Number(trade.partial_realized_pnl) : null
  const showPartialInfo = remainingQty != null && remainingQty < Number(trade.quantity)
  const isOpen = !trade.exit_price

  const pnlColor = pnlValue != null ? (pnlIsProfit ? 'text-profit' : 'text-loss') : 'text-text-muted'
  const pnlBg = pnlValue != null
    ? (pnlIsProfit ? 'border-profit/30 bg-profit-muted/20' : 'border-loss/30 bg-loss-muted/20')
    : 'border-border bg-bg-elevated/30'

  const fmt = (v: number | null, suff = '') => {
    if (v == null) return '—'
    const sign = v >= 0 ? '+' : ''
    return sign + formatCurrency(Math.abs(v)) + suff
  }

  return (
    <div className="space-y-[var(--page-gap)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
      {/* ── HEADER: Symbol + Status + Actions ── */}
      <div className={CARD}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-[length:var(--heading-size)] font-semibold text-text-heading font-display truncate">
              {trade.symbol}
            </h2>
            <StatusBadge
              status={isOpen ? 'Open' : 'Closed'}
              tone={isOpen ? 'neutral' : pnlIsProfit ? 'profit' : 'loss'}
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => openEditTrade(trade.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[length:var(--text-xs)] border border-border text-text-muted hover:text-text-heading hover:border-text-muted transition-colors cursor-pointer"
              title="Edit trade"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            {!isOpen && (
              <button
                onClick={handleTradeReview}
                disabled={reviewMut.isPending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[length:var(--text-xs)] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {reviewMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                AI Review
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── HERO: P&L + R ── */}
      <div className={`rounded-2xl border p-[var(--page-px)] animate-card-in ${pnlBg}`}>
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display">Net P&amp;L</div>
            <div className={`font-data text-3xl sm:text-4xl font-bold mt-1 ${pnlColor}`}>
              {pnlValue != null ? `${pnlIsProfit ? '+' : ''}${formatCurrency(pnlValue)}` : '—'}
            </div>
            {calc.rMultiple != null && (
              <div className={`text-sm font-data mt-1 ${calc.rMultiple >= 0 ? 'text-profit' : 'text-loss'}`}>
                {calc.rMultiple >= 0 ? '+' : ''}{calc.rMultiple.toFixed(2)}R
              </div>
            )}
          </div>
          {partialPnl != null && isOpen && (
            <div className="text-right">
              <div className="text-[length:var(--text-xs)] text-text-muted">Partial Realized</div>
              <div className={`text-base font-data font-medium ${partialPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {partialPnl >= 0 ? '+' : ''}{formatCurrency(partialPnl)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── METRICS GRID ── */}
      <div className={CARD}>
        <h3 className="text-[length:var(--text-xs)] text-accent uppercase tracking-wider font-display mb-3 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          Trade Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--text-xs)] text-text-muted">Gross P&amp;L</span>
            <span className={`text-sm font-data font-medium ${calc.isValidForPnl ? (calc.grossPnl! >= 0 ? 'text-profit' : 'text-loss') : 'text-text-faint'}`}>
              {calc.isValidForPnl ? fmt(calc.grossPnl) : 'Not enough data'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--text-xs)] text-text-muted">Net P&amp;L</span>
            <span className={`text-sm font-data font-medium ${calc.isValidForPnl ? (calc.netPnl! >= 0 ? 'text-profit' : 'text-loss') : 'text-text-faint'}`}>
              {calc.isValidForPnl ? fmt(calc.netPnl) : 'Not enough data'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--text-xs)] text-text-muted flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-loss" />
              Risk Amount
            </span>
            <span className={`text-sm font-data font-medium ${calc.riskAmount != null ? 'text-loss' : 'text-text-faint'}`}>
              {calc.riskAmount != null ? formatCurrency(Math.abs(calc.riskAmount)) : 'Not enough data'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--text-xs)] text-text-muted">Planned Reward</span>
            <span className={`text-sm font-data font-medium ${calc.plannedRewardAmount != null ? 'text-profit' : 'text-text-faint'}`}>
              {calc.plannedRewardAmount != null ? formatCurrency(calc.plannedRewardAmount) : 'Not enough data'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--text-xs)] text-text-muted">Planned Risk:Reward</span>
            <span className={`text-sm font-data font-medium ${calc.isValidForRiskReward ? 'text-text-heading' : 'text-text-faint'}`}>
              {calc.isValidForRiskReward ? `1:${calc.riskRewardRatio!.toFixed(2)}` : 'Not enough data'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--text-xs)] text-text-muted">Actual R Multiple</span>
            <span className={`text-sm font-data font-medium ${calc.rMultiple != null ? (calc.rMultiple >= 0 ? 'text-profit' : 'text-loss') : 'text-text-faint'}`}>
              {calc.rMultiple != null ? `${calc.rMultiple >= 0 ? '+' : ''}${calc.rMultiple.toFixed(2)}R` : 'Not enough data'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--text-xs)] text-text-muted">P&amp;L per Unit</span>
            <span className={`text-sm font-data font-medium ${calc.pnlPerUnit != null ? (calc.pnlPerUnit >= 0 ? 'text-profit' : 'text-loss') : 'text-text-faint'}`}>
              {calc.pnlPerUnit != null ? `${calc.pnlPerUnit >= 0 ? '+' : ''}${formatPrice(Math.abs(calc.pnlPerUnit))}` : 'Not enough data'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--text-xs)] text-text-muted">Risk per Unit</span>
            <span className={`text-sm font-data font-medium ${calc.riskPerUnit != null ? 'text-loss' : 'text-text-faint'}`}>
              {calc.riskPerUnit != null ? formatPrice(calc.riskPerUnit) : 'Not enough data'}
            </span>
          </div>
        </div>

        {calc.warnings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {calc.warnings.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <Info className="w-2.5 h-2.5" />
                {w}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── STAT GRID ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--page-gap)]">
        <div className={CARD}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-1">Entry</div>
          <div className="font-data text-lg sm:text-xl font-semibold text-text-heading">{formatPrice(Number(trade.entry_price))}</div>
          <div className="text-[length:var(--text-xs)] text-text-muted mt-1 font-data">{formatDate(trade.entry_time)}</div>
        </div>
        <div className={CARD}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-1">Exit</div>
          <div className="font-data text-lg sm:text-xl font-semibold text-text-heading">
            {trade.exit_price ? formatPrice(Number(trade.exit_price)) : '—'}
          </div>
          <div className="text-[length:var(--text-xs)] text-text-muted mt-1 font-data">
            {trade.exit_time ? formatDate(trade.exit_time) : 'Open'}
          </div>
        </div>
        <div className={CARD}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-1">
            Qty{showPartialInfo ? ' (rem.)' : ''}
          </div>
          <div className="font-data text-lg sm:text-xl font-semibold text-text-heading">
            {formatQuantity(trade.quantity)}
            {showPartialInfo && (
              <span className="text-text-muted text-[length:var(--text-sm)] ml-1.5">/ {formatQuantity(remainingQty!)}</span>
            )}
          </div>
        </div>
        <div className={CARD}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-1">Fees</div>
          <div className="font-data text-lg sm:text-xl font-semibold text-text-heading">
            {trade.fees != null && Number(trade.fees) > 0 ? formatCurrency(Number(trade.fees)) : '—'}
          </div>
        </div>
      </div>

      {/* ── DETAIL ROWS ── */}
      <div className={CARD}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {trade.stop_price != null && (
            <div className="flex justify-between py-1 border-b border-border/40 sm:border-0">
              <span className="text-[length:var(--text-sm)] text-text-muted">Stop Loss</span>
              <span className="text-[length:var(--text-sm)] text-text-heading font-medium font-data">{formatPrice(Number(trade.stop_price))}</span>
            </div>
          )}
          {trade.target_price != null && (
            <div className="flex justify-between py-1 border-b border-border/40 sm:border-0">
              <span className="text-[length:var(--text-sm)] text-text-muted">Target</span>
              <span className="text-[length:var(--text-sm)] text-text-heading font-medium font-data">{formatPrice(Number(trade.target_price))}</span>
            </div>
          )}
          {trade.setup && (
            <div className="flex justify-between py-1 border-b border-border/40 sm:border-0">
              <span className="text-[length:var(--text-sm)] text-text-muted">Setup</span>
              <span className="text-[length:var(--text-sm)] text-text-heading font-medium">{trade.setup}</span>
            </div>
          )}
          {trade.tactic && (
            <div className="flex justify-between py-1 border-b border-border/40 sm:border-0">
              <span className="text-[length:var(--text-sm)] text-text-muted">Tactic</span>
              <span className="text-[length:var(--text-sm)] text-text-heading font-medium">{trade.tactic}</span>
            </div>
          )}
          {trade.exit_reason && (
            <div className="flex justify-between py-1 border-b border-border/40 sm:border-0">
              <span className="text-[length:var(--text-sm)] text-text-muted">Exit Reason</span>
              <span className="text-[length:var(--text-sm)] text-text-heading font-medium">
                {trade.exit_reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── CHARTS ── */}
      <ChartImageGallery tradeId={trade.id} images={trade.chart_images ?? []} />

      {/* ── NOTES ── */}
      {trade.notes && (
        <div className={CARD}>
          <SectionHeader title="Notes" />
          <p className="text-[length:var(--text-sm)] text-text-heading whitespace-pre-wrap leading-relaxed">{trade.notes}</p>
        </div>
      )}

      {/* ── TAGS ── */}
      {trade.tags && trade.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {trade.tags.map((tag) => (
            <span key={tag} className="text-[length:var(--text-xs)] px-2.5 py-1 rounded-full bg-accent-faint text-accent">{tag}</span>
          ))}
        </div>
      )}

      {/* ── AI REVIEW ── */}
      {inlineReview && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-[var(--page-px)] space-y-[var(--page-gap)] animate-card-in">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <span className="text-[length:var(--text-sm)] font-medium text-text-heading">AI Trade Review</span>
            <span className={`text-[length:var(--text-sm)] font-bold ml-auto font-data ${inlineReview.discipline_score >= 70 ? 'text-profit' : inlineReview.discipline_score >= 40 ? 'text-gold' : 'text-loss'}`}>
              {inlineReview.discipline_score}/100
            </span>
          </div>
          <p className="text-[length:var(--text-sm)] text-text leading-relaxed">{inlineReview.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {inlineReview.strengths.slice(0, 2).map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-profit-muted/20 text-profit">{s}</span>
            ))}
            {inlineReview.weaknesses.slice(0, 2).map((w, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-loss-muted/20 text-loss">{w}</span>
            ))}
          </div>
          <p className="text-[10px] text-text-muted">Full review available in AI Coach → Trade Review tab</p>
        </div>
      )}

      {/* ── LIFECYCLE ── */}
      <LifecycleReviewPanel trade={trade} />
    </div>
  )
}
