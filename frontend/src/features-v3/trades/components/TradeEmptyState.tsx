import { EmptyState } from '@/new-ui'
import { ListChecks } from 'lucide-react'

interface TradeEmptyStateProps {
  loadedCount?: number
}

export function TradeEmptyState({ loadedCount = 0 }: TradeEmptyStateProps) {
  const hasLoadedTrades = loadedCount > 0

  return (
    <EmptyState
      icon={<ListChecks aria-hidden="true" />}
      title="No trades found"
      description={hasLoadedTrades
        ? `${loadedCount} trades loaded from the authenticated API. Current filters hide them.`
        : 'Your existing trades will appear here once loaded.'}
    />
  )
}
