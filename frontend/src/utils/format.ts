// Centralized format utilities for the trading journal

/**
 * Format a Date to DD-MM-YYYY string
 */
export function formatDate(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

export function formatCurrency(v: string | number, currency = 'INR') {
  const n = typeof v === 'number' ? v : (parseFloat(String(v).replace(/[₹$€£¥,]/g, '')) || 0);
  if (isNaN(n)) return `${CURRENCY_SYMBOLS[currency] || ''}0`;
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${n > 1000 && currency === 'INR' ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format a percentage value with sign
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
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
