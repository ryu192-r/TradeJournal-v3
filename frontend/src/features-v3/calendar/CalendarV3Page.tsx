import { useState } from 'react'
import { ErrorState, LoadingState, Page, Stack } from '@/new-ui'
import { useAppStore } from '@/store/appStore'
import type { CalendarDay } from '@/types'
import { CalendarHeader } from './components/CalendarHeader'
import { CalendarGrid } from './components/CalendarGrid'
import { CalendarDayDetail } from './components/CalendarDayDetail'
import { useCalendarV3Data } from './hooks/useCalendarV3Data'
import './calendar.css'

interface CalendarV3PageProps {
  dataEnabled?: boolean
}

export function CalendarV3Page({ dataEnabled = true }: CalendarV3PageProps) {
  const setActiveView = useAppStore((s) => s.setActiveView)
  const data = useCalendarV3Data(dataEnabled)
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null)

  if (data.isLoading) {
    return (
      <Page title="Calendar">
        <LoadingState label="Loading calendar…" lines={8} />
      </Page>
    )
  }

  if (data.error) {
    return (
      <Page title="Calendar">
        <ErrorState title="Could not load calendar" description={data.error.message} onRetry={() => void data.refresh()} />
      </Page>
    )
  }

  const days = data.payload?.days ?? []

  return (
    <Page
      title="Calendar"
      subtitle="Month view of trading sessions, realized P&L, and journal coverage."
    >
      <Stack gap="lg">
        <CalendarHeader
          month={data.month}
          summary={data.payload?.summary}
          isFetching={data.isFetching}
          onPrev={data.goPrevMonth}
          onNext={data.goNextMonth}
          onToday={data.goToday}
        />
        <CalendarGrid
          days={days}
          selectedDate={selectedDay?.date ?? null}
          onSelectDay={setSelectedDay}
        />
      </Stack>

      <CalendarDayDetail
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        onOpenJournal={() => setActiveView('journal')}
      />
    </Page>
  )
}
