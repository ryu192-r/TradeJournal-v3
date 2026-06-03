import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface TableShellProps extends HTMLAttributes<HTMLDivElement> {
  stickyHeader?: boolean
  compact?: boolean
  children: ReactNode
}

export function TableShell({ stickyHeader = false, compact = false, className, children, ...props }: TableShellProps) {
  return (
    <div
      className={cn(
        'tjv3-table-shell',
        stickyHeader && 'tjv3-table-shell--sticky',
        compact && 'tjv3-table-shell--compact',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
