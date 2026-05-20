import { useTradeQuery } from '@/hooks/useTradeMutation'
import { useAppStore } from '@/store/appStore'
import { TradeDetailContent } from '@/components/trades/TradeDetailContent'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface TradeDetailPageProps {
  tradeId: number
}

export function TradeDetailPage({ tradeId }: TradeDetailPageProps) {
  const closeTradeForm = useAppStore((s) => s.closeTradeForm)
  const { data: trade, isLoading, error } = useTradeQuery(tradeId)

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }

  if (error || !trade) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)]">
        <button
          onClick={closeTradeForm}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-heading transition-colors cursor-pointer mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to trades
        </button>
        <p className="text-sm text-loss">Trade not found or has been deleted.</p>
      </div>
    )
  }

  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
      <button
        onClick={closeTradeForm}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-heading transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to trades
      </button>
      <TradeDetailContent trade={trade} />
    </div>
  )
}