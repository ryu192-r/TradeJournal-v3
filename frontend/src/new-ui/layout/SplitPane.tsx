import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface SplitPaneProps extends HTMLAttributes<HTMLDivElement> {
  primary: ReactNode
  secondary: ReactNode
  reverse?: boolean
  primaryFraction?: string
  secondaryFraction?: string
}

export function SplitPane({
  primary,
  secondary,
  reverse = false,
  primaryFraction = '1.35fr',
  secondaryFraction = '0.85fr',
  style,
  className,
  ...props
}: SplitPaneProps) {
  const resolvedStyle = {
    '--tj-split-primary': primaryFraction,
    '--tj-split-secondary': secondaryFraction,
    ...style,
  } as CSSProperties

  return (
    <div className={cn('tjv3-split-pane', reverse && 'tjv3-split-pane--reverse', className)} style={resolvedStyle} {...props}>
      <div>{primary}</div>
      <div>{secondary}</div>
    </div>
  )
}
