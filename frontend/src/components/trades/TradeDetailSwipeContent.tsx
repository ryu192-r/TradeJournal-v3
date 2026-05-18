import { useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { ChartImageGallery } from '@/components/trades/ChartImageGallery'
import { LifecycleReviewPanel } from '@/components/lifecycle/LifecycleReviewPanel'
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

  const pnlValue = trade.pnl != null ? Number(trade.pnl) : null
  const pnlIsProfit = pnlValue != null && pnlValue >= 0

  const detailRows = [
    trade.stop_price != null && { label: 'Stop Loss', value: formatPrice(Number(trade.stop_price)) },
    trade.target_price != null && { label: 'Target', value: formatPrice(Number(trade.target_price)) },
    trade.r_multiple != null && { label: 'R-Multiple', value: `${Number(trade.r_multiple).toFixed(2)}R` },
    trade.fees != null && Number(trade.fees) > 0 && { label: 'Fees', value: formatCurrency(Number(trade.fees)) },
    trade.setup && { label: 'Setup', value: trade.setup },
    trade.tactic && { label: 'Tactic', value: trade.tactic },
    trade.exit_reason && { label: 'Exit Reason', value: trade.exit_reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <div className="flex items-center gap-1 min-w-0">
          {hasPrev && (
            <button onClick={() => onSelect(trades[idx - 1])} className="p-1.5 -ml-1.5 rounded-lg text-text-muted hover:text-text-heading active:bg-bg-elevated transition-colors cursor-pointer shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="font-display text-lg font-semibold text-text-heading truncate">{trade.symbol}</h2>
          {hasNext && (
            <button onClick={() => onSelect(trades[idx + 1])} className="p-1.5 -mr-1.5 rounded-lg text-text-muted hover:text-text-heading active:bg-bg-elevated transition-colors cursor-pointer shrink-0">
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${trade.exit_price ? (pnlIsProfit ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss') : 'bg-border text-text-muted'}`}>
            {trade.exit_price ? 'Closed' : 'Open'}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-heading active:bg-bg-elevated transition-colors cursor-pointer shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="hidden sm:flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {hasPrev && (
            <button onClick={() => onSelect(trades[idx - 1])} className="p-1.5 rounded-lg text-text-muted hover:text-text-heading hover:bg-accent-faint transition-colors cursor-pointer shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="font-display text-xl font-semibold text-text-heading">{trade.symbol}</h2>
          {hasNext && (
            <button onClick={() => onSelect(trades[idx + 1])} className="p-1.5 rounded-lg text-text-muted hover:text-text-heading hover:bg-accent-faint transition-colors cursor-pointer shrink-0">
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trade.exit_price ? (pnlIsProfit ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss') : 'bg-border text-text-muted'}`}>
            {trade.exit_price ? 'Closed' : 'Open'}
          </span>
          <span className="text-[11px] text-text-muted font-data">{idx + 1} / {trades.length}</span>
        </div>
      </div>

      <div className="sm:hidden text-center text-[10px] text-text-muted font-data mt-1 mb-3">
        {idx + 1} / {trades.length}
      </div>

      <div className="mt-3 sm:mt-4 space-y-4">
        {/* Stat cards — 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-[11px] text-text-muted uppercase tracking-wider mb-0.5">Entry</div>
            <div className="font-data text-sm sm:text-base font-semibold text-text-heading">{formatPrice(Number(trade.entry_price))}</div>
            <div className="text-[10px] sm:text-[11px] text-text-muted mt-0.5">{formatDate(trade.entry_time)}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-[11px] text-text-muted uppercase tracking-wider mb-0.5">Exit</div>
            <div className="font-data text-sm sm:text-base font-semibold text-text-heading">{trade.exit_price ? formatPrice(Number(trade.exit_price)) : '—'}</div>
            <div className="text-[10px] sm:text-[11px] text-text-muted mt-0.5">{trade.exit_time ? formatDate(trade.exit_time) : 'Open'}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-[11px] text-text-muted uppercase tracking-wider mb-0.5">Qty</div>
            <div className="font-data text-sm sm:text-base font-semibold text-text-heading">{formatQuantity(trade.quantity)}</div>
          </div>
          <div className={`rounded-xl border p-2.5 sm:p-3 ${pnlValue != null ? (pnlIsProfit ? 'border-profit/30 bg-profit-muted/20' : 'border-loss/30 bg-loss-muted/20') : 'border-border bg-bg-elevated/30'}`}>
            <div className="text-[10px] sm:text-[11px] text-text-muted uppercase tracking-wider mb-0.5">P&amp;L</div>
            <div className={`font-data text-sm sm:text-base font-semibold ${pnlValue != null ? (pnlIsProfit ? 'text-profit' : 'text-loss') : 'text-text-muted'}`}>
              {pnlValue != null ? `${pnlIsProfit ? '+' : ''}${formatCurrency(pnlValue)}` : '—'}
            </div>
          </div>
        </div>

        <ChartImageGallery tradeId={trade.id} images={trade.chart_images ?? []} />

        {/* Detail rows — 2 cols desktop */}
        {detailRows.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {detailRows.map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-text-muted">{row.label}</span>
                  <span className="text-text-heading font-medium font-data text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trade.notes && (
          <div className="border-t border-border pt-3">
            <div className="text-[10px] sm:text-[11px] text-text-muted uppercase tracking-wider mb-1">Notes</div>
            <p className="text-sm text-text-heading whitespace-pre-wrap leading-relaxed">{trade.notes}</p>
          </div>
        )}

        {trade.tags && trade.tags.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-[10px] sm:text-[11px] text-text-muted uppercase tracking-wider mb-1">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {trade.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-accent-faint text-accent">{tag}</span>
              ))}
            </div>
          </div>
        )}

        <LifecycleReviewPanel trade={trade} />
      </div>
    </div>
  )
}