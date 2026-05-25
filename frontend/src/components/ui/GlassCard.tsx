import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

interface GlassCardProps {
  children?: ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function GlassCard({
  children,
  className,
  hover = true,
  padding = 'md',
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-border animate-card-in',
        hover && 'hover:border-text-muted/30 transition-colors cursor-pointer',
        padding === 'sm' && 'p-3',
        padding === 'md' && 'p-[var(--page-px)]',
        padding === 'lg' && 'p-6',
        className
      )}
    >
      {children}
    </div>
  )
}
