import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'
import type { BadgeVariant } from './Badge'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
  children: ReactNode
}

export function Chip({ variant = 'neutral', dot = false, className, children, ...props }: ChipProps) {
  return (
    <span className={cn('tjv3-chip', `tjv3-chip--${variant}`, `tjv3-tone-${variant}`, className)} {...props}>
      {dot && <span className="tjv3-chip__dot" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  )
}
