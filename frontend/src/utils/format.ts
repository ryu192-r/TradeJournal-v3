// Centralized format utilities for the trading journal
// All datetimes are naive IST — no timezone conversion anywhere.

/**
 * Parse a date/datetime input (string, Date, or number) into year/month/day/hour/minute components.
 * For naive IST strings (e.g. "2025-05-21T09:16:00"), extracts components directly — no timezone shift.
 * For Date objects or timestamps, uses local time (works correctly when browser is in IST).
 */
function extractComponents(input: Date | string | number): { year: number; month: number; day: number; hour: number; minute: number } {
  if (input instanceof Date) {
    return {
      year: input.getFullYear(),
      month: input.getMonth() + 1,
      day: input.getDate(),
      hour: input.getHours(),
      minute: input.getMinutes(),
    }
  }
  if (typeof input === 'number') {
    const d = new Date(input)
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    }
  }
  // String: strip any timezone suffix and extract components directly
  const s = String(input).replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2}))?/)
  if (m) {
    return {
      year: parseInt(m[1], 10),
      month: parseInt(m[2], 10),
      day: parseInt(m[3], 10),
      hour: m[4] ? parseInt(m[4], 10) : 0,
      minute: m[5] ? parseInt(m[5], 10) : 0,
    }
  }
  // Fallback: let JS Date parse it (local timezone)
  const d = new Date(s)
  if (isNaN(d.getTime())) {
    return { year: 1970, month: 1, day: 1, hour: 0, minute: 0 }
  }
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  }
}

/**
 * Format a date to DD-MM-YYYY string (naive IST — no conversion).
 */
export function formatDate(date: Date | string | number): string {
  const { day, month, year } = extractComponents(date)
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`
}

/**
 * Format a datetime to DD-MM-YYYY HH:mm string (naive IST — no conversion).
 */
export function formatDateTime(date: Date | string | number): string {
  const { day, month, year, hour, minute } = extractComponents(date)
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

/**
 * Format a number in Indian style: ₹ 1,50,000 or ₹ 1.5L or ₹ 1.2Cr
 */
export function formatCurrency(v: string | number, currency = 'INR') {
  const n = typeof v === 'number' ? v : (parseFloat(String(v).replace(/[₹$€£¥,]/g, '').replace(/(k|L|Cr)$/, '')) || 0);
  if (Number.isNaN(n)) return `${CURRENCY_SYMBOLS[currency] || ''}0`;
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  if (currency !== 'INR') {
    return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  // Indian formatting: lakh / crore
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (absN >= 1_00_00_000) {
    return `${sign}${symbol}${(absN / 1_00_00_000).toFixed(2)}Cr`;
  }
  if (absN >= 1_00_000) {
    return `${sign}${symbol}${(absN / 1_00_000).toFixed(2)}L`;
  }
  if (absN >= 1_000) {
    return `${sign}${symbol}${(absN / 1_000).toFixed(1)}k`;
  }
  return `${sign}${symbol}${absN.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format a price with 2 decimals and Indian commas. No k/L/Cr abbreviation.
 */
export function formatPrice(v: string | number, currency = 'INR'): string {
  const n = typeof v === 'number' ? v : (parseFloat(String(v).replace(/[₹$€£¥,]/g, '')) || 0);
  if (Number.isNaN(n)) return '₹0.00';
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format quantity as a clean integer (no decimals).
 */
export function formatQuantity(v: string | number): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return '0';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/**
 * Format a percentage value with sign
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * Format a neutral percentage value without forcing a gain/loss sign.
 */
export function formatMetricPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '-'
  return `${value.toFixed(digits)}%`
}

/**
 * Format R-multiple (trading metric)
 */
export function formatRMultiple(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}R`
}

/**
 * Safely parse a decimal string returned by the backend into a number
 */
export function parseDecimal(
  value: string | number | null | undefined,
  fallback = 0
): number {
  if (value == null) return fallback
  const n = typeof value === 'string' ? parseFloat(value) : value
  return Number.isNaN(n) ? fallback : n
}