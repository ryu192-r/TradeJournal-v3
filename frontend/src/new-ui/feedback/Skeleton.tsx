import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'block' | 'text' | 'circle'
  width?: string | number
  height?: string | number
}

export function Skeleton({ variant = 'block', width = '100%', height, style, className, ...props }: SkeletonProps) {
  const resolvedStyle = {
    width,
    height: height ?? (variant === 'text' ? undefined : '1rem'),
    ...style,
  } as CSSProperties

  return (
    <span
      aria-hidden="true"
      className={cn('tjv3-skeleton', `tjv3-skeleton--${variant}`, className)}
      style={resolvedStyle}
      {...props}
    />
  )
}
