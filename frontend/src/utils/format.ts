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

/**
 * Format a number in Indian style: ₹ 1,50,000 or ₹ 1.5L or ₹ 1.2Cr
 */
export function formatCurrency(v: string | number, currency = 'INR') {
  const n = typeof v === 'number' ? v : (parseFloat(String(v).replace(/[₹$€£¥,]/g, '')) || 0);
  if (isNaN(n)) return `${CURRENCY_SYMBOLS[currency] || ''}0`;
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
  if (isNaN(n)) return '₹0.00';
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format quantity as a clean integer (no decimals).
 */
export function formatQuantity(v: string | number): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (isNaN(n)) return '0';
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
