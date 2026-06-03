import type { HTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { Skeleton } from './Skeleton'

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  label?: string
  lines?: number
}

export function LoadingState({ label = 'Loading', lines = 3, className, ...props }: LoadingStateProps) {
  return (
    <div className={cn('tjv3-loading-state', className)} aria-busy="true" aria-label={label} {...props}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} variant="text" width={index === 0 ? '62%' : '100%'} />
      ))}
    </div>
  )
}
