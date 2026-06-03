import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'profit'
  | 'loss'
  | 'warning'
  | 'info'
  | 'success'
  | 'danger'
  | 'pending'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
  children: ReactNode
}

export function Badge({ variant = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('tjv3-badge', `tjv3-badge--${variant}`, `tjv3-tone-${variant}`, className)} {...props}>
      {dot && <span className="tjv3-badge__dot" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  )
}
