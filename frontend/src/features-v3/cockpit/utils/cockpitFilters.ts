import type { ApiTrade } from '@/types'
import { getTradeSessionDate, todaySessionDate } from '@/utils/tradeDates'
import type { CockpitPeriod } from '../types'

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfWeekKey(todayKey: string): string {
  const [year, month, day] = todayKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayIndex = date.getUTCDay()
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex
  date.setUTCDate(date.getUTCDate() + mondayOffset)
  return toDateKey(date)
}

export function excludeDeletedTrades(trades: ApiTrade[]): ApiTrade[] {
  return trades.filter((trade) => trade.status !== 'deleted')
}

export function isOpenTrade(trade: ApiTrade): boolean {
  if (trade.status === 'deleted') return false
  const remaining = Number(trade.remaining_qty ?? trade.quantity)
  return trade.status === 'open' || (Number.isFinite(remaining) && remaining > 0 && trade.status !== 'closed')
}

export function isClosedTrade(trade: ApiTrade): boolean {
  return trade.status === 'closed'
}

export function filterTradesByPeriod(trades: ApiTrade[], period: CockpitPeriod, todayKey = todaySessionDate()): ApiTrade[] {
  if (period === 'all') return trades

  const monthStart = `${todayKey.slice(0, 7)}-01`
  const weekStart = startOfWeekKey(todayKey)

  return trades.filter((trade) => {
    const sessionDate = getTradeSessionDate(trade)
    if (!sessionDate) return false
    if (period === 'today') return sessionDate === todayKey
    if (period === 'week') return sessionDate >= weekStart && sessionDate <= todayKey
    return sessionDate >= monthStart && sessionDate <= todayKey
  })
}

export function getPeriodLabel(period: CockpitPeriod): string {
  if (period === 'today') return 'Today'
  if (period === 'week') return 'This week'
  if (period === 'month') return 'This month'
  return 'All time'
}
