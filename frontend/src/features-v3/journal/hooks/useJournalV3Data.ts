import { useCallback, useMemo, useState } from 'react'
import { useWeeklyJournalsQuery, useWeeklyJournalStatsQuery } from '@/hooks/useJournalMutation'
import type { DailyJournal, WeeklyJournalStats } from '@/types'
import { todaySessionDate } from '@/utils/tradeDates'

/** Monday (YYYY-MM-DD) of the week containing isoDate. */
export function weekStartMonday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay() // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1
  date.setUTCDate(date.getUTCDate() - back)
  return date.toISOString().slice(0, 10)
}

/** Shift a YYYY-MM-DD by delta days. */
export function shiftDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + delta))
  return date.toISOString().slice(0, 10)
}

export interface JournalWeekDay {
  date: string
  weekday: string
  journal: DailyJournal | null
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export interface JournalV3Data {
  weekStart: string
  days: JournalWeekDay[]
  stats: WeeklyJournalStats | undefined
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  goPrevWeek: () => void
  goNextWeek: () => void
  goThisWeek: () => void
}

export function useJournalV3Data(enabled = true): JournalV3Data {
  const [weekStart, setWeekStart] = useState<string>(() => weekStartMonday(todaySessionDate()))

  const weekly = useWeeklyJournalsQuery(enabled ? weekStart : '')
  const stats = useWeeklyJournalStatsQuery(enabled ? weekStart : '')

  const days = useMemo<JournalWeekDay[]>(() => {
    const byDate = new Map<string, DailyJournal>()
    for (const j of weekly.data ?? []) byDate.set(j.date, j)
    return WEEKDAY_NAMES.map((weekday, i) => {
      const date = shiftDays(weekStart, i)
      return { date, weekday, journal: byDate.get(date) ?? null }
    })
  }, [weekly.data, weekStart])

  const goPrevWeek = useCallback(() => setWeekStart((w) => shiftDays(w, -7)), [])
  const goNextWeek = useCallback(() => setWeekStart((w) => shiftDays(w, 7)), [])
  const goThisWeek = useCallback(() => setWeekStart(weekStartMonday(todaySessionDate())), [])

  return {
    weekStart,
    days,
    stats: stats.data,
    isLoading: enabled && weekly.isLoading && !weekly.data,
    isFetching: enabled && (weekly.isFetching || stats.isFetching),
    error: enabled ? (weekly.error as Error | null) : null,
    goPrevWeek,
    goNextWeek,
    goThisWeek,
  }
}
