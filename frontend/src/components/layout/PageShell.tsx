import { cn } from '@/lib/utils'
import { PAGE_CONTAINER_CLASS } from '@/lib/mobileLayout'
import type { ReactNode } from 'react'

interface PageShellProps {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div data-testid="page-shell" className={cn(PAGE_CONTAINER_CLASS, className)}>
      {children}
    </div>
  )
}

