import { useTradeQuery } from '@/hooks/useTradeMutation'
import { useAppStore } from '@/store/appStore'
import { TradeDetailContent } from '@/components/trades/TradeDetailContent'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ErrorState } from '@/components/ui'

interface TradeDetailPageProps {
  tradeId: number
}

export function TradeDetailPage({ tradeId }: TradeDetailPageProps) {
  const closeTradeForm = useAppStore((s) => s.closeTradeForm)
  const { data: trade, isLoading, error } = useTradeQuery(tradeId)

  if (isLoading) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-1.5 text-sm text-text-muted mb-4">
          <button onClick={closeTradeForm} className="inline-flex items-center gap-1.5 hover:text-text-heading transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !trade) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-1.5 text-sm text-text-muted mb-4">
          <button onClick={closeTradeForm} className="inline-flex items-center gap-1.5 hover:text-text-heading transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
        <ErrorState
          title="Trade not found"
          message="This trade may have been deleted or is no longer accessible."
          onRetry={closeTradeForm}
          compact
        />
      </div>
    )
  }

  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-1.5 text-sm text-text-muted">
        <button
          onClick={closeTradeForm}
          className="inline-flex items-center gap-1.5 hover:text-text-heading transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to trades
        </button>
      </div>
      <TradeDetailContent trade={trade} />
    </div>
  )
}
