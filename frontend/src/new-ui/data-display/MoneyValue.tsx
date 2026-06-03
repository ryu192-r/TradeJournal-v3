import type { HTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { formatINR } from '../utils/format'

type MoneyTone = 'auto' | 'neutral' | 'profit' | 'loss'
type MoneyInput = string | number | null | undefined

export interface MoneyValueProps extends HTMLAttributes<HTMLSpanElement> {
  value: MoneyInput
  currency?: string
  tone?: MoneyTone
  showSign?: boolean
  fallback?: string
  compact?: boolean
}

function toNumber(value: MoneyInput): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const parsed = Number(value.trim().replace(/[₹$€£¥,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function resolveTone(value: MoneyInput, tone: MoneyTone): 'neutral' | 'profit' | 'loss' {
  if (tone !== 'auto') return tone
  const numberValue = toNumber(value)
  if (numberValue == null || numberValue === 0) return 'neutral'
  return numberValue > 0 ? 'profit' : 'loss'
}

export function MoneyValue({
  value,
  currency = 'INR',
  tone = 'auto',
  showSign = false,
  fallback = '—',
  compact = false,
  className,
  ...props
}: MoneyValueProps) {
  const resolvedTone = resolveTone(value, tone)

  return (
    <span className={cn('tjv3-money-value', `tjv3-tone-${resolvedTone}`, className)} {...props}>
      {formatINR(value, { currency, fallback, compact, showSign })}
    </span>
  )
}
