import { Badge, DataList, DataRow, Panel, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { getTradeNotes, safeText } from '../utils/tradeDetailV3Formatters'
import { isReviewPending } from '../../trades/utils/tradesV3Metrics'

interface NotesReviewPanelProps {
  trade: ApiTrade
}

export function NotesReviewPanel({ trade }: NotesReviewPanelProps) {
  const reviewPending = isReviewPending(trade)
  const reviewStatus = trade.review_notes?.trim()
    ? 'Reviewed'
    : reviewPending
      ? 'Pending'
      : 'Unavailable'

  return (
    <Panel
      title="Notes and review"
      description="Read-only notes and review state. Editing stays in legacy flows for M2/N5."
      action={<Badge variant={reviewPending ? 'warning' : 'neutral'}>{reviewStatus}</Badge>}
    >
      <DataList>
        <DataRow title="Trade notes" trailing={<Value value={safeText(trade.notes, 'No trade notes')} />} />
        <DataRow title="Review notes" trailing={<Value value={getTradeNotes(trade)} />} />
        <DataRow title="Review status" trailing={<Value value={reviewStatus} />} />
        <DataRow title="Mood / emotion" trailing={<Value value="Unavailable" />} />
        <DataRow title="Lessons learned" trailing={<Value value="Unavailable" />} />
      </DataList>
    </Panel>
  )
}
