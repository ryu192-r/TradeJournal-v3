import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export type CardVariant = 'default' | 'elevated' | 'muted'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  interactive?: boolean
  children: ReactNode
}

export function Card({ variant = 'default', interactive = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'tjv3-card',
        variant !== 'default' && `tjv3-card--${variant}`,
        interactive && 'tjv3-card--interactive',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
