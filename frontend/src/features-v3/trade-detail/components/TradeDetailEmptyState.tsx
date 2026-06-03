import { EmptyState, ErrorState, LoadingState } from '@/new-ui'
import { FileSearch } from 'lucide-react'

interface TradeDetailEmptyStateProps {
  onBack: () => void
}

export function TradeDetailNotFoundState({ onBack }: TradeDetailEmptyStateProps) {
  return (
    <EmptyState
      icon={<FileSearch aria-hidden="true" />}
      title="Trade not found"
      description="This trade may have been deleted or is unavailable."
      action={
        <button type="button" className="tjv3-trade-detail__link-button" onClick={onBack}>
          Back to Trades
        </button>
      }
    />
  )
}

export function TradeDetailLoadingState() {
  return <LoadingState label="Loading trade detail" lines={10} />
}

export function TradeDetailErrorState({ onRetry, onBack }: { onRetry?: () => void; onBack: () => void }) {
  return (
    <div className="tjv3-trade-detail__state-stack">
      <ErrorState
        title="Could not load trade"
        description="Please retry or return to Trades."
        onRetry={onRetry}
      />
      <button type="button" className="tjv3-trade-detail__link-button" onClick={onBack}>
        Back to Trades
      </button>
    </div>
  )
}
