import { cn } from '@/new-ui'
import type { JournalWeekDay } from '../hooks/useJournalV3Data'
import { todaySessionDate } from '@/utils/tradeDates'

function excerpt(text: string | null, max = 80): string {
  if (!text) return ''
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

interface WeeklyCardsProps {
  days: JournalWeekDay[]
  selectedDate: string | null
  onSelectDay: (date: string) => void
}

export function WeeklyCards({ days, selectedDate, onSelectDay }: WeeklyCardsProps) {
  const today = todaySessionDate()
  return (
    <div className="tjv3-journal__cards">
      {days.map((day) => {
        const filled = day.journal != null
        const note = excerpt(day.journal?.pre_trade_notes ?? day.journal?.post_trade_notes ?? null)
        const isToday = day.date === today
        const isSelected = day.date === selectedDate
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDay(day.date)}
            className={cn(
              'tjv3-journal__card',
              filled && 'tjv3-journal__card--filled',
              isSelected && 'tjv3-journal__card--selected',
              isToday && 'tjv3-journal__card--today',
            )}
          >
            <div className="tjv3-journal__card-top">
              <span className="tjv3-journal__card-day">{day.weekday}</span>
              <span className="tjv3-journal__card-date">{day.date.slice(5)}</span>
            </div>
            <div className="tjv3-journal__card-body">
              {filled ? (
                <span className="tjv3-journal__card-note">{note || 'Journal entry saved'}</span>
              ) : (
                <span className="tjv3-journal__card-empty">No entry</span>
              )}
            </div>
            <div className="tjv3-journal__card-foot">
              {day.journal?.discipline_rating != null && (
                <span className="tjv3-journal__card-rating">D {day.journal.discipline_rating}/5</span>
              )}
              {filled && <span className="tjv3-journal__card-dot" aria-hidden="true" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
