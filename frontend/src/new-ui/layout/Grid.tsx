import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

const gapTokens = {
  sm: 'var(--tj-space-row)',
  md: 'var(--tj-space-panel)',
  lg: 'var(--tj-space-section)',
} as const

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  minColumnWidth?: string
  gap?: keyof typeof gapTokens | string
  children: ReactNode
}

export function Grid({ minColumnWidth = '14rem', gap = 'md', style, className, children, ...props }: GridProps) {
  const resolvedStyle = {
    '--tj-grid-min': minColumnWidth,
    '--tj-grid-gap': gap in gapTokens ? gapTokens[gap as keyof typeof gapTokens] : gap,
    ...style,
  } as CSSProperties

  return (
    <div className={cn('tjv3-grid', className)} style={resolvedStyle} {...props}>
      {children}
    </div>
  )
}
