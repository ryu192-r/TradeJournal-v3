import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Grid, MetricCard, MoneyValue, PercentValue, RMultipleValue, Value } from '@/new-ui'
import type { WeeklyJournalStats } from '@/types'
import { shiftDays } from '../hooks/useJournalV3Data'

function rangeLabel(weekStart: string): string {
  const end = shiftDays(weekStart, 4)
  return `${weekStart} → ${end}`
}

interface JournalWeekHeaderProps {
  weekStart: string
  stats?: WeeklyJournalStats
  isFetching?: boolean
  onPrev: () => void
  onNext: () => void
  onThisWeek: () => void
}

export function JournalWeekHeader({ weekStart, stats, isFetching, onPrev, onNext, onThisWeek }: JournalWeekHeaderProps) {
  return (
    <div className="tjv3-journal__header">
      <div className="tjv3-journal__header-bar">
        <div className="tjv3-journal__nav">
          <Button variant="secondary" size="sm" onClick={onPrev} aria-label="Previous week">
            <ChevronLeft aria-hidden="true" size={16} />
          </Button>
          <div className="tjv3-journal__range">
            {rangeLabel(weekStart)}
            {isFetching ? <span className="tjv3-journal__sync" aria-hidden="true" /> : null}
          </div>
          <Button variant="secondary" size="sm" onClick={onNext} aria-label="Next week">
            <ChevronRight aria-hidden="true" size={16} />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={onThisWeek}>
          This week
        </Button>
      </div>

      <Grid minColumnWidth="9rem">
        <MetricCard label="Trades" value={<Value value={String(stats?.trade_count ?? 0)} />} />
        <MetricCard label="Total P&L" value={<MoneyValue value={stats?.total_pnl ?? null} tone="auto" />} />
        <MetricCard label="Win rate" value={<PercentValue value={stats?.win_rate ?? null} />} />
        <MetricCard label="Avg R" value={<RMultipleValue value={stats?.avg_r ?? null} tone="auto" />} />
      </Grid>
    </div>
  )
}
