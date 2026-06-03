import { Badge, Button, DataList, DataRow, Panel, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { getTradeNotes, safeText } from '../utils/tradeDetailV3Formatters'
import { isReviewPending } from '../../trades/utils/tradesV3Metrics'
import { useAppStore } from '@/store/appStore'

interface NotesReviewPanelProps {
  trade: ApiTrade
}

export function NotesReviewPanel({ trade }: NotesReviewPanelProps) {
  const openReviewTrade = useAppStore((s) => s.openReviewTrade)
  const reviewPending = isReviewPending(trade)
  const reviewed = Boolean(trade.review_notes?.trim())
  const reviewStatus = reviewed
    ? 'Reviewed'
    : reviewPending
      ? 'Pending'
      : 'Unavailable'
  const isClosed = trade.status === 'closed'

  return (
    <Panel
      title="Notes and review"
      description="Review notes and status. Open the review workspace to edit."
      action={<Badge variant={reviewPending ? 'warning' : 'neutral'}>{reviewStatus}</Badge>}
    >
      <DataList>
        <DataRow title="Trade notes" trailing={<Value value={safeText(trade.notes, 'No trade notes')} />} />
        <DataRow title="Review notes" trailing={<Value value={getTradeNotes(trade)} />} />
        <DataRow title="Review status" trailing={<Value value={reviewStatus} />} />
        <DataRow title="Mood / emotion" trailing={<Value value="Not set" />} />
        <DataRow title="Lessons learned" trailing={<Value value="Not set" />} />
      </DataList>
      {isClosed && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <Button variant="primary" onClick={() => openReviewTrade(trade.id)}>
            {reviewed ? 'Continue review' : 'Review trade'}
          </Button>
        </div>
      )}
    </Panel>
  )
}
