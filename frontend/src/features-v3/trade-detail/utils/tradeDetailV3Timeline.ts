import type { ApiTrade, PartialExit, StopHistoryEntry, TimelineEvent } from '@/types'
import { formatPrice, formatCurrency } from '@/utils/format'
import { safeNumber } from '../../trades/utils/tradesV3Formatters'
import type { TradeDetailTimelineEvent } from '../types'

function parseTime(value: string | null | undefined): number {
  if (!value) return Number.NaN
  return new Date(value).getTime()
}

export function buildTradeDetailTimeline(
  trade: ApiTrade,
  stopHistory: StopHistoryEntry[],
  partialExits: PartialExit[],
  timelineEvents: TimelineEvent[] = [],
): TradeDetailTimelineEvent[] {
  const events: TradeDetailTimelineEvent[] = []

  if (trade.entry_time) {
    events.push({
      id: 'entry',
      timestamp: trade.entry_time,
      label: 'Entry',
      detail: `${trade.symbol} @ ${formatPrice(Number(trade.entry_price))}`,
      kind: 'entry',
    })
  }

  for (const stop of stopHistory) {
    events.push({
      id: `stop-${stop.id}`,
      timestamp: stop.timestamp,
      label: `Stop moved (${stop.stop_type})`,
      detail: formatPrice(Number(stop.price)),
      kind: 'stop',
      type: 'stop_updated',
      sourceId: stop.id,
    })
  }

  for (const exit of partialExits) {
    const pnl = safeNumber(exit.realized_pnl)
    const pnlText = pnl == null ? '' : ` · ${pnl >= 0 ? '+' : ''}${formatCurrency(Math.abs(pnl))}`
    events.push({
      id: `partial-${exit.id}`,
      timestamp: exit.exit_time,
      label: 'Partial exit',
      detail: `${exit.qty} @ ${formatPrice(Number(exit.exit_price))}${pnlText}`,
      kind: 'partial',
    })
  }

  if (trade.exit_time) {
    const exitPrice = trade.weighted_avg_exit_price ?? trade.exit_price
    events.push({
      id: 'exit',
      timestamp: trade.exit_time,
      label: 'Exit / closed',
      detail: exitPrice ? formatPrice(Number(exitPrice)) : 'Closed',
      kind: 'exit',
    })
  }

  for (const event of timelineEvents) {
    const detail = event.new_value ?? event.note ?? event.old_value ?? ''
    if (!detail && event.event_type === 'note_added') continue
    events.push({
      id: `timeline-${event.id}`,
      timestamp: event.timestamp,
      label: event.event_type.replace(/_/g, ' '),
      detail: detail || 'Event recorded',
      kind: 'timeline',
    })
  }

  if (trade.review_notes?.trim()) {
    events.push({
      id: 'review',
      timestamp: trade.updated_at ?? trade.exit_time ?? trade.entry_time,
      label: 'Review notes',
      detail: 'Review notes recorded',
      kind: 'review',
    })
  } else if (trade.status === 'closed') {
    events.push({
      id: 'review-pending',
      timestamp: trade.exit_time ?? trade.entry_time,
      label: 'Review pending',
      detail: 'No review notes yet',
      kind: 'review',
    })
  }

  if (trade.status === 'deleted') {
    events.push({
      id: 'deleted',
      timestamp: trade.updated_at ?? trade.exit_time ?? trade.entry_time,
      label: 'Deleted',
      detail: 'Trade marked deleted',
      kind: 'status',
    })
  }

  return events
    .filter((event) => Number.isFinite(parseTime(event.timestamp)))
    .sort((a, b) => parseTime(a.timestamp) - parseTime(b.timestamp))
}
