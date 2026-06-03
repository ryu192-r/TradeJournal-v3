import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export type SurfaceVariant = 'default' | 'elevated' | 'muted'

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant
  children: ReactNode
}

export function Surface({ variant = 'default', className, children, ...props }: SurfaceProps) {
  return (
    <div className={cn('tjv3-surface', variant !== 'default' && `tjv3-surface--${variant}`, className)} {...props}>
      {children}
    </div>
  )
}
