// Single trade review card — trade summary, chart gallery, tags, notes, review button
import { useState } from 'react'
import { ChartGallery } from './ChartGallery'
import { TagSelector } from './TagSelector'
import type { ApiTrade, ApiTradeUpdatePayload } from '@/types'
import { formatCurrency, formatDate, formatRMultiple } from '@/utils/format'
import { ArrowRight, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'

interface TradeReviewCardProps {
  trade: ApiTrade
  onReview: (id: number, payload: ApiTradeUpdatePayload) => Promise<void>
  onNext?: () => void
  isLast?: boolean
}

function pnlColor(pnl: string | number | null | undefined): string {
  if (pnl === null || pnl === undefined) return 'text-text-muted'
  const n = typeof pnl === 'string' ? Number(pnl) : pnl
  return n >= 0 ? 'text-profit' : 'text-loss'
}

function directionIcon(direction: string) {
  return direction === 'LONG' ? (
    <TrendingUp className="w-4 h-4" />
  ) : (
    <TrendingDown className="w-4 h-4" />
  )
}

function directionBadgeVariant(direction: string): 'profit' | 'loss' {
  return direction === 'LONG' ? 'profit' : 'loss'
}

function badgeStyles(variant: 'profit' | 'loss' | 'accent', size?: 'sm'): string {
  const base = 'inline-flex items-center rounded-full font-medium'
  const sizing = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
  
  let color = ''
  if (variant === 'profit') color = 'bg-profit-faint text-profit'
  else if (variant === 'loss') color = 'bg-loss-faint text-loss'
  else color = 'bg-accent-faint text-accent'
  
  return `${base} ${sizing} ${color}`
}

export function TradeReviewCard({ trade, onReview, onNext, isLast }: TradeReviewCardProps) {
  const [tags, setTags] = useState<string[]>(trade.tags || [])
  const [notes, setNotes] = useState(trade.notes || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const handleReview = async () => {
    if (isSubmitting) return
    setReviewError(null)
    setIsSubmitting(true)
    const payload: ApiTradeUpdatePayload = {
      tags: tags.length > 0 ? tags : null,
      notes: notes.trim() || null,
      status: 'reviewed',
    }
    try {
      await onReview(trade.id, payload)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to save review.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const pnl = trade.pnl ?? undefined
  const rMultiple = trade.r_multiple ?? undefined

  return (
    <div className="bg-card rounded-2xl border border-border p-6 max-w-2xl mx-auto">
      {/* Trade Summary Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="font-display text-lg font-semibold text-text-heading">{trade.symbol}</div>
          <span className={badgeStyles(directionBadgeVariant(trade.direction))}>
            <span className="flex items-center gap-1">
              {directionIcon(trade.direction)}
              {trade.direction}
            </span>
          </span>
          {trade.setup && (
            <span className={badgeStyles('accent', 'sm')}>
              {trade.setup}
            </span>
          )}
        </div>
        <div className="text-right">
          {pnl !== undefined && (
            <div className={`font-data font-bold text-lg ${pnlColor(pnl)}`}>
              {Number(pnl) >= 0 ? '+' : ''}
              {formatCurrency(Number(pnl))}
            </div>
          )}
          {rMultiple !== undefined && (
            <div className="text-xs text-text-muted">{formatRMultiple(Number(rMultiple))}</div>
          )}
        </div>
      </div>

      {/* Trade Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 rounded-xl bg-bg-elevated/30 border border-border">
        <div>
          <div className="text-[11px] text-text-muted uppercase tracking-wide">Entry</div>
          <div className="font-data text-sm font-medium text-text-heading mt-1">{formatCurrency(Number(trade.entry_price))}</div>
          <div className="text-[11px] text-text-muted mt-1">{formatDate(trade.entry_time)}</div>
        </div>
        <div>
          <div className="text-[11px] text-text-muted uppercase tracking-wide">Exit</div>
          <div className="font-data text-sm font-medium text-text-heading mt-1">
            {trade.exit_price ? formatCurrency(Number(trade.exit_price)) : '—'}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {trade.exit_time ? formatDate(trade.exit_time) : 'Open'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-text-muted uppercase tracking-wide">Qty</div>
          <div className="font-data text-sm font-medium text-text-heading mt-1">{trade.quantity}</div>
        </div>
        <div>
          <div className="text-[11px] text-text-muted uppercase tracking-wide">Stop</div>
          <div className="font-data text-sm font-medium text-text-heading mt-1">
            {trade.stop_price ? formatCurrency(Number(trade.stop_price)) : '—'}
          </div>
          {trade.target_price && (
            <div className="text-[11px] text-text-muted mt-1">Target: {formatCurrency(Number(trade.target_price))}</div>
          )}
        </div>
      </div>

      {/* Chart Gallery */}
      <div className="mb-6">
        <div className="font-display text-sm text-text-heading mb-3">Chart Gallery</div>
        <ChartGallery chartImages={trade.chart_images ?? undefined} />
      </div>

      {/* Tags */}
      <div className="mb-6">
        <div className="font-display text-sm text-text-heading mb-3">Review Tags</div>
        <TagSelector selected={tags} onChange={(t) => { setReviewError(null); setTags(t) }} />
      </div>

      {/* Post-trade Notes */}
      <div className="mb-6">
        <label className="block font-display text-sm text-text-heading mb-2">Post-trade Notes</label>
        <textarea
          value={notes}
          onChange={(e) => { setReviewError(null); setNotes(e.target.value) }}
          placeholder="What went well? What would you do differently?"
          rows={4}
          className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[6rem]"
        />
      </div>

      {/* Inline error */}
      {reviewError && (
        <div className="mb-5 text-sm text-loss bg-loss-faint border border-loss/20 rounded-lg px-3 py-2">
          {reviewError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          onClick={handleReview}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 min-w-[140px]"
        >
          <CheckCircle2 className="w-4 h-4" />
          {isSubmitting ? 'Saving...' : 'Review Done'}
        </button>

        {onNext && (
          <button
            onClick={onNext}
            disabled={isLast}
            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50"
          >
            {isLast ? 'All caught up' : (
              <>
                Next Trade
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
