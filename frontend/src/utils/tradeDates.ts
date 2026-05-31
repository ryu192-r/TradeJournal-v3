/**
 * Canonical NSE/BSE session date helpers.
 * entry_time → calendar placement; exit_time → realized PnL buckets.
 * Naive strings = IST wall clock. Z/offset strings convert to Asia/Kolkata.
 */

const EXCHANGE_TZ = 'Asia/Kolkata'

type TradeLike = { entry_time?: string | null }

function hasExplicitTimezone(raw: string): boolean {
  return /[Zz]$|[+-]\d{2}:\d{2}$/.test(raw)
}

function sessionDateFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function sessionDateFromInstant(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EXCHANGE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 1970)
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1)
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1)
  return sessionDateFromParts(year, month, day)
}

function sessionDateFromNaiveString(raw: string): string | null {
  const stripped = raw.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '')
  const m = stripped.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return sessionDateFromParts(Number(m[1]), Number(m[2]), Number(m[3]))
}

function resolveRawTime(tradeOrTime: TradeLike | string | null | undefined): string | null {
  if (!tradeOrTime) return null
  if (typeof tradeOrTime === 'string') return tradeOrTime
  return tradeOrTime.entry_time ?? null
}

/** Session date (YYYY-MM-DD) from entry_time — calendar, filters, journal. */
export function getTradeSessionDate(
  tradeOrTime: TradeLike | string | null | undefined,
): string | null {
  const raw = resolveRawTime(tradeOrTime)
  if (!raw) return null
  if (hasExplicitTimezone(raw)) {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return sessionDateFromInstant(d)
  }
  return sessionDateFromNaiveString(raw)
}

/** Realized PnL session date from exit/entry/created timestamps. */
export function getRealizedSessionDate(
  exitTime?: string | null,
  entryTime?: string | null,
  createdAt?: string | null,
): string | null {
  const raw = exitTime ?? entryTime ?? createdAt ?? null
  if (!raw) return null
  if (hasExplicitTimezone(raw)) {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return sessionDateFromInstant(d)
  }
  return sessionDateFromNaiveString(raw)
}

/** Today in exchange timezone (not UTC). */
export function todaySessionDate(): string {
  return sessionDateFromInstant(new Date())
}

/** 0=Sunday .. 6=Saturday — browser-TZ-safe calendar grid alignment. */
export function weekdayFromSessionDate(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function tradeMatchesSessionDate(
  trade: TradeLike,
  sessionDate: string,
): boolean {
  return getTradeSessionDate(trade) === sessionDate
}
