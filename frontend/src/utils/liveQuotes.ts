import type { LiveQuote } from '@/types'

export type LiveQuoteDisplayStatus = 'LIVE' | 'STALE' | 'MARKET CLOSED' | 'NO DATA'

const MARKET_TIME_ZONE = 'Asia/Kolkata'
const LIVE_THRESHOLD_SECONDS = 90
const STALE_THRESHOLD_SECONDS = 120

function getIstDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon'
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return { weekday, hour, minute }
}

export function isIndianMarketOpen(now = new Date()) {
  const { weekday, hour, minute } = getIstDateParts(now)
  if (weekday === 'Sat' || weekday === 'Sun') return false

  const totalMinutes = hour * 60 + minute
  return totalMinutes >= (9 * 60 + 15) && totalMinutes <= (15 * 60 + 30)
}

export function getLiveQuoteDisplayStatus(
  quote: LiveQuote | undefined,
  now = new Date(),
): LiveQuoteDisplayStatus {
  if (!quote?.ltp || !quote.updated_at) {
    return 'NO DATA'
  }

  if (!isIndianMarketOpen(now)) {
    return 'MARKET CLOSED'
  }

  const updatedAt = new Date(quote.updated_at)
  if (Number.isNaN(updatedAt.getTime())) {
    return 'NO DATA'
  }

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / 1000))
  if (ageSeconds <= LIVE_THRESHOLD_SECONDS) {
    return 'LIVE'
  }
  if (ageSeconds > STALE_THRESHOLD_SECONDS) {
    return 'STALE'
  }
  return 'LIVE'
}

export function getLiveQuoteDisplayClass(status: LiveQuoteDisplayStatus) {
  if (status === 'LIVE') return 'text-profit'
  if (status === 'STALE') return 'text-amber-400'
  if (status === 'MARKET CLOSED') return 'text-text-muted'
  return 'text-text-faint'
}
