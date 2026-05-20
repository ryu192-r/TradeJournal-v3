import { useState, useEffect } from 'react'
import { Target, Loader2 } from 'lucide-react'
import { ChartImageGallery } from '@/components/trades/ChartImageGallery'
import { LifecycleReviewPanel } from '@/components/lifecycle/LifecycleReviewPanel'
import { useTradeReviewMutation } from '@/hooks/useTradeReviewMutation'
import { formatCurrency, formatPrice, formatQuantity, formatDate } from '@/utils/format'
import type { ApiTrade } from '@/types'
import type { TradeReviewResponse } from '@/types/coach'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

interface TradeDetailContentProps {
  trade: ApiTrade
}

export function TradeDetailContent({ trade }: TradeDetailContentProps) {
  const [inlineReview, setInlineReview] = useState<TradeReviewResponse | null>(null)
  const reviewMut = useTradeReviewMutation()

  useEffect(() => { setInlineReview(null) }, [trade.id])

  const handleTradeReview = () => {
    reviewMut.mutate(trade.id, {
      onSuccess: (data) => setInlineReview(data),
    })
  }

  const pnlValue = trade.pnl != null ? Number(trade.pnl) : null
  const pnlIsProfit = pnlValue != null && pnlValue >= 0
  const remainingQty = trade.remaining_qty != null ? Number(trade.remaining_qty) : null
  const partialPnl = trade.partial_realized_pnl != null ? Number(trade.partial_realized_pnl) : null
  const showPartialInfo = remainingQty != null && remainingQty < Number(trade.quantity)

  const detailRows = [
    trade.stop_price != null && { label: 'Stop Loss', value: formatPrice(Number(trade.stop_price)) },
    trade.target_price != null && { label: 'Target', value: formatPrice(Number(trade.target_price)) },
    trade.r_multiple != null && { label: 'R-Multiple', value: `${Number(trade.r_multiple).toFixed(2)}R` },
    trade.fees != null && Number(trade.fees) > 0 && { label: 'Fees', value: formatCurrency(Number(trade.fees)) },
    remainingQty != null && { label: 'Remaining', value: formatQuantity(remainingQty) },
    partialPnl != null && { label: 'Partial P&L', value: `${partialPnl >= 0 ? '+' : ''}${formatCurrency(partialPnl)}` },
    trade.setup && { label: 'Setup', value: trade.setup },
    trade.tactic && { label: 'Tactic', value: trade.tactic },
    trade.exit_reason && { label: 'Exit Reason', value: trade.exit_reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
  ].filter(Boolean) as { label: string; value: string }[]

  const pnlColor = pnlValue != null ? (pnlIsProfit ? 'text-profit' : 'text-loss') : 'text-text-muted'
  const pnlBg = pnlValue != null ? (pnlIsProfit ? 'border-profit/30 bg-profit-muted/20' : 'border-loss/30 bg-loss-muted/20') : 'border-border bg-bg-elevated/30'

  return (
    <div className="space-y-[var(--page-gap)]">
      {/* Header */}
      <div className={CARD}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-[length:var(--heading-size)] font-semibold text-text-heading font-display truncate">{trade.symbol}</h2>
            <span className={`shrink-0 text-[length:var(--text-xs)] font-medium px-2.5 py-1 rounded-full ${trade.exit_price ? (pnlIsProfit ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss') : 'bg-border text-text-muted'}`}>
              {trade.exit_price ? 'Closed' : 'Open'}
            </span>
          </div>
          {trade.exit_price && (
            <button
              onClick={handleTradeReview}
              disabled={reviewMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[length:var(--text-xs)] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {reviewMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
              AI Review
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--page-gap)]">
        <div className={CARD}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-1">Entry</div>
          <div className="font-data text-lg sm:text-xl font-semibold text-text-heading">{formatPrice(Number(trade.entry_price))}</div>
          <div className="text-[length:var(--text-xs)] text-text-muted mt-1">{formatDate(trade.entry_time)}</div>
        </div>
        <div className={CARD}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-1">Exit</div>
          <div className="font-data text-lg sm:text-xl font-semibold text-text-heading">{trade.exit_price ? formatPrice(Number(trade.exit_price)) : '—'}</div>
          <div className="text-[length:var(--text-xs)] text-text-muted mt-1">{trade.exit_time ? formatDate(trade.exit_time) : 'Open'}</div>
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
        <div className={`rounded-2xl border p-[var(--page-px)] animate-card-in ${pnlBg}`}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-1">P&amp;L</div>
          <div className={`font-data text-lg sm:text-xl font-semibold ${pnlColor}`}>
            {pnlValue != null ? `${pnlIsProfit ? '+' : ''}${formatCurrency(pnlValue)}` : '—'}
          </div>
          {partialPnl != null && !trade.exit_price && (
            <div className={`text-[length:var(--text-xs)] mt-1 ${partialPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              Partial: {partialPnl >= 0 ? '+' : ''}{formatCurrency(partialPnl)}
            </div>
          )}
        </div>
      </div>

      <ChartImageGallery tradeId={trade.id} images={trade.chart_images ?? []} />

      {/* Detail rows */}
      {detailRows.length > 0 && (
        <div className={CARD}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {detailRows.map((row) => (
              <div key={row.label} className="flex justify-between py-1.5 border-b border-border/40 last:border-0 sm:border-0">
                <span className="text-[length:var(--text-sm)] text-text-muted">{row.label}</span>
                <span className="text-[length:var(--text-sm)] text-text-heading font-medium font-data text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trade.notes && (
        <div className={CARD}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-2">Notes</div>
          <p className="text-[length:var(--text-sm)] text-text-heading whitespace-pre-wrap leading-relaxed">{trade.notes}</p>
        </div>
      )}

      {trade.tags && trade.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {trade.tags.map((tag) => (
            <span key={tag} className="text-[length:var(--text-xs)] px-2.5 py-1 rounded-full bg-accent-faint text-accent">{tag}</span>
          ))}
        </div>
      )}

      {/* Inline AI Review result */}
      {inlineReview && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-[var(--page-px)] space-y-[var(--page-gap)] animate-card-in">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <span className="text-[length:var(--text-sm)] font-medium text-text-heading">AI Trade Review</span>
            <span className={`text-[length:var(--text-sm)] font-bold ml-auto font-data ${inlineReview.discipline_score >= 70 ? 'text-profit' : inlineReview.discipline_score >= 40 ? 'text-amber-400' : 'text-loss'}`}>
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
          <p className="text-[10px] text-text-muted">Full review available in AI Coach &rarr; Trade Review tab</p>
        </div>
      )}

      <LifecycleReviewPanel trade={trade} />
    </div>
  )
}