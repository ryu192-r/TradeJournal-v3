import type { HTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { safeDisplay } from '../utils/format'

export type ValueTone = 'neutral' | 'accent' | 'profit' | 'loss' | 'warning' | 'info' | 'success' | 'danger' | 'pending'

export interface ValueProps extends HTMLAttributes<HTMLSpanElement> {
  value: unknown
  fallback?: string
  tone?: ValueTone
}

export function Value({ value, fallback = '—', tone = 'neutral', className, ...props }: ValueProps) {
  return (
    <span className={cn('tjv3-value', `tjv3-tone-${tone}`, className)} {...props}>
      {safeDisplay(value, fallback)}
    </span>
  )
}
