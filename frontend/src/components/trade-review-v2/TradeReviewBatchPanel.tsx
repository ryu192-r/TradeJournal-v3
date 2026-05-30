import { Loader2 } from 'lucide-react'
import { useTradeReviewBatchV2Query } from '@/hooks/useTradeReviewV2Query'
import { ErrorState } from '@/components/ui/StateComponents'
import { TradeReviewV2Card } from './TradeReviewV2Card'

export function TradeReviewBatchPanel({ limit = 10 }: { limit?: number }) {
  const { data, isLoading, isError, error } = useTradeReviewBatchV2Query(limit, true)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Batch review failed"
        message={error instanceof Error ? error.message : 'Could not load batch reviews.'}
        compact
      />
    )
  }

  if (!data || data.count === 0) {
    return <p className="text-[length:var(--text-sm)] text-text-muted py-4">No closed trades to review yet.</p>
  }

  return (
    <div className="space-y-[var(--page-gap)] min-w-0">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border border-border p-3">
          <p className="text-[10px] text-text-faint uppercase">Avg score</p>
          <p className="text-lg font-bold font-data text-text-heading">{data.summary.avg_score}</p>
        </div>
        <div className="rounded-xl border border-border p-3 col-span-1 sm:col-span-3 min-w-0">
          <p className="text-[10px] text-text-faint uppercase">Common mistakes</p>
          <p className="text-[length:var(--text-xs)] text-text-muted truncate">
            {data.summary.common_mistakes.length > 0
              ? data.summary.common_mistakes.map((m) => m.replace(/_/g, ' ')).join(', ')
              : 'None flagged'}
          </p>
        </div>
      </div>
      <div className="space-y-6">
        {data.reviews.map((review) => (
          <div key={review.trade_id} className="min-w-0">
            <p className="text-[length:var(--text-xs)] font-medium text-text-heading mb-2">
              #{review.trade_id} {review.symbol}
            </p>
            <TradeReviewV2Card review={review} />
          </div>
        ))}
      </div>
    </div>
  )
}
