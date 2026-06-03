import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getDailyChargesSummary } from '@/lib/endpoints'
import { todaySessionDate } from '@/utils/tradeDates'

export type ChargesPeriod = 'today' | 'week' | 'month' | '30d' | '90d'

function periodToRange(period: ChargesPeriod): [string, string] {
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
  // 30d / 90d (and implicit all-time bounded to 90)
  const days = period === '90d' ? 90 : 30
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - days)
  return [date.toISOString().slice(0, 10), today]
}

export function useChargesLedgerData(enabled = true) {
  const [period, setPeriod] = useState<ChargesPeriod>('30d')
  const [start, end] = useMemo(() => periodToRange(period), [period])

  const query = useQuery({
    queryKey: ['daily-charges', 'summary', period, start, end],
    queryFn: () => getDailyChargesSummary(start, end),
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  return {
    period,
    setPeriod,
    start,
    end,
    ...query,
  }
}
