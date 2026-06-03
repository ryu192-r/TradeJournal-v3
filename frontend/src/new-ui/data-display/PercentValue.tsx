import type { HTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { formatPercent } from '../utils/format'

type PercentTone = 'auto' | 'neutral' | 'profit' | 'loss' | 'warning' | 'info'
type PercentInput = string | number | null | undefined

export interface PercentValueProps extends HTMLAttributes<HTMLSpanElement> {
  value: PercentInput
  tone?: PercentTone
  showSign?: boolean
  fallback?: string
  digits?: number
}

function toNumber(value: PercentInput): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const parsed = Number(value.trim().replace(/[%\s,]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function resolveTone(value: PercentInput, tone: PercentTone): Exclude<PercentTone, 'auto'> {
  if (tone !== 'auto') return tone
  const numberValue = toNumber(value)
  if (numberValue == null || numberValue === 0) return 'neutral'
  return numberValue > 0 ? 'profit' : 'loss'
}

export function PercentValue({
  value,
  tone = 'auto',
  showSign = false,
  fallback = '—',
  digits = 2,
  className,
  ...props
}: PercentValueProps) {
  const resolvedTone = resolveTone(value, tone)

  return (
    <span className={cn('tjv3-percent-value', `tjv3-tone-${resolvedTone}`, className)} {...props}>
      {formatPercent(value, { fallback, digits, showSign })}
    </span>
  )
}
