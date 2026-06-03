import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface DataListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function DataList({ className, children, ...props }: DataListProps) {
  return (
    <div className={cn('tjv3-data-list', className)} {...props}>
      {children}
    </div>
  )
}
