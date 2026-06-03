const FALLBACK = '—'
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
}

type NumericInput = string | number | null | undefined

function toFiniteNumber(value: NumericInput): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/[₹$€£¥,\s]/g, '')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function compactINR(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${(abs / 1_00_00_000).toFixed(2)}Cr`
  if (abs >= 1_00_000) return `${(abs / 1_00_000).toFixed(2)}L`
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(1)}k`
  return abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function safeDisplay(value: unknown, fallback = FALLBACK): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value.trim() ? value : fallback
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return fallback
}

export function formatINR(
  value: NumericInput,
  options: { fallback?: string; currency?: string; compact?: boolean; showSign?: boolean } = {},
): string {
  const { fallback = FALLBACK, currency = 'INR', compact = false, showSign = false } = options
  const numberValue = toFiniteNumber(value)
  if (numberValue == null) return fallback

  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  const sign = numberValue < 0 ? '-' : showSign && numberValue > 0 ? '+' : ''
  const abs = Math.abs(numberValue)

  if (currency === 'INR' && compact) {
    return `${sign}${symbol}${compactINR(numberValue)}`
  }

  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  return `${sign}${symbol}${abs.toLocaleString(locale, {
    maximumFractionDigits: 0,
  })}`
}

export function formatPercent(
  value: NumericInput,
  options: { fallback?: string; digits?: number; showSign?: boolean } = {},
): string {
  const { fallback = FALLBACK, digits = 2, showSign = false } = options
  const numberValue = toFiniteNumber(value)
  if (numberValue == null) return fallback
  const sign = numberValue > 0 && showSign ? '+' : ''
  return `${sign}${numberValue.toFixed(digits)}%`
}

export function formatRMultiple(
  value: NumericInput,
  options: { fallback?: string; digits?: number; showSign?: boolean } = {},
): string {
  const { fallback = FALLBACK, digits = 2, showSign = false } = options
  const numberValue = toFiniteNumber(value)
  if (numberValue == null) return fallback
  const sign = numberValue > 0 && showSign ? '+' : ''
  return `${sign}${numberValue.toFixed(digits)}R`
}
