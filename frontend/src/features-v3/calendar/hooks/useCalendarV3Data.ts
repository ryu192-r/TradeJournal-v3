import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCalendarMonth } from '@/lib/endpoints'
import type { CalendarMonthPayload } from '@/types'
import { todaySessionDate } from '@/utils/tradeDates'

/** Current month as YYYY-MM from exchange session today. */
function currentMonth(): string {
  return todaySessionDate().slice(0, 7)
}

/** Shift a YYYY-MM string by delta months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface CalendarV3Data {
  month: string
  payload?: CalendarMonthPayload
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  goPrevMonth: () => void
  goNextMonth: () => void
  goToday: () => void
  refresh: () => Promise<void>
}

export function useCalendarV3Data(enabled = true): CalendarV3Data {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState<string>(() => currentMonth())

  const query = useQuery<CalendarMonthPayload>({
    queryKey: ['calendar', 'month', month],
    queryFn: () => getCalendarMonth(month),
    enabled,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })

  const goPrevMonth = useCallback(() => setMonth((m) => shiftMonth(m, -1)), [])
  const goNextMonth = useCallback(() => setMonth((m) => shiftMonth(m, 1)), [])
  const goToday = useCallback(() => setMonth(currentMonth()), [])

  const refresh = useCallback(async () => {
    if (!enabled) return
    await queryClient.invalidateQueries({ queryKey: ['calendar', 'month', month] })
  }, [enabled, queryClient, month])

  return {
    month,
    payload: query.data,
    isLoading: enabled && query.isLoading && !query.data,
    isFetching: enabled && query.isFetching,
    error: enabled ? (query.error as Error | null) : null,
    goPrevMonth,
    goNextMonth,
    goToday,
    refresh,
  }
}
