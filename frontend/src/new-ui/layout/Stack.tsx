import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

const gapTokens = {
  xs: '0.35rem',
  sm: 'var(--tj-space-row)',
  md: 'var(--tj-space-panel)',
  lg: 'var(--tj-space-section)',
} as const

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: keyof typeof gapTokens | string
  children: ReactNode
}

export function Stack({ gap = 'md', style, className, children, ...props }: StackProps) {
  const resolvedStyle = {
    '--tj-stack-gap': gap in gapTokens ? gapTokens[gap as keyof typeof gapTokens] : gap,
    ...style,
  } as CSSProperties

  return (
    <div className={cn('tjv3-stack', className)} style={resolvedStyle} {...props}>
      {children}
    </div>
  )
}
