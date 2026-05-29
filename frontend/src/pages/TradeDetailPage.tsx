import { useTradeQuery } from '@/hooks/useTradeMutation'
import { useAppStore } from '@/store/appStore'
import { TradeDetailContent } from '@/components/trades/TradeDetailContent'
import { FileText } from 'lucide-react'
import { ErrorState, LoadingState } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'

interface TradeDetailPageProps {
  tradeId: number
}

export function TradeDetailPage({ tradeId }: TradeDetailPageProps) {
  const closeTradeForm = useAppStore((s) => s.closeTradeForm)
  const { data: trade, isLoading, error } = useTradeQuery(tradeId)

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Trade Detail" subtitle="Loading trade snapshot." icon={FileText} onBack={closeTradeForm} />
        <LoadingState variant="page" />
      </PageShell>
    )
  }

  if (error || !trade) {
    return (
      <PageShell>
        <PageHeader title="Trade Detail" subtitle="Trade unavailable." icon={FileText} onBack={closeTradeForm} />
        <ErrorState
          title="Trade not found"
          message="This trade may have been deleted or is no longer accessible."
          onRetry={closeTradeForm}
          compact
        />
      </PageShell>
    )
  }

  return (
    <PageShell className="space-y-[var(--page-gap)]">
      <PageHeader title={trade.symbol} subtitle={trade.setup ?? 'Trade detail'} icon={FileText} onBack={closeTradeForm} />
      <TradeDetailContent trade={trade} />
    </PageShell>
  )
}
