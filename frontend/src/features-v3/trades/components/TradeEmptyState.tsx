import { EmptyState } from '@/new-ui'
import { ListChecks } from 'lucide-react'

export function TradeEmptyState() {
  return (
    <EmptyState
      icon={<ListChecks aria-hidden="true" />}
      title="No trades found"
      description="Try changing filters or add trades from the existing trade flow."
    />
  )
}
