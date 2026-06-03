import { todaySessionDate } from '@/utils/tradeDates'

export type ReportPeriod = 'today' | 'week' | 'month' | '30d' | '90d'

export const REPORT_PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

export function reportPeriodToRange(period: ReportPeriod, today = todaySessionDate()): [string, string] {
  if (period === 'today') return [today, today]
  if (period === 'week') {
    const [y, m, d] = today.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dow = date.getUTCDay()
    date.setUTCDate(date.getUTCDate() - (dow === 0 ? 6 : dow - 1))
    return [date.toISOString().slice(0, 10), today]
  }
  if (period === 'month') return [`${today.slice(0, 7)}-01`, today]
  const days = period === '90d' ? 90 : 30
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - days)
  return [date.toISOString().slice(0, 10), today]
}

export function getPeriodLabel(period: ReportPeriod): string {
  return REPORT_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period
}
