import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

const gapTokens = {
  xs: '0.35rem',
  sm: 'var(--tj-space-row)',
  md: 'var(--tj-space-panel)',
  lg: 'var(--tj-space-section)',
} as const

export interface ClusterProps extends HTMLAttributes<HTMLDivElement> {
  gap?: keyof typeof gapTokens | string
  align?: CSSProperties['alignItems']
  justify?: CSSProperties['justifyContent']
  children: ReactNode
}

export function Cluster({
  gap = 'sm',
  align = 'center',
  justify = 'flex-start',
  style,
  className,
  children,
  ...props
}: ClusterProps) {
  const resolvedStyle = {
    '--tj-cluster-gap': gap in gapTokens ? gapTokens[gap as keyof typeof gapTokens] : gap,
    '--tj-cluster-align': align,
    '--tj-cluster-justify': justify,
    ...style,
  } as CSSProperties

  return (
    <div className={cn('tjv3-cluster', className)} style={resolvedStyle} {...props}>
      {children}
    </div>
  )
}
