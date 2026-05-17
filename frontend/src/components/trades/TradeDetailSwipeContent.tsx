import { useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { ChartImageGallery } from '@/components/trades/ChartImageGallery'
import { StopHistoryTimeline } from '@/components/trades/StopHistoryTimeline'
import { formatCurrency, formatPrice, formatQuantity, formatDate } from '@/utils/format'
import type { ApiTrade } from '@/types'

interface TradeDetailSwipeContentProps {
  trade: ApiTrade
  trades: ApiTrade[]
  onSelect: (t: ApiTrade) => void
  onClose: () => void
}

export function TradeDetailSwipeContent({ trade, trades, onSelect, onClose }: TradeDetailSwipeContentProps) {
  const startX = useRef(0)
  const idx = trades.findIndex((t) => t.id === trade.id)
  const hasPrev = idx > 0
  const hasNext = idx < trades.length - 1

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current
    if (Math.abs(dx) < 60) return
    if (dx < 0 && hasNext) onSelect(trades[idx + 1])
    if (dx > 0 && hasPrev) onSelect(trades[idx - 1])
  }, [hasPrev, hasNext, idx, trades, onSelect])

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header with nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {hasPrev && (
            <button onClick={() => onSelect(trades[idx - 1])} className="p-1 rounded-lg text-text-muted hover:text-text-heading hover:bg-accent-faint transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="font-display text-lg text-text-heading">{trade.symbol}</h2>
          {hasNext && (
            <button onClick={() => onSelect(trades[idx + 1])} className="p-1 rounded-lg text-text-muted hover:text-text-heading hover:bg-accent-faint transition-colors cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-heading hover:bg-bg-card-h transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center text-[10px] text-text-muted font-data mb-3">
        {idx + 1} / {trades.length} {hasPrev || hasNext ? '— swipe to navigate' : ''}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
            <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Entry</div>
            <div className="font-data text-sm font-medium text-text-heading">{formatPrice(Number(trade.entry_price))}</div>
            <div className="text-[11px] text-text-muted mt-1">{formatDate(trade.entry_time)}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
            <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Exit</div>
            <div className="font-data text-sm font-medium text-text-heading">{trade.exit_price ? formatPrice(Number(trade.exit_price)) : '—'}</div>
            <div className="text-[11px] text-text-muted mt-1">{trade.exit_time ? formatDate(trade.exit_time) : 'Open'}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
            <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Qty</div>
            <div className="font-data text-sm font-medium text-text-heading">{formatQuantity(trade.quantity)}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
            <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">P&amp;L</div>
            <div className={`font-data text-sm font-medium ${trade.pnl == null ? 'text-text-muted' : Number(trade.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>
              {trade.pnl != null ? `${Number(trade.pnl) >= 0 ? '+' : ''}${formatCurrency(Number(trade.pnl))}` : '—'}
            </div>
          </div>
        </div>

        <ChartImageGallery tradeId={trade.id} images={trade.chart_images ?? []} />

        <div className="border-t border-border pt-4 space-y-2">
          {trade.stop_price && (
            <div className="flex justify-between text-sm"><span className="text-text-muted">Stop Loss</span><span className="text-text-heading font-medium">{formatPrice(Number(trade.stop_price))}</span></div>
          )}
          {trade.target_price && (
            <div className="flex justify-between text-sm"><span className="text-text-muted">Target</span><span className="text-text-heading font-medium">{formatPrice(Number(trade.target_price))}</span></div>
          )}
          {trade.r_multiple && (
            <div className="flex justify-between text-sm"><span className="text-text-muted">R-Multiple</span><span className="text-text-heading font-medium">{Number(trade.r_multiple).toFixed(2)}</span></div>
          )}
          {trade.fees && Number(trade.fees) > 0 && (
            <div className="flex justify-between text-sm"><span className="text-text-muted">Fees</span><span className="text-text-heading font-medium">{formatCurrency(Number(trade.fees))}</span></div>
          )}
          {trade.setup && (
            <div className="flex justify-between text-sm"><span className="text-text-muted">Setup</span><span className="text-text-heading font-medium">{trade.setup}</span></div>
          )}
          {trade.tactic && (
            <div className="flex justify-between text-sm"><span className="text-text-muted">Tactic</span><span className="text-text-heading font-medium">{trade.tactic}</span></div>
          )}
          <div className="flex justify-between text-sm"><span className="text-text-muted">Status</span><span className="text-text-heading font-medium capitalize">{trade.exit_price ? 'Closed' : 'Open'}</span></div>
          {trade.exit_reason && (
            <div className="flex justify-between text-sm"><span className="text-text-muted">Exit Reason</span><span className="text-text-heading font-medium capitalize">{trade.exit_reason.replace('_', ' ')}</span></div>
          )}
        </div>

        {trade.notes && (
          <div className="border-t border-border pt-4">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Notes</div>
            <p className="text-sm text-text-heading whitespace-pre-wrap">{trade.notes}</p>
          </div>
        )}
        {trade.tags && trade.tags.length > 0 && (
          <div className="border-t border-border pt-4">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5">{trade.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-accent-faint text-accent">{tag}</span>
            ))}</div>
          </div>
        )}
        <StopHistoryTimeline tradeId={trade.id} />
      </div>
    </div>
  )
}
