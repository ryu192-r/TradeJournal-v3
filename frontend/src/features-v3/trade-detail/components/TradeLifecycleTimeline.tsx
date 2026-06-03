import { EmptyState, Panel, Stack, Value } from '@/new-ui'
import { Clock3 } from 'lucide-react'
import type { TradeDetailTimelineEvent } from '../types'
import { formatTradeDateTime } from '../utils/tradeDetailV3Formatters'

interface TradeLifecycleTimelineProps {
  events: TradeDetailTimelineEvent[]
}

export function TradeLifecycleTimeline({ events }: TradeLifecycleTimelineProps) {
  return (
    <Panel title="Lifecycle timeline" description="Chronological events from existing trade data only.">
      {events.length === 0 ? (
        <EmptyState
          icon={<Clock3 aria-hidden="true" />}
          title="No lifecycle events"
          description="Entry, stop moves, partial exits, and review state will appear here when recorded."
        />
      ) : (
        <Stack gap="sm">
          {events.map((event) => (
            <div key={event.id} className="tjv3-trade-detail__timeline-item">
              <div className="tjv3-trade-detail__timeline-meta">
                <Value value={event.label} />
                <span className="tjv3-trade-detail__timeline-time">{formatTradeDateTime(event.timestamp)}</span>
              </div>
              <div className="tjv3-trade-detail__timeline-detail">{event.detail}</div>
            </div>
          ))}
        </Stack>
      )}
    </Panel>
  )
}
