import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface PageShellProps {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1400px] px-[var(--page-px)] py-[var(--page-py)] pb-[calc(var(--page-py)+var(--bottom-nav-height))] lg:pb-[var(--page-py)]',
        className
      )}
    >
      {children}
    </div>
  )
}

