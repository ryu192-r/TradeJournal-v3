import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getDailyChargesSummary } from '@/lib/endpoints'
import { todaySessionDate } from '@/utils/tradeDates'
import type { CockpitPeriod } from '../types'

function periodToRange(period: CockpitPeriod): [string, string] {
  const today = todaySessionDate()
  if (period === 'today') return [today, today]
  if (period === 'week') {
    const [y, m, d] = today.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dayIndex = date.getUTCDay()
    const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex
    date.setUTCDate(date.getUTCDate() + mondayOffset)
    return [date.toISOString().slice(0, 10), today]
  }
  if (period === 'month') return [`${today.slice(0, 7)}-01`, today]
  // all time: bounded to last 90 days to avoid unbounded query
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - 90)
  return [date.toISOString().slice(0, 10), today]
}

export function useDailyChargesSummary(period: CockpitPeriod, enabled = true) {
  const [start, end] = useMemo(() => periodToRange(period), [period])
  return useQuery({
    queryKey: ['daily-charges', 'summary', period, start, end],
    queryFn: () => getDailyChargesSummary(start, end),
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}
