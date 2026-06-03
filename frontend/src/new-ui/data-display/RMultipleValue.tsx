import type { HTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { formatRMultiple } from '../utils/format'

type RMultipleTone = 'auto' | 'neutral' | 'profit' | 'loss'
type RMultipleInput = string | number | null | undefined

export interface RMultipleValueProps extends HTMLAttributes<HTMLSpanElement> {
  value: RMultipleInput
  tone?: RMultipleTone
  showSign?: boolean
  fallback?: string
  digits?: number
}

function toNumber(value: RMultipleInput): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const parsed = Number(value.trim().replace(/[Rr\s,]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function resolveTone(value: RMultipleInput, tone: RMultipleTone): 'neutral' | 'profit' | 'loss' {
  if (tone !== 'auto') return tone
  const numberValue = toNumber(value)
  if (numberValue == null || numberValue === 0) return 'neutral'
  return numberValue > 0 ? 'profit' : 'loss'
}

export function RMultipleValue({
  value,
  tone = 'auto',
  showSign = false,
  fallback = '—',
  digits = 2,
  className,
  ...props
}: RMultipleValueProps) {
  const resolvedTone = resolveTone(value, tone)

  return (
    <span className={cn('tjv3-r-multiple-value', `tjv3-tone-${resolvedTone}`, className)} {...props}>
      {formatRMultiple(value, { fallback, digits, showSign })}
    </span>
  )
}
