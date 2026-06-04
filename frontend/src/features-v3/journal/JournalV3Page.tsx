import { useEffect, useState } from 'react'
import { ErrorState, LoadingState, Page, Stack } from '@/new-ui'
import { todaySessionDate } from '@/utils/tradeDates'
import { JournalWeekHeader } from './components/JournalWeekHeader'
import { WeeklyCards } from './components/WeeklyCards'
import { JournalDayEditor } from './components/JournalDayEditor'
import { useJournalV3Data } from './hooks/useJournalV3Data'
import './journal.css'

interface JournalV3PageProps {
  dataEnabled?: boolean
}

export function JournalV3Page({ dataEnabled = true }: JournalV3PageProps) {
  const data = useJournalV3Data(dataEnabled)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Default selection: today if in this week, else first day of week.
  useEffect(() => {
    if (selectedDate && data.days.some((d) => d.date === selectedDate)) return
    const today = todaySessionDate()
    const inWeek = data.days.find((d) => d.date === today)
    setSelectedDate(inWeek ? today : data.days[0]?.date ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.weekStart, data.days.length])

  if (data.isLoading) {
    return (
      <Page title="Journal">
        <LoadingState label="Loading journal…" lines={6} />
      </Page>
    )
  }

  if (data.error) {
    return (
      <Page title="Journal">
        <ErrorState title="Could not load journal" description={data.error.message} />
      </Page>
    )
  }

  return (
    <Page
      title="Journal"
      subtitle="Weekly journal coverage with a single-day editor for notes, mood, and discipline."
    >
      <Stack gap="lg">
        <JournalWeekHeader
          weekStart={data.weekStart}
          stats={data.stats}
          isFetching={data.isFetching}
          onPrev={data.goPrevWeek}
          onNext={data.goNextWeek}
          onThisWeek={data.goThisWeek}
        />

        <div className="tjv3-journal__layout">
          <div className="tjv3-journal__cards-col">
            <WeeklyCards days={data.days} selectedDate={selectedDate} onSelectDay={setSelectedDate} />
          </div>
          <div className="tjv3-journal__editor-col">
            {selectedDate ? (
              <JournalDayEditor key={selectedDate} date={selectedDate} />
            ) : null}
          </div>
        </div>
      </Stack>
    </Page>
  )
}
