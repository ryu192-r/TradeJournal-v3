import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Grid, MetricCard, MoneyValue, Value } from '@/new-ui'
import type { CalendarMonthPayload } from '@/types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return `${MONTH_NAMES[m - 1]} ${y}`
}

interface CalendarHeaderProps {
  month: string
  summary?: CalendarMonthPayload['summary']
  isFetching?: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function CalendarHeader({ month, summary, isFetching, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="tjv3-cal__header">
      <div className="tjv3-cal__header-bar">
        <div className="tjv3-cal__nav">
          <Button variant="secondary" size="sm" onClick={onPrev} aria-label="Previous month">
            <ChevronLeft aria-hidden="true" size={16} />
          </Button>
          <div className="tjv3-cal__month-label">
            {monthLabel(month)}
            {isFetching ? <span className="tjv3-cal__month-sync" aria-hidden="true" /> : null}
          </div>
          <Button variant="secondary" size="sm" onClick={onNext} aria-label="Next month">
            <ChevronRight aria-hidden="true" size={16} />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={onToday}>
          Today
        </Button>
      </div>

      <Grid minColumnWidth="9rem">
        <MetricCard label="Trades" value={<Value value={String(summary?.trade_count ?? 0)} />} />
        <MetricCard label="Closed" value={<Value value={String(summary?.closed_count ?? 0)} />} />
        <MetricCard label="Net P&L" value={<MoneyValue value={summary?.net_pnl ?? null} tone="auto" />} />
        <MetricCard label="Journal days" value={<Value value={String(summary?.journal_days ?? 0)} />} />
        <MetricCard
          label="Warning days"
          value={<Value value={String(summary?.warning_days ?? 0)} tone={summary && summary.warning_days > 0 ? 'warning' : 'neutral'} />}
        />
      </Grid>
    </div>
  )
}
