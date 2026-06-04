import { cn } from '@/new-ui'
import type { CalendarDay } from '@/types'
import { todaySessionDate, weekdayFromSessionDate } from '@/utils/tradeDates'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Monday-first column index (0=Mon .. 6=Sun) for a YYYY-MM-DD date. */
function mondayFirstIndex(isoDate: string): number {
  return (weekdayFromSessionDate(isoDate) + 6) % 7
}

function parseNet(value: string | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function pnlTone(day: CalendarDay): 'profit' | 'loss' | 'neutral' {
  if (day.closed_count === 0) return 'neutral'
  const net = parseNet(day.net_pnl)
  if (net > 0) return 'profit'
  if (net < 0) return 'loss'
  return 'neutral'
}

function compactMoney(value: string | null | undefined): string {
  const n = parseNet(value)
  if (n === 0) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}k`
  return `${sign}₹${abs.toFixed(0)}`
}

interface CalendarGridProps {
  days: CalendarDay[]
  selectedDate: string | null
  onSelectDay: (day: CalendarDay) => void
}

export function CalendarGrid({ days, selectedDate, onSelectDay }: CalendarGridProps) {
  const today = todaySessionDate()
  const leadingBlanks = days.length > 0 ? mondayFirstIndex(days[0].date) : 0

  return (
    <div className="tjv3-cal__grid-wrap">
      <div className="tjv3-cal__weekdays" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="tjv3-cal__weekday" role="columnheader">
            {label}
          </div>
        ))}
      </div>
      <div className="tjv3-cal__grid" role="grid">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="tjv3-cal__cell tjv3-cal__cell--blank" aria-hidden="true" />
        ))}
        {days.map((day) => {
          const tone = pnlTone(day)
          const dayNum = Number(day.date.slice(8, 10))
          const isToday = day.date === today
          const isSelected = day.date === selectedDate
          const hasWarning = day.warnings.length > 0
          return (
            <button
              key={day.date}
              type="button"
              role="gridcell"
              onClick={() => onSelectDay(day)}
              className={cn(
                'tjv3-cal__cell',
                `tjv3-cal__cell--${tone}`,
                isToday && 'tjv3-cal__cell--today',
                isSelected && 'tjv3-cal__cell--selected',
              )}
              aria-label={`${day.date}: ${day.trade_count} trades, net ${day.net_pnl}`}
            >
              <div className="tjv3-cal__cell-top">
                <span className="tjv3-cal__daynum">{dayNum}</span>
                <span className="tjv3-cal__dots">
                  {day.journal_done && <span className="tjv3-cal__dot tjv3-cal__dot--journal" title="Journal entry" />}
                  {hasWarning && <span className="tjv3-cal__dot tjv3-cal__dot--warning" title="Warnings" />}
                </span>
              </div>
              {day.trade_count > 0 ? (
                <div className="tjv3-cal__cell-body">
                  <div className={cn('tjv3-cal__pnl', `tjv3-tone-${tone}`)}>{compactMoney(day.net_pnl)}</div>
                  <div className="tjv3-cal__count">{day.trade_count}T</div>
                </div>
              ) : (
                <div className="tjv3-cal__cell-body tjv3-cal__cell-body--empty" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
