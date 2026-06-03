import { DataList, DataRow, EmptyState, MoneyValue, Panel } from '@/new-ui'
import { getTradeSessionDate } from '@/utils/tradeDates'
import type { ApiTrade } from '@/types'
import { safeNumber } from '../utils/cockpitMetrics'

export function CalendarSnapshot({ trades }: { trades: ApiTrade[] }) {
  const days = [...trades.reduce((map, trade) => {
    const day = getTradeSessionDate(trade)
    if (!day || trade.status === 'deleted') return map
    const current = map.get(day) ?? { day, count: 0, gross: 0 }
    current.count += 1
    const pnl = safeNumber(trade.pnl)
    if (trade.status === 'closed' && pnl != null) current.gross += pnl + (safeNumber(trade.fees) ?? 0)
    map.set(day, current)
    return map
  }, new Map<string, { day: string; count: number; gross: number }>()).values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 5)

  return (
    <Panel title="Calendar Snapshot" description="Recent session rows. Gross/pre-charges only.">
      {days.length === 0 ? (
        <EmptyState title="Calendar snapshot pending" description="Daily net P&L calendar will unlock after the daily charges ledger." />
      ) : (
        <DataList>
          {days.map((day) => (
            <DataRow key={day.day} title={day.day} subtitle={`${day.count} trade${day.count === 1 ? '' : 's'} · gross/pre-charges`} trailing={<MoneyValue value={day.gross} tone="auto" />} />
          ))}
        </DataList>
      )}
    </Panel>
  )
}
